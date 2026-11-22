package com.tokocahaya.simpelkasir;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
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
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN, Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "bluetoothScan", strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN })
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager != null ? manager.getAdapter() : BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasBtPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (!hasBtPermissions()) {
            requestPermissionForAlias(Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetoothScan" : "bluetooth", call, "btPermCallback");
            return;
        }
        resolvePaired(call);
    }

    @PermissionCallback
    private void btPermCallback(PluginCall call) {
        if (hasBtPermissions()) resolvePaired(call);
        else call.reject("Izin Bluetooth diperlukan untuk mencari printer thermal.");
    }

    private void resolvePaired(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) { call.reject("Perangkat tidak mendukung Bluetooth."); return; }
        if (!adapter.isEnabled()) { call.reject("Aktifkan Bluetooth di HP terlebih dahulu."); return; }
        try {
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSArray arr = new JSArray();
            if (bonded != null) {
                for (BluetoothDevice dev : bonded) {
                    JSObject obj = new JSObject();
                    obj.put("name", dev.getName() != null ? dev.getName() : "Printer Bluetooth");
                    obj.put("address", dev.getAddress());
                    arr.put(obj);
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", arr);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Izin Bluetooth ditolak: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBytes(PluginCall call) {
        String address = call.getString("address");
        String b64 = call.getString("base64");
        if (address == null || address.isEmpty() || b64 == null) { call.reject("Alamat printer atau data kosong."); return; }
        sendRawBytes(address, Base64.decode(b64, Base64.DEFAULT), call);
    }

    @PluginMethod
    public void testPrint(PluginCall call) {
        String address = call.getString("address");
        String paperWidth = call.getString("paperWidth", "58");
        if (address == null || address.isEmpty()) { call.reject("Pilih printer terlebih dahulu."); return; }
        String dash = "80".equals(paperWidth) ? "------------------------------------------------\n" : "--------------------------------\n";
        String sample = "\u001B@\u001Ba\u0001\u001BE\u0001SimpelKasir\n\u001BE\u0000TEST PRINT BERHASIL\n" + dash + "Kertas: " + paperWidth + " mm\nPrinter Bluetooth Siap!\n\n\n\n";
        sendRawBytes(address, sample.getBytes(StandardCharsets.US_ASCII), call);
    }

    private void sendRawBytes(String address, byte[] payload, PluginCall call) {
        if (!hasBtPermissions()) { call.reject("Izin Bluetooth belum diberikan."); return; }
        executor.execute(() -> {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null || !adapter.isEnabled()) { call.reject("Bluetooth tidak aktif."); return; }
            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                try { adapter.cancelDiscovery(); } catch (SecurityException ignored) {}
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
                OutputStream os = socket.getOutputStream();
                for (int i = 0; i < payload.length; i += 512) {
                    os.write(payload, i, Math.min(512, payload.length - i));
                    os.flush();
                    Thread.sleep(20);
                }
                Thread.sleep(150);
                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
            } catch (Exception e) {
                call.reject("Gagal cetak: " + e.getMessage());
            } finally {
                if (socket != null) { try { socket.close(); } catch (Exception ignored) {} }
            }
        });
    }
}
