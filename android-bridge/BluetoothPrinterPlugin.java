package com.tokocahaya.simpelkasir;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetoothLegacy",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        ),
        @Permission(
            alias = "bluetoothModern",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int WIFI_HTTP_PORT_START = 8765;
    private static final int WIFI_UDP_DISCOVER_PORT = 8766;
    private static final String WIFI_DISCOVER_MAGIC = "SIMPELKASIR_DISCOVER";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ExecutorService wifiExecutor = Executors.newCachedThreadPool();
    private BroadcastReceiver activeDiscoveryReceiver = null;
    private BroadcastReceiver btStateReceiver = null;

    // Persistent keep-alive socket for instant printing & low battery overhead
    private final Object socketLock = new Object();
    private BluetoothSocket activeSocket = null;
    private String activeAddress = null;
    private volatile String preferredPrinterAddress = null;

    // WiFi / Hotspot LAN CSV Sync Server state
    private final Object wifiServerLock = new Object();
    private volatile boolean wifiServerRunning = false;
    private ServerSocket wifiHttpServer = null;
    private DatagramSocket wifiUdpSocket = null;
    private int wifiHttpPort = WIFI_HTTP_PORT_START;
    private byte[] wifiHostedCsvBytes = new byte[0];
    private String wifiHostedFileName = "Products_SimpelKasir.csv";
    private String wifiHostedStoreName = "SimpelKasir";
    private int wifiHostedProductCount = 0;

    @Override
    public void load() {
        super.load();
        registerBtStateMonitor();
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager != null ? manager.getAdapter() : BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasScanPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
        }
        boolean bt = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
        boolean fine = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        return bt && (fine || coarse);
    }

    private boolean hasConnectPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestBtPermissions(PluginCall call, String callbackName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAlias("bluetoothModern", call, callbackName);
        } else {
            requestPermissionForAlias("bluetoothLegacy", call, callbackName);
        }
    }

    private void registerBtStateMonitor() {
        if (btStateReceiver != null) return;
        btStateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {
                    int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
                    if (state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF) {
                        closeActiveSocket();
                    }
                } else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
                    @SuppressWarnings("deprecation")
                    BluetoothDevice dev = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (dev != null && dev.getAddress() != null && dev.getAddress().equals(activeAddress)) {
                        closeActiveSocket();
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
        filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(btStateReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(btStateReceiver, filter);
            }
        } catch (Exception ignored) {
            btStateReceiver = null;
        }
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (!hasScanPermissions()) {
            requestBtPermissions(call, "scanPermCallback");
            return;
        }
        resolveDevices(call, false);
    }

    @PluginMethod
    public void scanDevices(PluginCall call) {
        if (!hasScanPermissions()) {
            requestBtPermissions(call, "scanAndDiscoverPermCallback");
            return;
        }
        resolveDevices(call, true);
    }

    @PermissionCallback
    private void scanPermCallback(PluginCall call) {
        if (hasConnectPermissions()) {
            resolveDevices(call, false);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk membaca daftar printer.");
        }
    }

    @PermissionCallback
    private void scanAndDiscoverPermCallback(PluginCall call) {
        if (hasScanPermissions() || hasConnectPermissions()) {
            resolveDevices(call, true);
        } else {
            call.reject("Izin Bluetooth & Perangkat Terdekat wajib diizinkan untuk mencari printer thermal.");
        }
    }

    private boolean looksLikePrinter(BluetoothDevice dev, String safeName) {
        try {
            BluetoothClass btClass = dev.getBluetoothClass();
            if (btClass != null) {
                int major = btClass.getMajorDeviceClass();
                if (major == BluetoothClass.Device.Major.IMAGING) {
                    return true;
                }
            }
        } catch (SecurityException ignored) {}

        String upper = safeName.toUpperCase(Locale.ROOT);
        return upper.contains("PRINT")
            || upper.contains("RPP")
            || upper.contains("MTP")
            || upper.contains("POS")
            || upper.contains("EPPOS")
            || upper.contains("XPRINTER")
            || upper.contains("XP-")
            || upper.contains("VSC")
            || upper.contains("ZJ")
            || upper.contains("PANDA")
            || upper.contains("GOOJPRT")
            || upper.contains("BELLAV")
            || upper.contains("THERMAL")
            || upper.contains("MPT")
            || upper.contains("BLUEPRINT")
            || upper.contains("KASSEN")
            || upper.contains("TM-");
    }

    private void putDeviceIntoMap(Map<String, JSObject> map, BluetoothDevice dev, boolean bonded) {
        try {
            String addr = dev.getAddress();
            if (addr == null || addr.isEmpty()) return;
            String rawName = dev.getName();
            String safeName = (rawName != null && !rawName.trim().isEmpty()) ? rawName.trim() : ("Perangkat " + addr);
            boolean isPrinter = looksLikePrinter(dev, safeName);

            JSObject existing = map.get(addr);
            if (existing != null) {
                if (bonded) existing.put("bonded", true);
                if (rawName != null && !rawName.trim().isEmpty()) {
                    existing.put("name", rawName.trim());
                }
                if (isPrinter) existing.put("isPrinter", true);
                return;
            }

            JSObject obj = new JSObject();
            obj.put("name", safeName);
            obj.put("address", addr);
            obj.put("bonded", bonded);
            obj.put("isPrinter", isPrinter);
            map.put(addr, obj);
        } catch (SecurityException ignored) {}
    }

    private void cleanupDiscoveryReceiver() {
        if (activeDiscoveryReceiver != null) {
            try {
                getContext().unregisterReceiver(activeDiscoveryReceiver);
            } catch (Exception ignored) {}
            activeDiscoveryReceiver = null;
        }
    }

    private void resolveDevices(PluginCall call, boolean runDiscovery) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Perangkat HP tidak mendukung Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth HP sedang mati. Nyalakan Bluetooth terlebih dahulu.");
            return;
        }

        executor.execute(() -> {
            Map<String, JSObject> foundMap = new LinkedHashMap<>();

            try {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice dev : bonded) {
                        putDeviceIntoMap(foundMap, dev, true);
                    }
                }
            } catch (SecurityException e) {
                call.reject("Izin Bluetooth ditolak sistem: " + e.getMessage());
                return;
            }

            if (runDiscovery && hasScanPermissions()) {
                CountDownLatch latch = new CountDownLatch(1);
                cleanupDiscoveryReceiver();

                BroadcastReceiver receiver = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        String action = intent.getAction();
                        if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                            @SuppressWarnings("deprecation")
                            BluetoothDevice dev = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                            if (dev != null) {
                                boolean isBonded = false;
                                try {
                                    isBonded = dev.getBondState() == BluetoothDevice.BOND_BONDED;
                                } catch (SecurityException ignored) {}
                                putDeviceIntoMap(foundMap, dev, isBonded);
                            }
                        } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                            latch.countDown();
                        }
                    }
                };

                activeDiscoveryReceiver = receiver;
                IntentFilter filter = new IntentFilter();
                filter.addAction(BluetoothDevice.ACTION_FOUND);
                filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
                    } else {
                        getContext().registerReceiver(receiver, filter);
                    }

                    try {
                        if (adapter.isDiscovering()) {
                            adapter.cancelDiscovery();
                        }
                        adapter.startDiscovery();
                    } catch (SecurityException ignored) {}

                    latch.await(4000, TimeUnit.MILLISECONDS);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                } finally {
                    try {
                        if (adapter.isDiscovering()) {
                            adapter.cancelDiscovery();
                        }
                    } catch (SecurityException ignored) {}
                    cleanupDiscoveryReceiver();
                }
            }

            JSArray arr = new JSArray();
            for (JSObject item : foundMap.values()) {
                if (item.optBoolean("isPrinter", false) && item.optBoolean("bonded", false)) {
                    arr.put(item);
                }
            }
            for (JSObject item : foundMap.values()) {
                if (item.optBoolean("isPrinter", false) && !item.optBoolean("bonded", false)) {
                    arr.put(item);
                }
            }
            for (JSObject item : foundMap.values()) {
                if (!item.optBoolean("isPrinter", false) && item.optBoolean("bonded", false)) {
                    arr.put(item);
                }
            }
            for (JSObject item : foundMap.values()) {
                if (!item.optBoolean("isPrinter", false) && !item.optBoolean("bonded", false)) {
                    arr.put(item);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", arr);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void autoConnect(PluginCall call) {
        // Multi-HP mode: keep printer unlocked while idle so other phones can print anytime.
        String address = call.getString("address");
        if (address != null && !address.isEmpty()) {
            preferredPrinterAddress = address;
        }
        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        preferredPrinterAddress = null;
        closeActiveSocket();
        JSObject ok = new JSObject();
        ok.put("ok", true);
        call.resolve(ok);
    }

    @PluginMethod
    public void testConnection(PluginCall call) {
        if (!hasConnectPermissions()) {
            requestBtPermissions(call, "testConnectionPermCallback");
            return;
        }
        runTestConnection(call);
    }

    @PermissionCallback
    private void testConnectionPermCallback(PluginCall call) {
        if (hasConnectPermissions()) {
            runTestConnection(call);
        } else {
            call.reject("Izin Bluetooth Connect diperlukan untuk menyambungkan printer.");
        }
    }

    private void runTestConnection(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Alamat printer kosong.");
            return;
        }
        preferredPrinterAddress = address;
        executor.execute(() -> {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth HP tidak aktif.");
                return;
            }
            try {
                ensureConnectedSocket(adapter, address);
                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
            } catch (Exception e) {
                call.reject("Gagal terhubung ke printer (" + address + "). Pastikan printer menyala & tidak sedang dipakai HP lain. Detail: " + e.getMessage());
            } finally {
                // Release immediately so other phones sharing the same printer stay unblocked
                closeActiveSocket();
            }
        });
    }

    @PluginMethod
    public void printBytes(PluginCall call) {
        if (!hasConnectPermissions()) {
            requestBtPermissions(call, "printBytesPermCallback");
            return;
        }
        runPrintBytes(call);
    }

    @PermissionCallback
    private void printBytesPermCallback(PluginCall call) {
        if (hasConnectPermissions()) {
            runPrintBytes(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk mencetak struk.");
        }
    }

    private void runPrintBytes(PluginCall call) {
        String address = call.getString("address");
        String b64 = call.getString("base64");
        if (address == null || address.isEmpty() || b64 == null) {
            call.reject("Alamat printer atau data cetak kosong.");
            return;
        }
        preferredPrinterAddress = address;
        byte[] data = Base64.decode(b64, Base64.DEFAULT);
        sendRawBytes(address, data, call);
    }

    @PluginMethod
    public void testPrint(PluginCall call) {
        if (!hasConnectPermissions()) {
            requestBtPermissions(call, "testPrintPermCallback");
            return;
        }
        runTestPrintInternal(call);
    }

    @PermissionCallback
    private void testPrintPermCallback(PluginCall call) {
        if (hasConnectPermissions()) {
            runTestPrintInternal(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk Test Print.");
        }
    }

    private void runTestPrintInternal(PluginCall call) {
        String address = call.getString("address");
        String paperWidth = call.getString("paperWidth", "58");
        int bottomMm = call.getInt("bottomFeedMm", 5);
        if (address == null || address.isEmpty()) {
            call.reject("Pilih printer terlebih dahulu.");
            return;
        }
        preferredPrinterAddress = address;
        String dash = "80".equals(paperWidth) ? "------------------------------------------------\n" : "--------------------------------\n";
        byte[] head = (
            "\u001B@\u001B3\u001B\u001Ba\u0001\u001BE\u0001SimpelKasir\n\u001BE\u0000" +
            "TEST PRINT BERHASIL\n" +
            dash +
            "Kertas: " + paperWidth + " mm | Bawah: " + bottomMm + " mm\n" +
            "Printer Siap Cetak Cepat!\n"
        ).getBytes(StandardCharsets.US_ASCII);

        int dots = Math.max(0, bottomMm) * 8;
        int extraFeeds = (dots > 0 ? ((dots / 240) + (dots % 240 > 0 ? 1 : 0)) * 3 : 0);
        byte[] payload = new byte[head.length + extraFeeds];
        System.arraycopy(head, 0, payload, 0, head.length);
        int pos = head.length;
        while (dots > 0) {
            int step = Math.min(240, dots);
            payload[pos++] = 0x1B;
            payload[pos++] = 0x4A;
            payload[pos++] = (byte) step;
            dots -= step;
        }
        sendRawBytes(address, payload, call);
    }

    private String sanitizeFileName(String raw, String fallback) {
        String safe = (raw == null ? "" : raw).trim().replaceAll("[^a-zA-Z0-9._-]", "_");
        return safe.isEmpty() ? fallback : safe;
    }

    private String sanitizeSubFolder(String raw) {
        if (raw == null) return "";
        return raw.trim().replaceAll("[^a-zA-Z0-9_-]", "");
    }

    private String writeBytesToDownloads(String fileName, byte[] bytes, String mimeType, String subFolder) throws IOException {
        String safeName = sanitizeFileName(fileName, "SimpelKasir_File.txt");
        String safeSub = sanitizeSubFolder(subFolder);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            String relPath = safeSub.isEmpty()
                ? Environment.DIRECTORY_DOWNLOADS
                : (Environment.DIRECTORY_DOWNLOADS + "/" + safeSub);
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, relPath);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IOException("Gagal membuat file di MediaStore Download.");
            }
            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os == null) throw new IOException("Stream Download null.");
                os.write(bytes);
                os.flush();
            }
        } else {
            File baseDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File dir = safeSub.isEmpty() ? baseDir : new File(baseDir, safeSub);
            if (!dir.exists()) dir.mkdirs();
            File outFile = new File(dir, safeName);
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(bytes);
                fos.flush();
            }
        }
        return safeSub.isEmpty() ? ("Download/" + safeName) : ("Download/" + safeSub + "/" + safeName);
    }

    @PluginMethod
    public void saveFileToDownloads(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String subFolder = call.getString("subFolder", "");
        if (fileName == null || fileName.isEmpty() || content == null) {
            call.reject("Nama file atau isi kosong.");
            return;
        }
        executor.execute(() -> {
            try {
                byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                String savedPath = writeBytesToDownloads(fileName, bytes, mimeType, subFolder);
                JSObject ok = new JSObject();
                ok.put("ok", true);
                ok.put("path", savedPath);
                call.resolve(ok);
            } catch (Exception e) {
                call.reject("Gagal menyimpan ke folder Download: " + e.getMessage());
            }
        });
    }

    // =========================================================================
    // WIFI / HOTSPOT LOCAL CSV SYNC (CARA 1 - 1 WIFI / HOTSPOT TANPA INTERNET)
    // =========================================================================

    private List<String> getLocalWifiIps() {
        List<String> preferred = new ArrayList<>();
        List<String> others = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces != null && ifaces.hasMoreElements()) {
                NetworkInterface iface = ifaces.nextElement();
                if (!iface.isUp() || iface.isLoopback()) continue;
                String name = iface.getName() == null ? "" : iface.getName().toLowerCase(Locale.ROOT);
                if (name.contains("rmnet") || name.contains("ccmni") || name.contains("tun") || name.contains("dummy")) {
                    continue;
                }
                Enumeration<InetAddress> addrs = iface.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress() && addr.isSiteLocalAddress()) {
                        String hostAddr = addr.getHostAddress();
                        if (hostAddr != null && !hostAddr.isEmpty()) {
                            if (name.contains("wlan") || name.contains("ap") || name.contains("swlan") || name.contains("wifi")) {
                                if (!preferred.contains(hostAddr)) preferred.add(hostAddr);
                            } else {
                                if (!others.contains(hostAddr)) others.add(hostAddr);
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        preferred.addAll(others);
        return preferred;
    }

    private String pickMatchingIp(InetAddress remoteAddr, List<String> ips) {
        if (ips.isEmpty()) return "";
        if (remoteAddr != null && remoteAddr.getHostAddress() != null) {
            String remote = remoteAddr.getHostAddress();
            int dot = remote.lastIndexOf('.');
            if (dot > 0) {
                String prefix = remote.substring(0, dot + 1);
                for (String ip : ips) {
                    if (ip.startsWith(prefix)) return ip;
                }
            }
        }
        return ips.get(0);
    }

    private void stopWifiCsvServerInternal() {
        synchronized (wifiServerLock) {
            wifiServerRunning = false;
            if (wifiHttpServer != null) {
                try {
                    wifiHttpServer.close();
                } catch (Exception ignored) {}
                wifiHttpServer = null;
            }
            if (wifiUdpSocket != null) {
                try {
                    wifiUdpSocket.close();
                } catch (Exception ignored) {}
                wifiUdpSocket = null;
            }
        }
    }

    private void handleWifiHttpClient(Socket client) {
        try {
            client.setSoTimeout(8000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
            String requestLine = reader.readLine();
            if (requestLine == null) return;
            String path = "/";
            String[] parts = requestLine.split(" ");
            if (parts.length >= 2) {
                path = parts[1];
                int qIdx = path.indexOf('?');
                if (qIdx != -1) path = path.substring(0, qIdx);
            }

            OutputStream os = client.getOutputStream();
            if ("/products.csv".equals(path) || "/download".equals(path)) {
                byte[] body = wifiHostedCsvBytes;
                String headers =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: text/csv; charset=utf-8\r\n" +
                    "Content-Disposition: attachment; filename=\"" + wifiHostedFileName + "\"\r\n" +
                    "Content-Length: " + body.length + "\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n\r\n";
                os.write(headers.getBytes(StandardCharsets.US_ASCII));
                os.write(body);
                os.flush();
            } else if ("/info".equals(path)) {
                JSONObject info = new JSONObject();
                info.put("ok", true);
                info.put("app", "SimpelKasir");
                info.put("storeName", wifiHostedStoreName);
                info.put("deviceName", Build.MODEL != null ? Build.MODEL : "Android");
                info.put("productCount", wifiHostedProductCount);
                info.put("fileName", wifiHostedFileName);
                info.put("port", wifiHttpPort);
                byte[] body = info.toString().getBytes(StandardCharsets.UTF_8);
                String headers =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: application/json; charset=utf-8\r\n" +
                    "Content-Length: " + body.length + "\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n\r\n";
                os.write(headers.getBytes(StandardCharsets.US_ASCII));
                os.write(body);
                os.flush();
            } else {
                String html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>SimpelKasir Sync</title></head>"
                    + "<body style='font-family:sans-serif;padding:24px;text-align:center'>"
                    + "<h2>SimpelKasir - Sinkron CSV</h2>"
                    + "<p>" + wifiHostedProductCount + " produk siap diunduh dari <b>" + wifiHostedStoreName + "</b></p>"
                    + "<p><a href='/products.csv' style='display:inline-block;padding:12px 20px;background:#165B49;color:#fff;text-decoration:none;border-radius:10px;font-weight:bold'>Download " + wifiHostedFileName + "</a></p>"
                    + "</body></html>";
                byte[] body = html.getBytes(StandardCharsets.UTF_8);
                String headers =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: text/html; charset=utf-8\r\n" +
                    "Content-Length: " + body.length + "\r\n" +
                    "Connection: close\r\n\r\n";
                os.write(headers.getBytes(StandardCharsets.US_ASCII));
                os.write(body);
                os.flush();
            }
        } catch (Exception ignored) {
        } finally {
            try {
                client.close();
            } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void startWifiCsvServer(PluginCall call) {
        String content = call.getString("content");
        String fileName = sanitizeFileName(call.getString("fileName", "Products_SimpelKasir.csv"), "Products_SimpelKasir.csv");
        String storeName = call.getString("storeName", "SimpelKasir");
        int productCount = call.getInt("productCount", 0);

        if (content == null || content.isEmpty()) {
            call.reject("Data produk CSV kosong.");
            return;
        }

        wifiExecutor.execute(() -> {
            List<String> ips = getLocalWifiIps();
            if (ips.isEmpty()) {
                call.reject("HP belum terhubung ke WiFi dan Hotspot belum aktif. Nyalakan Hotspot atau sambungkan ke WiFi yang sama.");
                return;
            }

            stopWifiCsvServerInternal();

            ServerSocket openedHttp = null;
            int chosenPort = WIFI_HTTP_PORT_START;
            for (int p = WIFI_HTTP_PORT_START; p <= WIFI_HTTP_PORT_START + 10; p++) {
                try {
                    ServerSocket ss = new ServerSocket();
                    ss.setReuseAddress(true);
                    ss.bind(new InetSocketAddress(p));
                    openedHttp = ss;
                    chosenPort = p;
                    break;
                } catch (IOException ignored) {}
            }
            if (openedHttp == null) {
                try {
                    openedHttp = new ServerSocket(0);
                    chosenPort = openedHttp.getLocalPort();
                } catch (IOException e) {
                    call.reject("Gagal membuka port server WiFi: " + e.getMessage());
                    return;
                }
            }

            synchronized (wifiServerLock) {
                wifiHostedCsvBytes = content.getBytes(StandardCharsets.UTF_8);
                wifiHostedFileName = fileName;
                wifiHostedStoreName = storeName != null ? storeName : "SimpelKasir";
                wifiHostedProductCount = productCount;
                wifiHttpServer = openedHttp;
                wifiHttpPort = chosenPort;
                wifiServerRunning = true;
            }

            final ServerSocket serverRef = openedHttp;
            wifiExecutor.execute(() -> {
                while (wifiServerRunning && !serverRef.isClosed()) {
                    try {
                        Socket client = serverRef.accept();
                        wifiExecutor.execute(() -> handleWifiHttpClient(client));
                    } catch (IOException e) {
                        if (wifiServerRunning) {
                            break;
                        }
                    }
                }
            });

            // Optional UDP responder for 1-tap auto-discovery on the same WiFi/Hotspot
            try {
                DatagramSocket udp = new DatagramSocket(null);
                udp.setReuseAddress(true);
                udp.setBroadcast(true);
                udp.bind(new InetSocketAddress(WIFI_UDP_DISCOVER_PORT));
                synchronized (wifiServerLock) {
                    wifiUdpSocket = udp;
                }
                wifiExecutor.execute(() -> {
                    byte[] buf = new byte[512];
                    while (wifiServerRunning && !udp.isClosed()) {
                        try {
                            DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                            udp.receive(pkt);
                            String msg = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8).trim();
                            if (msg.startsWith(WIFI_DISCOVER_MAGIC)) {
                                List<String> curIps = getLocalWifiIps();
                                String bestIp = pickMatchingIp(pkt.getAddress(), curIps);
                                if (!bestIp.isEmpty()) {
                                    JSONObject resp = new JSONObject();
                                    resp.put("app", "SimpelKasir");
                                    resp.put("ip", bestIp);
                                    resp.put("port", wifiHttpPort);
                                    resp.put("storeName", wifiHostedStoreName);
                                    resp.put("deviceName", Build.MODEL != null ? Build.MODEL : "Android");
                                    resp.put("productCount", wifiHostedProductCount);
                                    resp.put("fileName", wifiHostedFileName);
                                    byte[] respBytes = resp.toString().getBytes(StandardCharsets.UTF_8);
                                    DatagramPacket reply = new DatagramPacket(
                                        respBytes,
                                        respBytes.length,
                                        pkt.getAddress(),
                                        pkt.getPort()
                                    );
                                    udp.send(reply);
                                }
                            }
                        } catch (Exception ignored) {
                            if (!wifiServerRunning) break;
                        }
                    }
                });
            } catch (Exception ignored) {
                // UDP discovery socket optional; manual IP:port HTTP transfer always works
            }

            JSArray ipArr = new JSArray();
            for (String ip : ips) {
                ipArr.put(ip);
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("ips", ipArr);
            ret.put("port", chosenPort);
            ret.put("deviceName", Build.MODEL != null ? Build.MODEL : "Android");
            ret.put("fileName", fileName);
            ret.put("productCount", productCount);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void stopWifiCsvServer(PluginCall call) {
        stopWifiCsvServerInternal();
        JSObject ok = new JSObject();
        ok.put("ok", true);
        call.resolve(ok);
    }

    @PluginMethod
    public void discoverWifiCsvServers(PluginCall call) {
        wifiExecutor.execute(() -> {
            Map<String, JSObject> found = new LinkedHashMap<>();
            DatagramSocket sock = null;
            try {
                sock = new DatagramSocket();
                sock.setBroadcast(true);
                sock.setSoTimeout(350);

                Set<String> targets = new HashSet<>();
                targets.add("255.255.255.255");
                targets.add("192.168.43.1");
                targets.add("192.168.137.1");
                targets.add("192.168.49.1");

                try {
                    Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
                    while (ifaces != null && ifaces.hasMoreElements()) {
                        NetworkInterface iface = ifaces.nextElement();
                        if (!iface.isUp() || iface.isLoopback()) continue;
                        for (InterfaceAddress ia : iface.getInterfaceAddresses()) {
                            InetAddress bcast = ia.getBroadcast();
                            if (bcast != null && bcast.getHostAddress() != null) {
                                targets.add(bcast.getHostAddress());
                            }
                            InetAddress local = ia.getAddress();
                            if (local instanceof Inet4Address && local.getHostAddress() != null) {
                                String ip = local.getHostAddress();
                                int dot = ip.lastIndexOf('.');
                                if (dot > 0) {
                                    targets.add(ip.substring(0, dot + 1) + "1");
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}

                byte[] probe = WIFI_DISCOVER_MAGIC.getBytes(StandardCharsets.UTF_8);
                long start = System.currentTimeMillis();
                for (int round = 0; round < 2; round++) {
                    for (String target : targets) {
                        try {
                            InetAddress dest = InetAddress.getByName(target);
                            sock.send(new DatagramPacket(probe, probe.length, dest, WIFI_UDP_DISCOVER_PORT));
                        } catch (Exception ignored) {}
                    }
                    long roundEnd = start + (round == 0 ? 750 : 1750);
                    byte[] recvBuf = new byte[2048];
                    while (System.currentTimeMillis() < roundEnd) {
                        try {
                            DatagramPacket pkt = new DatagramPacket(recvBuf, recvBuf.length);
                            sock.receive(pkt);
                            String raw = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8).trim();
                            JSONObject json = new JSONObject(raw);
                            if ("SimpelKasir".equals(json.optString("app"))) {
                                String ip = json.optString("ip", pkt.getAddress().getHostAddress());
                                int port = json.optInt("port", WIFI_HTTP_PORT_START);
                                String key = ip + ":" + port;
                                JSObject peer = new JSObject();
                                peer.put("ip", ip);
                                peer.put("port", port);
                                peer.put("storeName", json.optString("storeName", "SimpelKasir"));
                                peer.put("deviceName", json.optString("deviceName", "Android"));
                                peer.put("productCount", json.optInt("productCount", 0));
                                peer.put("fileName", json.optString("fileName", "Products_SimpelKasir.csv"));
                                found.put(key, peer);
                            }
                        } catch (SocketTimeoutException ignored) {
                            break;
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception e) {
                call.reject("Gagal memindai WiFi: " + e.getMessage());
                return;
            } finally {
                if (sock != null) {
                    try {
                        sock.close();
                    } catch (Exception ignored) {}
                }
            }

            JSArray arr = new JSArray();
            for (JSObject item : found.values()) {
                arr.put(item);
            }
            JSObject ret = new JSObject();
            ret.put("servers", arr);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void downloadWifiCsv(PluginCall call) {
        String rawAddress = call.getString("address");
        boolean saveToSimpelKasir = Boolean.TRUE.equals(call.getBoolean("saveToSimpelKasir", true));
        String overrideFileName = call.getString("fileName", "");

        if (rawAddress == null || rawAddress.trim().isEmpty()) {
            call.reject("Alamat IP pengirim kosong.");
            return;
        }

        wifiExecutor.execute(() -> {
            String base = rawAddress.trim();
            if (base.startsWith("http://")) base = base.substring(7);
            else if (base.startsWith("https://")) base = base.substring(8);
            int slashIdx = base.indexOf('/');
            if (slashIdx != -1) base = base.substring(0, slashIdx);
            if (!base.contains(":")) {
                base = base + ":" + WIFI_HTTP_PORT_START;
            }
            String baseUrl = "http://" + base;

            String storeName = "SimpelKasir";
            String remoteFileName = "";
            try {
                HttpURLConnection infoConn = (HttpURLConnection) new URL(baseUrl + "/info").openConnection();
                infoConn.setConnectTimeout(3000);
                infoConn.setReadTimeout(4000);
                if (infoConn.getResponseCode() == 200) {
                    try (InputStream is = infoConn.getInputStream();
                         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                        JSONObject info = new JSONObject(bos.toString(StandardCharsets.UTF_8.name()));
                        storeName = info.optString("storeName", storeName);
                        remoteFileName = info.optString("fileName", "");
                    }
                }
                infoConn.disconnect();
            } catch (Exception ignored) {}

            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(baseUrl + "/products.csv").openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(15000);
                int code = conn.getResponseCode();
                if (code != 200) {
                    throw new IOException("Server merespons HTTP " + code);
                }
                byte[] csvBytes;
                try (InputStream is = conn.getInputStream();
                     ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) != -1) {
                        bos.write(buf, 0, n);
                    }
                    csvBytes = bos.toByteArray();
                }

                String csvContent = new String(csvBytes, StandardCharsets.UTF_8);
                if (csvContent.trim().isEmpty()) {
                    throw new IOException("File CSV yang diterima kosong.");
                }

                String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
                String defaultName = "Products_SimpelKasir_" + stamp + ".csv";
                String chosenName = (overrideFileName != null && !overrideFileName.trim().isEmpty())
                    ? overrideFileName.trim()
                    : (!remoteFileName.isEmpty() ? remoteFileName : defaultName);
                chosenName = sanitizeFileName(chosenName, defaultName);
                if (!chosenName.toLowerCase(Locale.ROOT).endsWith(".csv")) {
                    chosenName = chosenName + ".csv";
                }

                String savedPath = "";
                if (saveToSimpelKasir) {
                    savedPath = writeBytesToDownloads(chosenName, csvBytes, "text/csv", "SimpelKasir");
                }

                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("content", csvContent);
                res.put("fileName", chosenName);
                res.put("savedPath", savedPath);
                res.put("storeName", storeName);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Gagal menerima CSV dari " + base + ". Pastikan pengirim aktif & di WiFi/Hotspot yang sama. Detail: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private BluetoothSocket ensureConnectedSocket(BluetoothAdapter adapter, String address) throws Exception {
        synchronized (socketLock) {
            if (activeSocket != null && address.equals(activeAddress) && activeSocket.isConnected()) {
                return activeSocket;
            }
            closeActiveSocketLocked();
            BluetoothDevice device = adapter.getRemoteDevice(address);
            BluetoothSocket s = connectWithFallback(adapter, device);
            activeSocket = s;
            activeAddress = address;
            return s;
        }
    }

    private void closeActiveSocket() {
        synchronized (socketLock) {
            closeActiveSocketLocked();
        }
    }

    private void closeActiveSocketLocked() {
        if (activeSocket != null) {
            try {
                activeSocket.close();
            } catch (Exception ignored) {}
            activeSocket = null;
        }
        activeAddress = null;
    }

    private BluetoothSocket connectWithFallback(BluetoothAdapter adapter, BluetoothDevice device) throws Exception {
        try {
            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }
        } catch (SecurityException ignored) {}

        try {
            if (device.getBondState() == BluetoothDevice.BOND_NONE) {
                device.createBond();
                Thread.sleep(250);
            }
        } catch (Exception ignored) {}

        Exception lastError = null;

        try {
            BluetoothSocket s1 = device.createRfcommSocketToServiceRecord(SPP_UUID);
            s1.connect();
            return s1;
        } catch (Exception e1) {
            lastError = e1;
        }

        try {
            BluetoothSocket s2 = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            s2.connect();
            return s2;
        } catch (Exception e2) {
            lastError = e2;
        }

        try {
            Method m = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket s3 = (BluetoothSocket) m.invoke(device, 1);
            if (s3 != null) {
                s3.connect();
                return s3;
            }
        } catch (Exception e3) {
            lastError = e3;
        }

        throw (lastError != null) ? lastError : new IOException("Tidak dapat membuka koneksi RFCOMM ke printer.");
    }

    private void writePayloadFast(BluetoothSocket socket, byte[] payload) throws Exception {
        OutputStream os = socket.getOutputStream();
        if (payload.length <= 1024) {
            os.write(payload);
            os.flush();
            return;
        }
        int chunkSize = 1024;
        for (int i = 0; i < payload.length; i += chunkSize) {
            int len = Math.min(chunkSize, payload.length - i);
            os.write(payload, i, len);
            os.flush();
            if (i + len < payload.length) {
                Thread.sleep(5);
            }
        }
    }

    private void sendRawBytes(String address, byte[] payload, PluginCall call) {
        executor.execute(() -> {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth tidak aktif. Nyalakan Bluetooth di HP terlebih dahulu.");
                return;
            }
            Exception lastErr = null;
            for (int attempt = 1; attempt <= 3; attempt++) {
                try {
                    BluetoothSocket socket = ensureConnectedSocket(adapter, address);
                    Thread.sleep(30);
                    writePayloadFast(socket, payload);
                    // Short drain wait so printer finishes receiving buffer before disconnecting
                    Thread.sleep(120);
                    closeActiveSocket();

                    JSObject ok = new JSObject();
                    ok.put("ok", true);
                    call.resolve(ok);
                    return;
                } catch (Exception e) {
                    lastErr = e;
                    closeActiveSocket();
                    if (attempt < 3) {
                        try {
                            Thread.sleep(400);
                        } catch (InterruptedException ignored) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            }
            call.reject("Gagal cetak ke printer: " + (lastErr != null ? lastErr.getMessage() : "Printer sedang dipakai atau mati"));
        });
    }

    @Override
    protected void handleOnDestroy() {
        stopWifiCsvServerInternal();
        cleanupDiscoveryReceiver();
        if (btStateReceiver != null) {
            try {
                getContext().unregisterReceiver(btStateReceiver);
            } catch (Exception ignored) {}
            btStateReceiver = null;
        }
        closeActiveSocket();
        executor.shutdownNow();
        wifiExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}
