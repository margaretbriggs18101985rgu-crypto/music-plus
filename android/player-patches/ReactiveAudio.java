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
import androidx.media3.exoplayer.audio.ForwardingAudioSink;
import androidx.media3.exoplayer.audio.TeeAudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** Read-only PCM tap. No microphone permission, audio mutation, or JS frame traffic. */
@UnstableApi
public final class ReactiveAudio extends DefaultRenderersFactory implements TeeAudioProcessor.AudioBufferSink {
    private static volatile boolean enabled;
    private static final Frame EMPTY = new Frame(0, 0, 0, 0, 0);
    private static final Frame[] history = new Frame[256];
    private static int historyCursor, historyCount;
    private static volatile long sinkPositionUs = Long.MIN_VALUE, sinkUpdatedAt;
    private static volatile int generation;
    private static volatile AnalysisConfig config = new AnalysisConfig(true, 45, 170, 1);
    private static ExoPlayer currentPlayer;
    private static TrackSelectionParameters.AudioOffloadPreferences savedOffload;
    private static int users;
    private int channels = 2, encoding = C.ENCODING_PCM_16BIT;
    private AudioBands bands = new AudioBands(44100);
    private int sampleRate = 44100, localGeneration = -1;
    private long bufferTimeUs;

    private static final class AnalysisConfig {
        final boolean auto; final float low, high, sensitivity;
        AnalysisConfig(boolean auto, float low, float high, float sensitivity) {
            this.auto = auto; this.low = low; this.high = high; this.sensitivity = sensitivity;
        }
    }

    public static void configure(boolean auto, float low, float high, float sensitivity) {
        AnalysisConfig old = config;
        if (old.auto == auto && old.low == low && old.high == high && old.sensitivity == sensitivity) return;
        config = new AnalysisConfig(auto, low, high, sensitivity);
        resetAnalysis();
    }

    public static synchronized void resetAnalysis() { generation++; historyCount = 0; }

    public static final class Frame {
        public final float energy, bass, mid, treble, beat, lowHz, highHz;
        public final float[] spectrum;
        public final long at, positionUs, beatSerial;
        Frame(float energy, float bass, float mid, float treble, long at) {
            this.energy = energy; this.bass = bass; this.mid = mid; this.treble = treble; this.at = at;
            beat = 0; beatSerial = 0; lowHz = 45; highHz = 170;
            spectrum = new float[AudioBands.SPECTRUM_SIZE]; positionUs = Long.MIN_VALUE;
        }
        Frame(AudioBands bands, long positionUs) {
            energy = bands.energy; bass = bands.bass; mid = bands.mid; treble = bands.treble;
            beat = bands.beat; beatSerial = bands.beatSerial; spectrum = bands.spectrum.clone();
            lowHz = bands.detectedLowHz; highHz = bands.detectedHighHz;
            at = SystemClock.elapsedRealtime(); this.positionUs = positionUs;
        }
    }

    public ReactiveAudio(Context context) { super(context); }

    @Override
    protected AudioSink buildAudioSink(Context context, boolean floatOutput, boolean playbackParams) {
        AudioSink sink = new DefaultAudioSink.Builder(context)
            .setEnableFloatOutput(false)
            .setEnableAudioTrackPlaybackParams(playbackParams)
            .setAudioProcessors(new AudioProcessor[] { new TeeAudioProcessor(this) }).build();
        return new ForwardingAudioSink(sink) {
            @Override public boolean handleBuffer(ByteBuffer buffer, long presentationTimeUs, int encodedAccessUnitCount)
                    throws AudioSink.InitializationException, AudioSink.WriteException {
                bufferTimeUs = presentationTimeUs;
                return super.handleBuffer(buffer, presentationTimeUs, encodedAccessUnitCount);
            }
            @Override public long getCurrentPositionUs(boolean ended) {
                long position = super.getCurrentPositionUs(ended);
                if (position != AudioSink.CURRENT_POSITION_NOT_SET) {
                    sinkPositionUs = position; sinkUpdatedAt = SystemClock.elapsedRealtime();
                }
                return position;
            }
            @Override public void flush() {
                resetAnalysis(); sinkPositionUs = Long.MIN_VALUE; super.flush();
            }
        };
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
        resetAnalysis();
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

    /** Select PCM at the AudioTrack presentation position, not the decoder's read-ahead head. */
    public static synchronized Frame frame() {
        if (!enabled || SystemClock.elapsedRealtime() - sinkUpdatedAt > 250) return EMPTY;
        for (int i = 0; i < historyCount; i++) {
            Frame candidate = history[(historyCursor - 1 - i + history.length) % history.length];
            if (candidate.positionUs <= sinkPositionUs) {
                return sinkPositionUs - candidate.positionUs <= 250_000 ? candidate : EMPTY;
            }
        }
        return EMPTY;
    }

    private static synchronized void publish(Frame frame) {
        history[historyCursor] = frame; historyCursor = (historyCursor + 1) % history.length;
        historyCount = Math.min(history.length, historyCount + 1);
    }

    public static void detach(ExoPlayer player) {
        if (currentPlayer == player) { currentPlayer = null; savedOffload = null; resetAnalysis(); }
    }

    @Override
    public void flush(int sampleRate, int channelCount, int encoding) {
        this.channels = Math.max(1, channelCount); this.encoding = encoding;
        this.sampleRate = Math.max(8000, sampleRate);
        bands = new AudioBands(sampleRate);
        // Tee also calls this at end of input. Keep queued presentation frames until they are heard.
        localGeneration = -1;
    }

    @Override
    public void handleBuffer(ByteBuffer buffer) {
        if (!enabled || encoding != C.ENCODING_PCM_16BIT) return;
        if (localGeneration != generation) {
            localGeneration = generation; bands = new AudioBands(sampleRate);
            AnalysisConfig settings = config;
            bands.configure(settings.auto, settings.low, settings.high, settings.sensitivity);
        }
        // TeeAudioProcessor passes a read-only view; the original audio is never changed.
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        long sample = 0;
        while (buffer.remaining() >= channels * 2) {
            double left = buffer.getShort() / 32768.0;
            double right = channels > 1 ? buffer.getShort() / 32768.0 : left;
            for (int channel = 2; channel < channels; channel++) buffer.getShort();
            sample++;
            if (bands.push(left, right)) {
                // Timestamp at the FFT window center; compensate the analysis window, not a guessed device delay.
                publish(new Frame(bands, bufferTimeUs + sample * 1_000_000L / sampleRate - bands.windowDelayUs));
            }
        }
    }

}
