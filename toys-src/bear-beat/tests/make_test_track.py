#!/usr/bin/env python3
"""Synthesize a 40 s drum-and-bass test track with a known beat grid.

Kick on every beat, snare on 2 and 4, hats on eighths, bass on the off-beats.
Ground truth: beat k is at T0 + k * 60 / BPM seconds.

Usage: python3 make_test_track.py [out.wav] [bpm]
       ffmpeg -i out.wav out.mp3      # if you want an MP3 too
"""
import sys, wave
import numpy as np

out = sys.argv[1] if len(sys.argv) > 1 else 'test123.wav'
BPM = float(sys.argv[2]) if len(sys.argv) > 2 else 123.0
SR, DUR, T0 = 44100, 40, 0.37
n = SR * DUR; x = np.zeros(n); spb = 60 / BPM; rng = np.random.default_rng(1)

def add(start, sig):
    i = int(start * SR); j = min(n, i + len(sig)); x[i:j] += sig[:j - i]

tt = np.arange(int(0.3 * SR)) / SR
kick = np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-tt * 30)) / SR) * np.exp(-tt * 9)
snare = rng.standard_normal(len(tt)) * np.exp(-tt * 20) * 0.5
hat = rng.standard_normal(int(0.05 * SR)); hat = np.diff(np.concatenate([[0], hat])) * np.exp(-np.arange(len(hat)) / SR * 60) * 0.25
k = 0
while T0 + k * spb / 2 < DUR - 1:
    t = T0 + k * spb / 2
    if k % 2 == 0: add(t, kick)
    if k % 4 == 2: add(t, snare)
    add(t, hat)
    if k % 2 == 1:
        bt = np.arange(int(spb / 2 * SR)) / SR
        add(t, 0.2 * np.sign(np.sin(2 * np.pi * 55 * bt)) * np.exp(-bt * 6))
    k += 1
x += 0.02 * rng.standard_normal(n)
x = x / np.abs(x).max() * 0.8
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
print(f'{out}: {BPM} BPM, first beat at {T0} s')
