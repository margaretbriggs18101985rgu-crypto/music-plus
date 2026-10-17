package com.guichaguri.trackplayer.service.player;

/** Pure streaming RMS filter bank, independent of Android and the playback buffer. */
public final class AudioBands {
    public float energy, bass, mid, treble;
    private double low, body, bassAlpha, midAlpha;
    private double bassEnergy, midEnergy, trebleEnergy, energySum;
    private int samples, windowSamples;

    public AudioBands(int sampleRate) {
        bassAlpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
        midAlpha = 1 - Math.exp(-2 * Math.PI * 2400 / sampleRate);
        windowSamples = Math.max(1, sampleRate / 50);
    }

    public boolean push(double value) {
        low += bassAlpha * (value - low); body += midAlpha * (value - body);
        double middle = body - low, high = value - body;
        bassEnergy += low * low; midEnergy += middle * middle; trebleEnergy += high * high; energySum += value * value;
        if (++samples < windowSamples) return false;
        energy = level(energySum, 3); bass = level(bassEnergy, 4);
        mid = level(midEnergy, 5); treble = level(trebleEnergy, 7);
        bassEnergy = midEnergy = trebleEnergy = energySum = 0; samples = 0;
        return true;
    }

    private float level(double sum, double gain) { return (float)Math.min(1, Math.sqrt(sum / samples) * gain); }
}
