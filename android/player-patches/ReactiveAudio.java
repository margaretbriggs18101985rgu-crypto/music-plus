package com.guichaguri.trackplayer.service.player;

import android.content.Context;
import android.os.Handler;
import android.os.SystemClock;
import androidx.media3.common.C;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.exoplayer.audio.TeeAudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** Read-only PCM tap. No microphone permission, audio mutation, or JS frame traffic. */
@UnstableApi
public final class ReactiveAudio extends DefaultRenderersFactory implements TeeAudioProcessor.AudioBufferSink {
    private static volatile boolean enabled;
    private static volatile Frame latest = new Frame(0, 0, 0, 0, 0);
    private static ExoPlayer currentPlayer;
    private static TrackSelectionParameters.AudioOffloadPreferences savedOffload;
    private static int users;
    private int channels = 2, encoding = C.ENCODING_PCM_16BIT;
    private AudioBands bands = new AudioBands(44100);

    public static final class Frame {
        public final float energy, bass, mid, treble;
        public final long at;
        Frame(float energy, float bass, float mid, float treble, long at) {
            this.energy = energy; this.bass = bass; this.mid = mid; this.treble = treble; this.at = at;
        }
    }

    public ReactiveAudio(Context context) { super(context); }

    @Override
    protected AudioSink buildAudioSink(Context context, boolean floatOutput, boolean playbackParams) {
        return new DefaultAudioSink.Builder(context)
            .setEnableFloatOutput(false)
            .setEnableAudioTrackPlaybackParams(playbackParams)
            .setAudioProcessors(new AudioProcessor[] { new TeeAudioProcessor(this) }).build();
    }

    public static void attach(ExoPlayer player) {
        currentPlayer = player;
        if (enabled) updateOffload(player, true);
    }

    // Called only on the UI thread by the visible lyric stage.
    public static void acquire() { if (++users == 1) setEnabled(true); }
    public static void release() { users = Math.max(0, users - 1); if (users == 0) setEnabled(false); }

    private static void setEnabled(boolean value) {
        enabled = value;
        latest = new Frame(0, 0, 0, 0, 0);
        ExoPlayer player = currentPlayer;
        if (player != null) new Handler(player.getApplicationLooper()).post(() -> {
            if (currentPlayer == player) updateOffload(player, enabled);
        });
    }

    private static void updateOffload(ExoPlayer player, boolean active) {
        TrackSelectionParameters parameters = player.getTrackSelectionParameters();
        if (active) {
            if (savedOffload == null) savedOffload = parameters.audioOffloadPreferences;
            player.setTrackSelectionParameters(parameters.buildUpon().setAudioOffloadPreferences(
                new TrackSelectionParameters.AudioOffloadPreferences.Builder()
                    .setAudioOffloadMode(TrackSelectionParameters.AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED)
                    .build()).build());
        } else if (savedOffload != null) {
            player.setTrackSelectionParameters(parameters.buildUpon().setAudioOffloadPreferences(savedOffload).build());
            savedOffload = null;
        }
    }

    public static Frame frame() { return latest; }

    public static void detach(ExoPlayer player) {
        if (currentPlayer == player) { currentPlayer = null; savedOffload = null; latest = new Frame(0, 0, 0, 0, 0); }
    }

    @Override
    public void flush(int sampleRate, int channelCount, int encoding) {
        this.channels = Math.max(1, channelCount); this.encoding = encoding;
        bands = new AudioBands(sampleRate);
        latest = new Frame(0, 0, 0, 0, 0);
    }

    @Override
    public void handleBuffer(ByteBuffer buffer) {
        if (!enabled || encoding != C.ENCODING_PCM_16BIT) return;
        // TeeAudioProcessor passes a read-only view; the original audio is never changed.
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        while (buffer.remaining() >= channels * 2) {
            double value = 0;
            for (int channel = 0; channel < channels; channel++) value += buffer.getShort() / 32768.0;
            value /= channels;
            if (bands.push(value)) {
                latest = new Frame(bands.energy, bands.bass, bands.mid, bands.treble, SystemClock.elapsedRealtime());
            }
        }
    }

}
