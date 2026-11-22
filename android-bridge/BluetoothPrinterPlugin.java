package com.tokocahaya.simpelkasir;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
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

            // 1. Masukkan semua perangkat yang sudah di-pair (bonded)
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

            // 2. Jalankan Bluetooth Discovery untuk menangkap printer baru yang belum di-pair
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

                    // Tunggu maksimal 4.5 detik agar tidak terasa terlalu lama
                    latch.await(4500, TimeUnit.MILLISECONDS);
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

            // 3. Urutkan: Printer + Bonded paling atas
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
        executor.execute(() -> {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth HP tidak aktif.");
                return;
            }
            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = connectWithFallback(adapter, device);
                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
            } catch (Exception e) {
                call.reject("Gagal terhubung ke printer (" + address + "). Pastikan printer menyala & tidak terhubung ke HP lain. Detail: " + e.getMessage());
            } finally {
                closeQuietly(socket);
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
        if (address == null || address.isEmpty()) {
            call.reject("Pilih printer terlebih dahulu.");
            return;
        }
        String dash = "80".equals(paperWidth) ? "------------------------------------------------\n" : "--------------------------------\n";
        String sample =
            "\u001B@\u001Ba\u0001\u001BE\u0001SimpelKasir\n\u001BE\u0000" +
            "TEST PRINT BERHASIL\n" +
            dash +
            "Kertas: " + paperWidth + " mm\n" +
            "Printer Bluetooth Siap!\n\n\n\n";
        sendRawBytes(address, sample.getBytes(StandardCharsets.US_ASCII), call);
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
                Thread.sleep(350);
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

    private void closeQuietly(BluetoothSocket socket) {
        if (socket != null) {
            try {
                socket.close();
            } catch (Exception ignored) {}
        }
    }

    private void sendRawBytes(String address, byte[] payload, PluginCall call) {
        executor.execute(() -> {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth tidak aktif. Nyalakan Bluetooth di HP terlebih dahulu.");
                return;
            }
            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = connectWithFallback(adapter, device);
                Thread.sleep(100);

                OutputStream os = socket.getOutputStream();
                int chunkSize = 256;
                for (int i = 0; i < payload.length; i += chunkSize) {
                    int len = Math.min(chunkSize, payload.length - i);
                    os.write(payload, i, len);
                    os.flush();
                    Thread.sleep(18);
                }
                Thread.sleep(300);

                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
            } catch (Exception e) {
                call.reject("Gagal cetak ke printer: " + e.getMessage());
            } finally {
                closeQuietly(socket);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        cleanupDiscoveryReceiver();
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
