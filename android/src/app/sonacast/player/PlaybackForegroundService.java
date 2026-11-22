package app.sonacast.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

/**
 * High-priority Android foreground media service holding:
 * 1. FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK persistent lockscreen notification + MediaSession
 * 2. AudioManager AUDIOFOCUS_GAIN (USAGE_MEDIA / CONTENT_TYPE_MUSIC) with transient call handling
 * 3. Zero-amplitude MODE_STATIC AudioTrack keepalive in AudioFlinger (0% Java CPU) so Android 12-15
 *    App Freezer and OEM killers never freeze or mute the Chromium WebView audio renderer
 * 4. Partial CPU WakeLock + WifiLock held strictly while playing
 */
public class PlaybackForegroundService extends Service {
    public static final String CHANNEL_ID = "sonacast_playback_channel";
    public static final int NOTIFICATION_ID = 2025;

    public static final String ACTION_UPDATE = "app.sonacast.player.ACTION_UPDATE";
    public static final String ACTION_PREV = "app.sonacast.player.ACTION_PREV";
    public static final String ACTION_TOGGLE = "app.sonacast.player.ACTION_TOGGLE";
    public static final String ACTION_NEXT = "app.sonacast.player.ACTION_NEXT";
    public static final String ACTION_STOP = "app.sonacast.player.ACTION_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_LOW_CPU = "lowCpu";

    public interface MediaActionListener {
        void onMediaAction(String action);
    }

    private static volatile MediaActionListener actionListener;
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());

    public static void setMediaActionListener(MediaActionListener listener) {
        actionListener = listener;
    }

    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private NotificationManager notificationManager;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;
    private boolean pausedByTransientFocusLoss = false;
    private AudioTrack silentKeepaliveTrack;

    private String currentTitle = "Sonacast";
    private String currentArtist = "24/7 Audio Stream";
    private boolean currentPlaying = false;
    private boolean currentLowCpu = false;

    private final AudioManager.OnAudioFocusChangeListener focusChangeListener =
        new AudioManager.OnAudioFocusChangeListener() {
            @Override
            public void onAudioFocusChange(int focusChange) {
                if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
                    hasAudioFocus = false;
                    pausedByTransientFocusLoss = false;
                    if (currentPlaying) {
                        dispatchToWebView("pause");
                    }
                } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                    if (currentPlaying) {
                        pausedByTransientFocusLoss = true;
                        dispatchToWebView("pause");
                    }
                } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                    hasAudioFocus = true;
                    if (pausedByTransientFocusLoss) {
                        pausedByTransientFocusLoss = false;
                        dispatchToWebView("play");
                    }
                }
            }
        };

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sonacast:playback_wakelock");
            wakeLock.setReferenceCounted(false);
        }

        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            int wifiMode = Build.VERSION.SDK_INT >= 29
                ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
            wifiLock = wm.createWifiLock(wifiMode, "sonacast:playback_wifilock");
            wifiLock.setReferenceCounted(false);
        }

        mediaSession = new MediaSession(this, "SonacastMediaSession");
        mediaSession.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                dispatchToWebView("play");
            }

            @Override
            public void onPause() {
                dispatchToWebView("pause");
            }

            @Override
            public void onSkipToNext() {
                dispatchToWebView("next");
            }

            @Override
            public void onSkipToPrevious() {
                dispatchToWebView("prev");
            }

            @Override
            public void onStop() {
                dispatchToWebView("pause");
            }
        });
        mediaSession.setActive(true);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sonacast Background Audio",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps full-length playback active 24/7 in background and screen-off");
            channel.setShowBadge(false);
            notificationManager.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_PREV.equals(action)) {
                dispatchToWebView("prev");
            } else if (ACTION_TOGGLE.equals(action)) {
                dispatchToWebView("toggle");
            } else if (ACTION_NEXT.equals(action)) {
                dispatchToWebView("next");
            } else if (ACTION_STOP.equals(action)) {
                dispatchToWebView("pause");
                stopSilentAudioFlingerKeepalive();
                abandonAudioFocus();
                releaseLocks();
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            } else if (ACTION_UPDATE.equals(action)) {
                String t = intent.getStringExtra(EXTRA_TITLE);
                String a = intent.getStringExtra(EXTRA_ARTIST);
                if (t != null && !t.isEmpty()) currentTitle = t;
                if (a != null && !a.isEmpty()) currentArtist = a;
                currentPlaying = intent.getBooleanExtra(EXTRA_PLAYING, false);
                currentLowCpu = intent.getBooleanExtra(EXTRA_LOW_CPU, false);
            }
        }

        if (currentPlaying) {
            pausedByTransientFocusLoss = false;
            acquireLocks();
            requestAudioFocus();
            startSilentAudioFlingerKeepalive();
        } else {
            stopSilentAudioFlingerKeepalive();
            if (!pausedByTransientFocusLoss) {
                abandonAudioFocus();
            }
            releaseLocks();
        }

        updateMediaSessionState();
        Notification notification = buildMediaNotification();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    private void requestAudioFocus() {
        if (audioManager == null || hasAudioFocus) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(true)
                    .setWillPauseWhenDucked(false)
                    .setOnAudioFocusChangeListener(focusChangeListener, MAIN_HANDLER)
                    .build();
                int res = audioManager.requestAudioFocus(audioFocusRequest);
                hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            } else {
                @SuppressWarnings("deprecation")
                int res = audioManager.requestAudioFocus(
                    focusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                );
                hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            }
        } catch (Throwable ignored) {
            // Best-effort focus request
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null || !hasAudioFocus) return;
        try {
            if (Build.VERSION.SDK_INT >= 26 && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else {
                @SuppressWarnings("deprecation")
                int ignored = audioManager.abandonAudioFocus(focusChangeListener);
            }
        } catch (Throwable ignored) {
            // Ignore cleanup errors
        } finally {
            hasAudioFocus = false;
        }
    }

    private void startSilentAudioFlingerKeepalive() {
        try {
            if (silentKeepaliveTrack != null) {
                if (silentKeepaliveTrack.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) {
                    silentKeepaliveTrack.play();
                }
                return;
            }
            final int sampleRate = 16000;
            final int frameCount = 1600; // 100ms zero-amplitude static PCM loop
            final int byteCount = frameCount * 2;
            byte[] silence = new byte[byteCount];
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            AudioFormat fmt = new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();
            AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(attrs)
                .setAudioFormat(fmt)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(byteCount)
                .build();
            track.write(silence, 0, silence.length);
            track.setLoopPoints(0, frameCount, -1);
            track.setVolume(0.0f);
            track.play();
            silentKeepaliveTrack = track;
        } catch (Throwable ignored) {
            // Keep service running even if AudioTrack cannot initialize on an unusual device
        }
    }

    private void stopSilentAudioFlingerKeepalive() {
        AudioTrack track = silentKeepaliveTrack;
        silentKeepaliveTrack = null;
        if (track != null) {
            try {
                track.pause();
                track.stop();
                track.release();
            } catch (Throwable ignored) {
                // Ignore AudioTrack release errors
            }
        }
    }

    private void dispatchToWebView(final String action) {
        MAIN_HANDLER.post(new Runnable() {
            @Override
            public void run() {
                MediaActionListener listener = actionListener;
                if (listener != null) {
                    listener.onMediaAction(action);
                }
            }
        });
    }

    private void acquireLocks() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(8L * 60L * 60L * 1000L);
        }
        if (wifiLock != null && !wifiLock.isHeld()) {
            try {
                wifiLock.acquire();
            } catch (Throwable ignored) {
                // Ignore if device restricts WifiLock
            }
        }
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            try {
                wifiLock.release();
            } catch (Throwable ignored) {
                // Ignore
            }
        }
    }

    private void updateMediaSessionState() {
        if (mediaSession == null) return;
        MediaMetadata metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .build();
        mediaSession.setMetadata(metadata);

        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_STOP;
        int state = currentPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build();
        mediaSession.setPlaybackState(playbackState);
    }

    private PendingIntent serviceActionIntent(String action, int requestCode) {
        Intent i = new Intent(this, PlaybackForegroundService.class);
        i.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, requestCode, i, flags);
    }

    private Notification buildMediaNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Action prevAction = new Notification.Action.Builder(
            Icon.createWithResource(this, android.R.drawable.ic_media_previous),
            "Prev",
            serviceActionIntent(ACTION_PREV, 1)
        ).build();

        int toggleIcon = currentPlaying
            ? android.R.drawable.ic_media_pause
            : android.R.drawable.ic_media_play;
        String toggleLabel = currentPlaying ? "Pause" : "Play";
        Notification.Action toggleAction = new Notification.Action.Builder(
            Icon.createWithResource(this, toggleIcon),
            toggleLabel,
            serviceActionIntent(ACTION_TOGGLE, 2)
        ).build();

        Notification.Action nextAction = new Notification.Action.Builder(
            Icon.createWithResource(this, android.R.drawable.ic_media_next),
            "Next",
            serviceActionIntent(ACTION_NEXT, 3)
        ).build();

        String sub = currentLowCpu ? currentArtist + " | Eco 24/7" : currentArtist;

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        return builder
            .setContentTitle(currentTitle)
            .setContentText(sub)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentIntent(contentIntent)
            .setOngoing(currentPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(prevAction)
            .addAction(toggleAction)
            .addAction(nextAction)
            .setStyle(
                new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (!currentPlaying) {
            stopSelf();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopSilentAudioFlingerKeepalive();
        abandonAudioFocus();
        releaseLocks();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }
}
