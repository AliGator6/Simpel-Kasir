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
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.app.ActivityCompat;
import androidx.core.content.FileProvider;

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
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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

    private static final String PREFS_BT = "simpelkasir_bt_prefs";
    private static final int MODE_SECURE_SPP = 1;
    private static final int MODE_INSECURE_SPP = 2;
    private static final int MODE_REFLECTION_CH1 = 3;

    // Persistent keep-alive socket for instant printing & low battery overhead
    private final Object socketLock = new Object();
    private BluetoothSocket activeSocket = null;
    private String activeAddress = null;
    private volatile String preferredPrinterAddress = null;
    private final ConcurrentHashMap<String, Integer> preferredConnectModeMap = new ConcurrentHashMap<>();

    // WiFi / Hotspot LAN CSV Sync Server state
    private final Object wifiServerLock = new Object();
    private volatile boolean wifiServerRunning = false;
    private ServerSocket wifiHttpServer = null;
    private DatagramSocket wifiUdpSocket = null;
    private WifiManager.MulticastLock wifiServerMulticastLock = null;
    private int wifiHttpPort = WIFI_HTTP_PORT_START;
    private byte[] wifiHostedCsvBytes = new byte[0];
    private String wifiHostedFileName = "Products_SimpelKasir.csv";
    private String wifiHostedStoreName = "SimpelKasir";
    private int wifiHostedProductCount = 0;
    private String wifiHostedDataType = "products_csv";

    @Override
    public void load() {
        super.load();
        registerBtStateMonitor();
        cleanupShareTempCache();
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
        boolean isBase64 = Boolean.TRUE.equals(call.getBoolean("isBase64", false));
        if (fileName == null || fileName.isEmpty() || content == null) {
            call.reject("Nama file atau isi kosong.");
            return;
        }
        executor.execute(() -> {
            try {
                byte[] bytes = isBase64
                    ? Base64.decode(content, Base64.DEFAULT)
                    : content.getBytes(StandardCharsets.UTF_8);
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

    private boolean isPackageInstalled(PackageManager pm, String packageName) {
        try {
            pm.getPackageInfo(packageName, 0);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void cleanupShareTempCache() {
        try {
            File dir = new File(getContext().getCacheDir(), "shared_temp");
            if (dir.exists() && dir.isDirectory()) {
                File[] old = dir.listFiles();
                if (old != null) {
                    for (File f : old) {
                        //noinspection ResultOfMethodCallIgnored
                        f.delete();
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void shareImageFile(PluginCall call) {
        String fileName = sanitizeFileName(call.getString("fileName", "Laporan_SimpelKasir.png"), "Laporan_SimpelKasir.png");
        String base64 = call.getString("base64");
        String text = call.getString("text", "");
        boolean preferWhatsApp = Boolean.TRUE.equals(call.getBoolean("preferWhatsApp", false));
        String chooserTitle = call.getString("chooserTitle", "Kirim Gambar ke WhatsApp");
        if (chooserTitle == null || chooserTitle.trim().isEmpty()) {
            chooserTitle = "Kirim Gambar ke WhatsApp";
        }
        final String finalChooserTitle = chooserTitle;
        if (base64 == null || base64.isEmpty()) {
            call.reject("Data gambar kosong.");
            return;
        }

        executor.execute(() -> {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                Uri imageUri = null;

                // Utamakan FileProvider di cache internal (tidak memenuhi Galeri/Downloads HP)
                try {
                    cleanupShareTempCache();
                    File cacheSubDir = new File(getContext().getCacheDir(), "shared_temp");
                    if (!cacheSubDir.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        cacheSubDir.mkdirs();
                    }
                    File tempFile = new File(cacheSubDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(tempFile, false)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    imageUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        tempFile
                    );
                } catch (Throwable ignoredFileProvider) {
                    imageUri = null;
                }

                // Fallback MediaStore hanya jika FileProvider tidak tersedia di ROM tertentu
                if (imageUri == null) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SimpelKasir");
                        values.put(MediaStore.Images.Media.IS_PENDING, 1);
                    }
                    imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (imageUri == null) {
                        throw new IOException("Gagal menyiapkan gambar untuk dibagikan.");
                    }
                    try (OutputStream os = resolver.openOutputStream(imageUri)) {
                        if (os == null) throw new IOException("Stream gambar null.");
                        os.write(bytes);
                        os.flush();
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues done = new ContentValues();
                        done.put(MediaStore.Images.Media.IS_PENDING, 0);
                        resolver.update(imageUri, done, null, null);
                    }
                }

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("image/png");
                shareIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
                if (text != null && !text.isEmpty()) {
                    shareIntent.putExtra(Intent.EXTRA_TEXT, text);
                }
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                String targetPkg = null;
                if (preferWhatsApp) {
                    PackageManager pm = getContext().getPackageManager();
                    boolean hasWa = isPackageInstalled(pm, "com.whatsapp");
                    boolean hasWaBiz = isPackageInstalled(pm, "com.whatsapp.w4b");
                    if (hasWa && !hasWaBiz) {
                        targetPkg = "com.whatsapp";
                    } else if (hasWaBiz && !hasWa) {
                        targetPkg = "com.whatsapp.w4b";
                    }
                }

                Intent launchIntent;
                if (targetPkg != null) {
                    Intent directIntent = new Intent(shareIntent);
                    directIntent.setPackage(targetPkg);
                    launchIntent = directIntent;
                } else {
                    launchIntent = Intent.createChooser(shareIntent, finalChooserTitle);
                }
                Intent fallbackChooser = Intent.createChooser(shareIntent, finalChooserTitle);

                android.app.Activity act = getActivity();
                if (act != null && !act.isFinishing() && !act.isDestroyed()) {
                    act.runOnUiThread(() -> {
                        try {
                            act.startActivity(launchIntent);
                        } catch (Exception ignored) {
                            try {
                                act.startActivity(fallbackChooser);
                            } catch (Exception ignored2) {
                                try {
                                    fallbackChooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    getContext().startActivity(fallbackChooser);
                                } catch (Exception ignored3) {}
                            }
                        }
                    });
                } else {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        getContext().startActivity(launchIntent);
                    } catch (Exception ignored) {
                        fallbackChooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(fallbackChooser);
                    }
                }

                JSObject ok = new JSObject();
                ok.put("ok", true);
                ok.put("uri", imageUri.toString());
                call.resolve(ok);
            } catch (Throwable e) {
                call.reject("Gagal membagikan gambar: " + e.getMessage());
            }
        });
    }

    // =========================================================================
    // WIFI / HOTSPOT LOCAL CSV SYNC (CARA 1 - 1 WIFI / HOTSPOT TANPA INTERNET)
    // =========================================================================

    private WifiManager.MulticastLock acquireMulticastLock(String tag) {
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                WifiManager.MulticastLock lock = wm.createMulticastLock(tag);
                lock.setReferenceCounted(false);
                lock.acquire();
                return lock;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static void releaseMulticastLock(WifiManager.MulticastLock lock) {
        if (lock != null) {
            try {
                if (lock.isHeld()) {
                    lock.release();
                }
            } catch (Exception ignored) {}
        }
    }

    private static boolean isPrivateIpv4Candidate(InetAddress addr) {
        if (!(addr instanceof Inet4Address)) return false;
        if (addr.isLoopbackAddress() || addr.isLinkLocalAddress() || addr.isMulticastAddress() || addr.isAnyLocalAddress()) {
            return false;
        }
        String host = addr.getHostAddress();
        if (host == null || host.isEmpty()) return false;
        return addr.isSiteLocalAddress()
            || host.startsWith("192.168.")
            || host.startsWith("10.")
            || host.startsWith("172.");
    }

    private List<String> getLocalWifiIps() {
        List<String> preferred = new ArrayList<>();
        List<String> others = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces != null && ifaces.hasMoreElements()) {
                NetworkInterface iface = ifaces.nextElement();
                if (!iface.isUp() || iface.isLoopback()) continue;
                String name = iface.getName() == null ? "" : iface.getName().toLowerCase(Locale.ROOT);
                if (name.contains("rmnet") || name.contains("ccmni") || name.contains("tun") || name.contains("dummy") || name.startsWith("v4-")) {
                    continue;
                }
                Enumeration<InetAddress> addrs = iface.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (isPrivateIpv4Candidate(addr)) {
                        String hostAddr = addr.getHostAddress();
                        if (hostAddr != null && !hostAddr.isEmpty()) {
                            if (name.contains("wlan") || name.contains("ap") || name.contains("swlan") || name.contains("softap") || name.contains("wifi") || name.contains("p2p")) {
                                if (!preferred.contains(hostAddr)) preferred.add(hostAddr);
                            } else {
                                if (!others.contains(hostAddr)) others.add(hostAddr);
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        // Fallback via ConnectivityManager LinkProperties (useful on newer Android hotspot/tethering)
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network[] networks = cm.getAllNetworks();
                for (Network net : networks) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                    if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                        && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        continue;
                    }
                    LinkProperties lp = cm.getLinkProperties(net);
                    if (lp == null) continue;
                    String ifaceName = lp.getInterfaceName() == null ? "" : lp.getInterfaceName().toLowerCase(Locale.ROOT);
                    if (ifaceName.contains("rmnet") || ifaceName.contains("ccmni")) continue;
                    for (LinkAddress la : lp.getLinkAddresses()) {
                        InetAddress addr = la.getAddress();
                        if (isPrivateIpv4Candidate(addr)) {
                            String hostAddr = addr.getHostAddress();
                            if (hostAddr != null && !preferred.contains(hostAddr) && !others.contains(hostAddr)) {
                                if (ifaceName.contains("wlan") || ifaceName.contains("ap") || ifaceName.contains("swlan") || ifaceName.contains("wifi")) {
                                    preferred.add(hostAddr);
                                } else {
                                    others.add(hostAddr);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        // Fallback via WifiManager IPv4 int
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                WifiInfo wifiInfo = wm.getConnectionInfo();
                if (wifiInfo != null) {
                    int ipInt = wifiInfo.getIpAddress();
                    if (ipInt != 0) {
                        String wifiIp = String.format(
                            Locale.US,
                            "%d.%d.%d.%d",
                            (ipInt & 0xff),
                            (ipInt >> 8 & 0xff),
                            (ipInt >> 16 & 0xff),
                            (ipInt >> 24 & 0xff)
                        );
                        if (!"0.0.0.0".equals(wifiIp) && !preferred.contains(wifiIp) && !others.contains(wifiIp)) {
                            preferred.add(wifiIp);
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
            releaseMulticastLock(wifiServerMulticastLock);
            wifiServerMulticastLock = null;
        }
    }

    private void handleWifiHttpClient(Socket client) {
        try {
            client.setSoTimeout(10000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
            String requestLine = reader.readLine();
            if (requestLine == null) return;
            // Drain incoming HTTP request headers cleanly so client never receives TCP RST
            String headerLine;
            int guard = 0;
            while (guard < 64 && (headerLine = reader.readLine()) != null && !headerLine.isEmpty()) {
                guard++;
            }

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
                String contentType = wifiHostedFileName.toLowerCase(Locale.ROOT).endsWith(".json")
                    ? "application/json; charset=utf-8"
                    : "text/csv; charset=utf-8";
                String headers =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Disposition: attachment; filename=\"" + wifiHostedFileName + "\"\r\n" +
                    "Content-Length: " + body.length + "\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n\r\n";
                os.write(headers.getBytes(StandardCharsets.US_ASCII));
                int chunk = 16384;
                for (int offset = 0; offset < body.length; offset += chunk) {
                    int len = Math.min(chunk, body.length - offset);
                    os.write(body, offset, len);
                }
                os.flush();
            } else if ("/info".equals(path) || "/ping".equals(path)) {
                JSONObject info = new JSONObject();
                info.put("ok", true);
                info.put("app", "SimpelKasir");
                info.put("storeName", wifiHostedStoreName);
                info.put("deviceName", Build.MODEL != null ? Build.MODEL : "Android");
                info.put("productCount", wifiHostedProductCount);
                info.put("fileName", wifiHostedFileName);
                info.put("dataType", wifiHostedDataType);
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
                    + "<h2>SimpelKasir - Sinkron Data</h2>"
                    + "<p>Data siap diunduh dari <b>" + wifiHostedStoreName + "</b></p>"
                    + "<p><a href='/download' style='display:inline-block;padding:12px 20px;background:#165B49;color:#fff;text-decoration:none;border-radius:10px;font-weight:bold'>Download " + wifiHostedFileName + "</a></p>"
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
        String dataType = call.getString("dataType", "products_csv");

        if (content == null || content.isEmpty()) {
            call.reject("Data yang akan dikirim kosong.");
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
                wifiHostedDataType = (dataType != null && !dataType.isEmpty()) ? dataType : "products_csv";
                wifiHttpServer = openedHttp;
                wifiHttpPort = chosenPort;
                wifiServerRunning = true;
                wifiServerMulticastLock = acquireMulticastLock("SimpelKasirWifiServer");
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

            // UDP responder for instant auto-discovery on the same WiFi/Hotspot
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
                                    resp.put("dataType", wifiHostedDataType);
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
                // UDP discovery socket optional; HTTP subnet scan & manual IP:port always work
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
            ret.put("dataType", wifiHostedDataType);
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

    private JSObject probeHttpPeerInfo(String ip, int port) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL("http://" + ip + ":" + port + "/info").openConnection();
            conn.setConnectTimeout(240);
            conn.setReadTimeout(450);
            conn.setRequestProperty("Connection", "close");
            if (conn.getResponseCode() == 200) {
                try (InputStream is = conn.getInputStream();
                     ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[2048];
                    int n;
                    while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                    JSONObject json = new JSONObject(bos.toString(StandardCharsets.UTF_8.name()));
                    if ("SimpelKasir".equals(json.optString("app"))) {
                        JSObject peer = new JSObject();
                        peer.put("ip", ip);
                        peer.put("port", json.optInt("port", port));
                        peer.put("storeName", json.optString("storeName", "SimpelKasir"));
                        peer.put("deviceName", json.optString("deviceName", "Android"));
                        peer.put("productCount", json.optInt("productCount", 0));
                        peer.put("fileName", json.optString("fileName", "Products_SimpelKasir.csv"));
                        peer.put("dataType", json.optString("dataType", "products_csv"));
                        return peer;
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    @PluginMethod
    public void discoverWifiCsvServers(PluginCall call) {
        wifiExecutor.execute(() -> {
            Map<String, JSObject> found = new ConcurrentHashMap<>();
            WifiManager.MulticastLock discoverLock = acquireMulticastLock("SimpelKasirWifiDiscover");
            List<String> selfIps = getLocalWifiIps();
            Set<String> selfSet = new HashSet<>(selfIps);

            // Launch parallel HTTP subnet scan fallback (works even if Hotspot/WiFi blocks UDP broadcasts!)
            ExecutorService httpScanPool = Executors.newFixedThreadPool(40);
            List<Future<?>> httpFutures = new ArrayList<>();
            try {
                List<String> subnetPrefixes = new ArrayList<>();
                for (String myIp : selfIps) {
                    int dot = myIp.lastIndexOf('.');
                    if (dot > 0) {
                        String pfx = myIp.substring(0, dot + 1);
                        if (!subnetPrefixes.contains(pfx) && subnetPrefixes.size() < 2) {
                            subnetPrefixes.add(pfx);
                        }
                    }
                }
                Set<String> httpProbeHosts = new LinkedHashSet<>();
                httpProbeHosts.add("192.168.43.1");
                httpProbeHosts.add("192.168.137.1");
                httpProbeHosts.add("192.168.49.1");
                for (String pfx : subnetPrefixes) {
                    httpProbeHosts.add(pfx + "1");
                    for (int host = 2; host <= 254; host++) {
                        httpProbeHosts.add(pfx + host);
                    }
                }
                for (String hostIp : httpProbeHosts) {
                    if (selfSet.contains(hostIp)) continue;
                    httpFutures.add(httpScanPool.submit(() -> {
                        JSObject peer = probeHttpPeerInfo(hostIp, WIFI_HTTP_PORT_START);
                        if (peer != null) {
                            found.put(hostIp + ":" + WIFI_HTTP_PORT_START, peer);
                        }
                    }));
                }

                // Simultaneously run UDP broadcast discovery
                DatagramSocket sock = null;
                try {
                    sock = new DatagramSocket();
                    sock.setBroadcast(true);
                    sock.setSoTimeout(300);

                    Set<String> targets = new HashSet<>();
                    targets.add("255.255.255.255");
                    targets.add("192.168.43.1");
                    targets.add("192.168.43.255");
                    targets.add("192.168.137.1");
                    targets.add("192.168.137.255");
                    targets.add("192.168.49.1");
                    for (String pfx : subnetPrefixes) {
                        targets.add(pfx + "1");
                        targets.add(pfx + "255");
                    }

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
                        long roundEnd = start + (round == 0 ? 550 : 1200);
                        byte[] recvBuf = new byte[2048];
                        while (System.currentTimeMillis() < roundEnd) {
                            try {
                                DatagramPacket pkt = new DatagramPacket(recvBuf, recvBuf.length);
                                sock.receive(pkt);
                                String raw = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8).trim();
                                JSONObject json = new JSONObject(raw);
                                if ("SimpelKasir".equals(json.optString("app"))) {
                                    String ip = json.optString("ip", pkt.getAddress().getHostAddress());
                                    if (selfSet.contains(ip)) continue;
                                    int port = json.optInt("port", WIFI_HTTP_PORT_START);
                                    String key = ip + ":" + port;
                                    JSObject peer = new JSObject();
                                    peer.put("ip", ip);
                                    peer.put("port", port);
                                    peer.put("storeName", json.optString("storeName", "SimpelKasir"));
                                    peer.put("deviceName", json.optString("deviceName", "Android"));
                                    peer.put("productCount", json.optInt("productCount", 0));
                                    peer.put("fileName", json.optString("fileName", "Products_SimpelKasir.csv"));
                                    peer.put("dataType", json.optString("dataType", "products_csv"));
                                    found.put(key, peer);
                                }
                            } catch (SocketTimeoutException ignored) {
                                break;
                            } catch (Exception ignored) {}
                        }
                    }
                } catch (Exception ignored) {
                } finally {
                    if (sock != null) {
                        try {
                            sock.close();
                        } catch (Exception ignored) {}
                    }
                }

                // Wait briefly for HTTP subnet probes to wrap up (max ~1.2s more)
                long deadline = System.currentTimeMillis() + 1200;
                for (Future<?> f : httpFutures) {
                    long rem = deadline - System.currentTimeMillis();
                    if (rem <= 0) break;
                    try {
                        f.get(rem, TimeUnit.MILLISECONDS);
                    } catch (Exception ignored) {}
                }
            } finally {
                httpScanPool.shutdownNow();
                releaseMulticastLock(discoverLock);
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
            String base = rawAddress.trim().replaceAll("\\s+", "");
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
            String dataType = "products_csv";
            try {
                HttpURLConnection infoConn = (HttpURLConnection) new URL(baseUrl + "/info").openConnection();
                infoConn.setConnectTimeout(3000);
                infoConn.setReadTimeout(4000);
                infoConn.setRequestProperty("Connection", "close");
                if (infoConn.getResponseCode() == 200) {
                    try (InputStream is = infoConn.getInputStream();
                         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                        JSONObject info = new JSONObject(bos.toString(StandardCharsets.UTF_8.name()));
                        storeName = info.optString("storeName", storeName);
                        remoteFileName = info.optString("fileName", "");
                        dataType = info.optString("dataType", "products_csv");
                    }
                }
                infoConn.disconnect();
            } catch (Exception ignored) {}

            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(baseUrl + "/download").openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(20000);
                conn.setRequestProperty("Connection", "close");
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
                if (csvContent.startsWith("\uFEFF")) {
                    csvContent = csvContent.substring(1);
                }
                if (csvContent.trim().isEmpty()) {
                    throw new IOException("File yang diterima kosong.");
                }

                String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
                boolean wantsJson = (remoteFileName != null && remoteFileName.toLowerCase(Locale.ROOT).endsWith(".json"))
                    || (overrideFileName != null && overrideFileName.toLowerCase(Locale.ROOT).endsWith(".json"))
                    || "full_backup".equals(dataType)
                    || "customers_json".equals(dataType)
                    || "quick_carts".equals(dataType)
                    || "transactions_cashflow".equals(dataType)
                    || "master_settings".equals(dataType)
                    || csvContent.trim().startsWith("{");
                String defaultName = wantsJson
                    ? ("SimpelKasir_Data_" + stamp + ".json")
                    : ("Products_SimpelKasir_" + stamp + ".csv");
                String chosenName = (overrideFileName != null && !overrideFileName.trim().isEmpty())
                    ? overrideFileName.trim()
                    : (!remoteFileName.isEmpty() ? remoteFileName : defaultName);
                chosenName = sanitizeFileName(chosenName, defaultName);
                String lowerChosen = chosenName.toLowerCase(Locale.ROOT);
                if (!lowerChosen.endsWith(".csv") && !lowerChosen.endsWith(".json")) {
                    chosenName = chosenName + (wantsJson ? ".json" : ".csv");
                }
                String saveMime = chosenName.toLowerCase(Locale.ROOT).endsWith(".json")
                    ? "application/json"
                    : "text/csv";

                String savedPath = "";
                String saveWarning = "";
                if (saveToSimpelKasir) {
                    try {
                        savedPath = writeBytesToDownloads(chosenName, csvBytes, saveMime, "SimpelKasir");
                    } catch (Exception saveErr) {
                        saveWarning = saveErr.getMessage() != null ? saveErr.getMessage() : "Gagal tulis ke Download";
                        try {
                            File appDl = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                            if (appDl != null) {
                                File subDir = new File(appDl, "SimpelKasir");
                                if (!subDir.exists()) subDir.mkdirs();
                                File outFile = new File(subDir, chosenName);
                                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                                    fos.write(csvBytes);
                                    fos.flush();
                                }
                                savedPath = "Android/data/.../SimpelKasir/" + chosenName;
                            }
                        } catch (Exception ignored) {}
                    }
                }

                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("content", csvContent);
                res.put("fileName", chosenName);
                res.put("savedPath", savedPath);
                res.put("storeName", storeName);
                res.put("dataType", dataType);
                if (!saveWarning.isEmpty()) {
                    res.put("saveWarning", saveWarning);
                }
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Gagal menerima data dari " + base + " (" + e.getClass().getSimpleName() + ": " + e.getMessage() + "). Pastikan ke-2 HP di WiFi/Hotspot sama dan mode Kirim masih terbuka.");
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
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

    private int getSavedConnectMode(String address) {
        if (address == null || address.isEmpty()) return 0;
        Integer cached = preferredConnectModeMap.get(address);
        if (cached != null) return cached;
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_BT, Context.MODE_PRIVATE);
            int saved = prefs.getInt("bt_mode_v2_" + address, 0);
            if (saved >= MODE_SECURE_SPP && saved <= MODE_REFLECTION_CH1) {
                preferredConnectModeMap.put(address, saved);
                return saved;
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private void savePreferredConnectMode(String address, int mode) {
        if (address == null || address.isEmpty()) return;
        preferredConnectModeMap.put(address, mode);
        try {
            getContext()
                .getSharedPreferences(PREFS_BT, Context.MODE_PRIVATE)
                .edit()
                .putInt("bt_mode_v2_" + address, mode)
                .apply();
        } catch (Exception ignored) {}
    }

    private static void safeCloseSocket(BluetoothSocket s) {
        if (s != null) {
            try {
                s.close();
            } catch (Exception ignored) {}
        }
    }

    private BluetoothSocket tryOpenSocketByMode(BluetoothDevice device, int mode) throws Exception {
        BluetoothSocket socket = null;
        try {
            if (mode == MODE_REFLECTION_CH1) {
                Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                socket = (BluetoothSocket) m.invoke(device, 1);
            } else if (mode == MODE_INSECURE_SPP) {
                socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            } else {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            }
            if (socket == null) {
                throw new IOException("Gagal membuat socket RFCOMM mode " + mode);
            }
            socket.connect();
            return socket;
        } catch (Exception e) {
            safeCloseSocket(socket);
            throw e;
        }
    }

    private BluetoothSocket connectWithFallback(BluetoothAdapter adapter, BluetoothDevice device, int attempt) throws Exception {
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

        String address = device.getAddress();
        int savedMode = getSavedConnectMode(address);
        // Prefer direct RFCOMM Channel 1 first: bypasses slow (~6s) Samsung SDP lookup while falling back cleanly if needed.
        int[] tryOrder;
        if (savedMode != 0) {
            if (attempt > 1) {
                // On busy retries (e.g. printer currently used by another phone), avoid multi-mode SDP stalls.
                tryOrder = new int[] { savedMode };
            } else if (savedMode == MODE_REFLECTION_CH1) {
                tryOrder = new int[] { MODE_REFLECTION_CH1, MODE_INSECURE_SPP };
            } else {
                tryOrder = new int[] { savedMode, MODE_REFLECTION_CH1 };
            }
        } else {
            tryOrder = new int[] { MODE_REFLECTION_CH1, MODE_INSECURE_SPP, MODE_SECURE_SPP };
        }

        Exception lastError = null;
        for (int mode : tryOrder) {
            long t0 = System.currentTimeMillis();
            try {
                BluetoothSocket s = tryOpenSocketByMode(device, mode);
                long elapsed = System.currentTimeMillis() - t0;
                // Only cache slow SDP modes if direct Channel 1 wasn't already working or skipped
                if (savedMode == 0 || (mode != savedMode && elapsed <= 2500)) {
                    savePreferredConnectMode(address, mode);
                }
                return s;
            } catch (Exception e) {
                lastError = e;
            }
        }

        throw (lastError != null) ? lastError : new IOException("Tidak dapat membuka koneksi RFCOMM ke printer.");
    }

    private BluetoothSocket openFreshSocket(BluetoothAdapter adapter, String address, int attempt) throws Exception {
        synchronized (socketLock) {
            closeActiveSocketLocked();
            BluetoothDevice device = adapter.getRemoteDevice(address);
            BluetoothSocket s = connectWithFallback(adapter, device, attempt);
            activeSocket = s;
            activeAddress = address;
            return s;
        }
    }

    private BluetoothSocket ensureConnectedSocket(BluetoothAdapter adapter, String address) throws Exception {
        return openFreshSocket(adapter, address, 1);
    }

    private void writePayloadSafe(BluetoothSocket socket, byte[] payload) throws Exception {
        OutputStream os = socket.getOutputStream();
        // Send in compact 256-byte chunks with gentle pacing so small 2KB thermal printer buffers never overflow or freeze mid-receipt
        int chunkSize = 256;
        for (int i = 0; i < payload.length; i += chunkSize) {
            int len = Math.min(chunkSize, payload.length - i);
            os.write(payload, i, len);
            os.flush();
            if (i + len < payload.length) {
                Thread.sleep(24);
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
            // Up to 5 polite attempts with progressive backoff so up to 5 phones sharing 1 printer queue smoothly without collision
            int[] retryDelaysMs = { 500, 900, 1300, 1700 };
            for (int attempt = 1; attempt <= 5; attempt++) {
                boolean writeStarted = false;
                try {
                    BluetoothSocket socket = openFreshSocket(adapter, address, attempt);
                    // Short RFCOMM link settle pause so dual-mode Bluetooth printer chips never miss initial ESC @ header
                    Thread.sleep(70);
                    writeStarted = true;
                    writePayloadSafe(socket, payload);

                    // Adaptive RFCOMM drain wait proportional to receipt length so socket.close() never cuts printing mid-receipt
                    int drainMs = Math.min(4800, Math.max(950, 750 + payload.length));
                    Thread.sleep(drainMs);
                    try {
                        socket.getOutputStream().flush();
                    } catch (Exception ignored) {}
                    closeActiveSocket();

                    JSObject ok = new JSObject();
                    ok.put("ok", true);
                    call.resolve(ok);
                    return;
                } catch (Exception e) {
                    lastErr = e;
                    closeActiveSocket();
                    if (writeStarted) {
                        // Do not blindly duplicate a half-printed receipt if connection dropped mid-stream
                        break;
                    }
                    if (attempt <= retryDelaysMs.length) {
                        try {
                            Thread.sleep(retryDelaysMs[attempt - 1]);
                        } catch (InterruptedException ignored) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            }
            call.reject("Printer sedang sibuk dipakai HP lain atau belum menyala. Coba ketuk Cetak lagi. (" +
                (lastErr != null ? lastErr.getMessage() : "Koneksi terputus") + ")");
        });
    }

    // =========================================================================
    // OFFLINE DEVICE-LOCKED LICENSING (CARA 1 - TANPA SERVER)
    // =========================================================================

    private static final String LIC_PREFS_NAME = "simpelkasir_lic_prefs";
    private static final String LIC_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private long lastElapsedSampleMs = -1L;

    private String computeShortDeviceId(String rawSeed) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(("SK_DEV_V1::" + rawSeed).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("SK-");
            for (int i = 0; i < 8; i++) {
                int idx = (hash[i] & 0xFF) % LIC_ALPHABET.length();
                sb.append(LIC_ALPHABET.charAt(idx));
                if (i == 3) sb.append('-');
            }
            return sb.toString();
        } catch (Exception e) {
            String clean = rawSeed.replaceAll("[^a-zA-Z0-9]", "").toUpperCase(Locale.ROOT);
            while (clean.length() < 8) clean += "7";
            return "SK-" + clean.substring(0, 4) + "-" + clean.substring(4, 8);
        }
    }

    private long[] syncAndAdvanceClock(SharedPreferences prefs) {
        long wallNow = System.currentTimeMillis();
        long elapsedNow = SystemClock.elapsedRealtime();
        long elapsedDelta = 0L;
        if (lastElapsedSampleMs >= 0L && elapsedNow >= lastElapsedSampleMs) {
            elapsedDelta = elapsedNow - lastElapsedSampleMs;
        }
        lastElapsedSampleMs = elapsedNow;

        long prevMax = prefs.getLong("maxSeenMs", 0L);
        long trialStartMs = prefs.getLong("trialStartMs", 0L);
        if (trialStartMs <= 0L) {
            trialStartMs = wallNow;
            prefs.edit().putLong("trialStartMs", trialStartMs).apply();
        }

        // Detect deliberate clock rollback (> 5 minutes earlier than highest recorded time)
        boolean rollbackDetected = prevMax > 0L && wallNow < (prevMax - 300_000L);

        // Advance monotonic high-water timestamp even if wall clock is frozen or rolled back
        long candidateMax = prevMax > 0L ? (prevMax + elapsedDelta) : wallNow;
        long nextMax = Math.max(wallNow, Math.max(trialStartMs, candidateMax));
        if (nextMax > prevMax) {
            prefs.edit().putLong("maxSeenMs", nextMax).apply();
        }
        return new long[]{trialStartMs, nextMax, rollbackDetected ? 1L : 0L, wallNow};
    }

    @PluginMethod
    public void getDeviceLicenseInfo(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(LIC_PREFS_NAME, Context.MODE_PRIVATE);
            String deviceId = prefs.getString("deviceId", "");
            if (deviceId == null || deviceId.isEmpty()) {
                String androidId = "";
                try {
                    androidId = Settings.Secure.getString(
                        getContext().getContentResolver(),
                        Settings.Secure.ANDROID_ID
                    );
                } catch (Exception ignored) {}
                if (androidId == null || androidId.isEmpty() || "9774d56d682e549c".equalsIgnoreCase(androidId)) {
                    androidId = UUID.randomUUID().toString();
                }
                deviceId = computeShortDeviceId(androidId);
                prefs.edit().putString("deviceId", deviceId).apply();
            }

            long[] clockState = syncAndAdvanceClock(prefs);
            String activationCode = prefs.getString("activationCode", "");

            JSObject res = new JSObject();
            res.put("deviceId", deviceId);
            res.put("trialStartMs", clockState[0]);
            res.put("maxSeenMs", clockState[1]);
            res.put("clockRollbackDetected", clockState[2] == 1L);
            res.put("wallNowMs", clockState[3]);
            res.put("activationCode", activationCode != null ? activationCode : "");
            call.resolve(res);
        } catch (Throwable e) {
            call.reject("Gagal membaca info lisensi perangkat: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pingLicenseClock(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(LIC_PREFS_NAME, Context.MODE_PRIVATE);
            long[] clockState = syncAndAdvanceClock(prefs);
            JSObject res = new JSObject();
            res.put("trialStartMs", clockState[0]);
            res.put("maxSeenMs", clockState[1]);
            res.put("clockRollbackDetected", clockState[2] == 1L);
            res.put("wallNowMs", clockState[3]);
            call.resolve(res);
        } catch (Throwable e) {
            call.reject("Gagal sinkron waktu lisensi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveNativeLicense(PluginCall call) {
        String activationCode = call.getString("activationCode", "");
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(LIC_PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString("activationCode", activationCode != null ? activationCode : "").apply();
            JSObject ok = new JSObject();
            ok.put("ok", true);
            call.resolve(ok);
        } catch (Throwable e) {
            call.reject("Gagal menyimpan lisensi perangkat: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        cleanupShareTempCache();
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
