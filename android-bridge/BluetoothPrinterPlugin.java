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

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
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
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private BroadcastReceiver activeDiscoveryReceiver = null;
    private BroadcastReceiver btStateReceiver = null;

    // Persistent keep-alive socket for instant printing & low battery overhead
    private final Object socketLock = new Object();
    private BluetoothSocket activeSocket = null;
    private String activeAddress = null;
    private volatile String preferredPrinterAddress = null;

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

    @PluginMethod
    public void saveFileToDownloads(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (fileName == null || fileName.isEmpty() || content == null) {
            call.reject("Nama file atau isi kosong.");
            return;
        }
        executor.execute(() -> {
            try {
                byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
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
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File outFile = new File(dir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                }
                JSObject ok = new JSObject();
                ok.put("ok", true);
                ok.put("path", "Download/" + fileName);
                call.resolve(ok);
            } catch (Exception e) {
                call.reject("Gagal menyimpan ke folder Download: " + e.getMessage());
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
        cleanupDiscoveryReceiver();
        if (btStateReceiver != null) {
            try {
                getContext().unregisterReceiver(btStateReceiver);
            } catch (Exception ignored) {}
            btStateReceiver = null;
        }
        closeActiveSocket();
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
