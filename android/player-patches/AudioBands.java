package com.guichaguri.trackplayer.service.player;

/** Streaming stereo FFT and adaptive low-frequency onset detector. No Android dependencies. */
public final class AudioBands {
    public static final int SPECTRUM_SIZE = 32;
    public float energy, bass, mid, treble, beat;
    public long beatSerial;
    public final float[] spectrum = new float[SPECTRUM_SIZE];
    public final long windowDelayUs;
    private final int sampleRate, size, hop;
    private final double[] left, right, real, imag, window, power;
    private final double[] peaks = {.045, .045, .045, .045};
    private final double[] kickPrevious = new double[3], kickMean = new double[3], fluxMean = new double[3];
    private final double[] kickScores = new double[3];
    private int cursor, filled, sinceFrame, frames, lastBeatFrame = -1000;
    private boolean automatic = true;
    private double lowHz = 45, highHz = 170, sensitivity = 1;
    public float detectedLowHz = 45, detectedHighHz = 170;

    public AudioBands(int sampleRate) {
        this.sampleRate = Math.max(8000, sampleRate);
        int n = 512;
        while (n < this.sampleRate * .04 && n < 8192) n *= 2;
        size = n; hop = Math.max(1, this.sampleRate / 50);
        windowDelayUs = n * 500_000L / this.sampleRate;
        left = new double[n]; right = new double[n]; real = new double[n]; imag = new double[n];
        window = new double[n]; power = new double[n / 2 + 1];
        for (int i = 0; i < n; i++) window[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1));
    }

    public void configure(boolean automatic, double lowHz, double highHz, double sensitivity) {
        this.automatic = automatic;
        this.lowHz = finite(lowHz, 45, 25, 110); this.highHz = finite(highHz, 170, 120, 300);
        this.sensitivity = finite(sensitivity, 1, .4, 2);
    }
    private static double finite(double v, double fallback, double min, double max) {
        return Double.isNaN(v) || Double.isInfinite(v) ? fallback : Math.max(min, Math.min(max, v));
    }
    public boolean push(double value) { return push(value, value); }
    public boolean push(double l, double r) {
        left[cursor] = finite(l, 0, -1, 1); right[cursor] = finite(r, 0, -1, 1);
        cursor = (cursor + 1) % size; filled = Math.min(size, filled + 1);
        if (++sinceFrame < hop || filled < size) return false;
        sinceFrame = 0; analyze(); return true;
    }

    private void transform(double[] input, boolean add) {
        for (int i = 0; i < size; i++) { real[i] = input[(cursor + i) % size] * window[i]; imag[i] = 0; }
        for (int i = 1, j = 0; i < size; i++) {
            int bit = size >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { double tmp = real[i]; real[i] = real[j]; real[j] = tmp; }
        }
        for (int len = 2; len <= size; len <<= 1) {
            double angle = -2 * Math.PI / len, stepR = Math.cos(angle), stepI = Math.sin(angle);
            for (int start = 0; start < size; start += len) {
                double wr = 1, wi = 0;
                for (int j = 0; j < len / 2; j++) {
                    int a = start + j, b = a + len / 2;
                    double br = real[b] * wr - imag[b] * wi, bi = real[b] * wi + imag[b] * wr;
                    real[b] = real[a] - br; imag[b] = imag[a] - bi;
                    real[a] += br; imag[a] += bi;
                    double next = wr * stepR - wi * stepI; wi = wr * stepI + wi * stepR; wr = next;
                }
            }
        }
        // Two channel powers, Hann correction: phase-inverted stereo stays audible.
        double scale = 1.0 / (size * (double)size * .375);
        for (int i = 0; i < power.length; i++) {
            double p = (real[i] * real[i] + imag[i] * imag[i]) * scale;
            power[i] = add ? power[i] + p : p;
        }
    }

    private double band(double low, double high) {
        double result = 0, binHz = sampleRate / (double)size;
        for (int bin = Math.max(1, (int)(low / binHz)); bin < power.length && (bin - .5) * binHz < high; bin++) {
            double overlap = Math.max(0, Math.min(high, (bin + .5) * binHz) - Math.max(low, (bin - .5) * binHz)) / binHz;
            result += power[bin] * overlap;
        }
        return Math.sqrt(result);
    }

    private float level(double raw, int index) {
        peaks[index] = Math.max(raw, peaks[index] * .997);
        return (float)Math.min(1, raw / Math.max(.025, peaks[index] * .85));
    }

    private void analyze() {
        transform(left, false); transform(right, true);
        frames++;
        double raw = band(25, sampleRate / 2.0), low = band(25, 250), middle = band(250, 4000), high = band(4000, 16000);
        energy = level(raw, 0); bass = level(low, 1); mid = level(middle, 2); treble = level(high, 3);
        for (int i = 0; i < spectrum.length; i++) {
            double from = 30 * Math.pow(16000.0 / 30, i / (double)spectrum.length);
            double to = 30 * Math.pow(16000.0 / 30, (i + 1) / (double)spectrum.length);
            double amplitude = band(from, to);
            spectrum[i] = raw < .0001 ? 0 : (float)Math.max(0, Math.min(1, (20 * Math.log10(Math.max(1e-9, amplitude)) + 72) / 64));
        }
        double[][] ranges = {{32, 90}, {45, 170}, {80, 240}};
        int selected = 1;
        if (automatic) {
            for (int i = 0; i < 3; i++) {
                double value = band(ranges[i][0], ranges[i][1]);
                double flux = Math.max(0, value - kickPrevious[i]);
                kickScores[i] = kickScores[i] * .98 + flux;
                if (kickScores[i] > kickScores[selected] * 1.12) selected = i;
            }
        }
        detectedLowHz = (float)(automatic ? ranges[selected][0] : lowHz);
        detectedHighHz = (float)(automatic ? ranges[selected][1] : highHz);
        double kick = band(detectedLowHz, detectedHighHz);
        double previous = automatic ? kickPrevious[selected] : kickPrevious[0];
        double average = automatic ? kickMean[selected] : kickMean[0];
        double meanFlux = automatic ? fluxMean[selected] : fluxMean[0];
        double onset = Math.max(0, kick - previous), dt = hop / (double)sampleRate;
        beat *= (float)Math.exp(-dt / .16);
        boolean hit = frames > .18 / dt && (frames - lastBeatFrame) * dt >= .20 &&
            onset > Math.max(.0035, meanFlux * 2.6) / sensitivity &&
            kick > Math.max(.006, average * 1.14) && kick > middle * .18;
        if (hit) { beat = (float)Math.min(1, .45 + onset / Math.max(.015, kick)); beatSerial++; lastBeatFrame = frames; }
        for (int i = 0; i < 3; i++) {
            double value = automatic ? band(ranges[i][0], ranges[i][1]) : kick;
            fluxMean[i] += .04 * (Math.max(0, value - kickPrevious[i]) - fluxMean[i]);
            kickMean[i] += .04 * (value - kickMean[i]); kickPrevious[i] = value;
        }
        if (raw < .0001) { energy = bass = mid = treble = 0; if (beat < .001) beat = 0; }
    }
}
