package com.tokocahaya.simpelkasir;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    finish();
                    return;
                }
                webView.evaluateJavascript(
                    "(function(){ return typeof window.__handleAndroidBack === 'function' ? window.__handleAndroidBack() : 'exit'; })()",
                    value -> {
                        if ("\"exit\"".equals(value)) {
                            runOnUiThread(() -> finish());
                        }
                    }
                );
            }
        });
    }
}
