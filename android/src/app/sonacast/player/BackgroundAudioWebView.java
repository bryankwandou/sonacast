package app.sonacast.player;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import android.webkit.WebView;

/**
 * Custom WebView that prevents Chromium from throttling JavaScript timers or
 * suspending audio playback when the app moves to background or the screen locks.
 */
public class BackgroundAudioWebView extends WebView {
    private boolean keepAliveInBackground = true;

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
        if (keepAliveInBackground && visibility != View.GONE) {
            super.onWindowVisibilityChanged(View.VISIBLE);
            return;
        }
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
}

