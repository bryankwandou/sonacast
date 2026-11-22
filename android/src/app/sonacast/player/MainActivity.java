package app.sonacast.player;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Rational;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity implements PlaybackForegroundService.MediaActionListener {
    private static final String SONACAST_ORIGIN = "https://sonacast-ten.vercel.app/";
    private BackgroundAudioWebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean latestIsPlaying = false;
    private volatile boolean latestLowCpu = false;
    private volatile String latestTitle = "Sonacast";
    private volatile String latestArtist = "24/7 Audio Stream";
    private volatile boolean inBackground = false;
    private boolean serviceActivated = false;

    private final Runnable bgResumeKickRunnable = new Runnable() {
        @Override
        public void run() {
            if (!inBackground || !latestIsPlaying || webView == null) return;
            webView.onResume();
            webView.resumeTimers();
            webView.evaluateJavascript(
                "window.__sonacastAndroidBgKeepAlive && window.__sonacastAndroidBgKeepAlive();",
                null
            );
        }
    };

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
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Critical on Android 8+: prevent OS from waiving/freezing the Chromium WebView renderer process in background
        if (Build.VERSION.SDK_INT >= 26) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Remove '; wv' token so YouTube mobile embed does not trigger its WebView-specific background pause block
        String defaultUa = settings.getUserAgentString();
        if (defaultUa != null && defaultUa.contains("; wv")) {
            settings.setUserAgentString(defaultUa.replace("; wv", ""));
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (
                    host.endsWith("vercel.app")
                    || host.contains("youtube.com")
                    || host.contains("youtu.be")
                    || host.contains("googlevideo.com")
                    || host.contains("itunes.apple.com")
                    || host.contains("deezer.com")
                )) {
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

    private void pushForegroundServiceState(String title, String artist, boolean playing, boolean lowCpu) {
        Intent svc = new Intent(MainActivity.this, PlaybackForegroundService.class);
        svc.setAction(PlaybackForegroundService.ACTION_UPDATE);
        svc.putExtra(PlaybackForegroundService.EXTRA_TITLE, title);
        svc.putExtra(PlaybackForegroundService.EXTRA_ARTIST, artist);
        svc.putExtra(PlaybackForegroundService.EXTRA_PLAYING, playing);
        svc.putExtra(PlaybackForegroundService.EXTRA_LOW_CPU, lowCpu);
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(svc);
        } else {
            startService(svc);
        }
    }

    private void reinforceBackgroundPlayback() {
        inBackground = true;
        if (webView == null) return;
        webView.setKeepAliveInBackground(true);
        if (latestIsPlaying) {
            serviceActivated = true;
            pushForegroundServiceState(latestTitle, latestArtist, true, latestLowCpu);
            webView.onResume();
            webView.resumeTimers();
            webView.evaluateJavascript(
                "window.__sonacastAndroidBackgroundState && window.__sonacastAndroidBackgroundState(true);",
                null
            );
            mainHandler.removeCallbacks(bgResumeKickRunnable);
            mainHandler.postDelayed(bgResumeKickRunnable, 250L);
            mainHandler.postDelayed(bgResumeKickRunnable, 850L);
            mainHandler.postDelayed(bgResumeKickRunnable, 1800L);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        reinforceBackgroundPlayback();
    }

    @Override
    protected void onStop() {
        super.onStop();
        reinforceBackgroundPlayback();
    }

    @Override
    protected void onResume() {
        super.onResume();
        inBackground = false;
        mainHandler.removeCallbacks(bgResumeKickRunnable);
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
            webView.evaluateJavascript(
                "window.__sonacastAndroidBackgroundState && window.__sonacastAndroidBackgroundState(false);",
                null
            );
        }
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
        reinforceBackgroundPlayback();
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(bgResumeKickRunnable);
        PlaybackForegroundService.setMediaActionListener(null);
        if (webView != null) {
            webView.setKeepAliveInBackground(false);
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
        public boolean isInBackground() {
            return inBackground;
        }

        @JavascriptInterface
        public void syncPlaybackState(
            final String title,
            final String artist,
            final boolean isPlaying,
            final boolean lowCpuMode
        ) {
            latestTitle = (title != null && !title.isEmpty()) ? title : "Sonacast";
            latestArtist = (artist != null && !artist.isEmpty()) ? artist : "24/7 Audio Stream";
            latestIsPlaying = isPlaying;
            latestLowCpu = lowCpuMode;
            if (!isPlaying && !serviceActivated) {
                return;
            }
            serviceActivated = true;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pushForegroundServiceState(latestTitle, latestArtist, isPlaying, lowCpuMode);
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
