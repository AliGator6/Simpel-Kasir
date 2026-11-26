package com.tokocahaya.simpelkasir;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
            }
        } catch (Exception ignored) {}

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (isFinishing() || isDestroyed()) {
                    return;
                }
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    finish();
                    return;
                }
                try {
                    webView.evaluateJavascript(
                        "(function(){ try { return typeof window.__handleAndroidBack === 'function' ? window.__handleAndroidBack() : 'exit'; } catch(e) { return 'exit'; } })()",
                        value -> {
                            if ("\"exit\"".equals(value) && !isFinishing() && !isDestroyed()) {
                                runOnUiThread(() -> {
                                    if (!isFinishing() && !isDestroyed()) {
                                        finish();
                                    }
                                });
                            }
                        }
                    );
                } catch (Exception e) {
                    if (!isFinishing() && !isDestroyed()) {
                        finish();
                    }
                }
            }
        });
    }
}
