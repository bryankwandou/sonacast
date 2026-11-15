package app.sonacast.player;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Rational;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity implements PlaybackForegroundService.MediaActionListener {
    private static final String SONACAST_ORIGIN = "https://sonacast-ten.vercel.app/";
    private BackgroundAudioWebView webView;
    private volatile boolean latestIsPlaying = false;
    private boolean serviceActivated = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                    new String[] { android.Manifest.permission.POST_NOTIFICATIONS },
                    101
                );
            }
        }

        webView = new BackgroundAudioWebView(this);
        webView.setKeepAliveInBackground(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.endsWith("vercel.app") || host.contains("youtube.com") || host.contains("youtu.be"))) {
                    return false;
                }
                Intent ext = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(ext);
                return true;
            }
        });

        webView.addJavascriptInterface(new SonacastBridge(), "SonacastAndroid");
        PlaybackForegroundService.setMediaActionListener(this);
        setContentView(webView);
        webView.loadUrl(SONACAST_ORIGIN);
    }

    @Override
    public void onMediaAction(String action) {
        if (webView == null) return;
        String safeAction = action.replace("'", "");
        webView.evaluateJavascript(
            "window.__sonacastNativeMediaAction && window.__sonacastNativeMediaAction('" + safeAction + "');",
            null
        );
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (latestIsPlaying) {
            moveTaskToBack(true);
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (latestIsPlaying && Build.VERSION.SDK_INT >= 26) {
            // Optional automatic PiP stays opt-in via UI/bridge while background service keeps playing
        }
    }

    @Override
    protected void onDestroy() {
        PlaybackForegroundService.setMediaActionListener(null);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private class SonacastBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void syncPlaybackState(
            final String title,
            final String artist,
            final boolean isPlaying,
            final boolean lowCpuMode
        ) {
            latestIsPlaying = isPlaying;
            if (!isPlaying && !serviceActivated) {
                return;
            }
            serviceActivated = true;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent svc = new Intent(MainActivity.this, PlaybackForegroundService.class);
                    svc.setAction(PlaybackForegroundService.ACTION_UPDATE);
                    svc.putExtra(PlaybackForegroundService.EXTRA_TITLE, title);
                    svc.putExtra(PlaybackForegroundService.EXTRA_ARTIST, artist);
                    svc.putExtra(PlaybackForegroundService.EXTRA_PLAYING, isPlaying);
                    svc.putExtra(PlaybackForegroundService.EXTRA_LOW_CPU, lowCpuMode);
                    if (Build.VERSION.SDK_INT >= 26) {
                        startForegroundService(svc);
                    } else {
                        startService(svc);
                    }
                }
            });
        }

        @JavascriptInterface
        public void enterPip() {
            if (Build.VERSION.SDK_INT >= 26) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        PictureInPictureParams params = new PictureInPictureParams.Builder()
                            .setAspectRatio(new Rational(16, 9))
                            .build();
                        enterPictureInPictureMode(params);
                    }
                });
            }
        }

        @JavascriptInterface
        public void requestBatteryUnrestricted() {
            if (Build.VERSION.SDK_INT >= 23) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        i.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(i);
                    }
                });
            }
        }
    }
}

