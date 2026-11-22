package app.sonacast.player;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import android.webkit.WebView;

/**
 * Custom WebView that prevents Android Chromium from dropping renderer visibility,
 * throttling JavaScript timers, or suspending YouTube/HTML5 audio when the user
 * switches to another app or turns off the screen.
 */
public class BackgroundAudioWebView extends WebView {
    private volatile boolean keepAliveInBackground = true;

    public BackgroundAudioWebView(Context context) {
        super(context);
    }

    public BackgroundAudioWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public void setKeepAliveInBackground(boolean keepAlive) {
        this.keepAliveInBackground = keepAlive;
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        if (keepAliveInBackground) {
            super.onWindowVisibilityChanged(View.VISIBLE);
            return;
        }
        super.onWindowVisibilityChanged(visibility);
    }

    @Override
    public void dispatchWindowVisibilityChanged(int visibility) {
        if (keepAliveInBackground) {
            super.dispatchWindowVisibilityChanged(View.VISIBLE);
            return;
        }
        super.dispatchWindowVisibilityChanged(visibility);
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        if (keepAliveInBackground) {
            super.onVisibilityChanged(changedView, View.VISIBLE);
            return;
        }
        super.onVisibilityChanged(changedView, visibility);
    }

    @Override
    public void onWindowFocusChanged(boolean hasWindowFocus) {
        if (keepAliveInBackground) {
            super.onWindowFocusChanged(true);
            return;
        }
        super.onWindowFocusChanged(hasWindowFocus);
    }

    @Override
    public void onPause() {
        if (keepAliveInBackground) {
            return;
        }
        super.onPause();
    }

    @Override
    public void pauseTimers() {
        if (keepAliveInBackground) {
            return;
        }
        super.pauseTimers();
    }
}
