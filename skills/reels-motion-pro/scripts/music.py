# Original procedurally generated track: 120 BPM, Am-F-C-G, kick/clap/hats/bass/pluck/pad. Also whoosh/hit SFX.
import numpy as np, wave, sys
SR = 44100
BPM = 120
BEAT = 60 / BPM
dur = float(sys.argv[1]); out = sys.argv[2]; sfxdir = sys.argv[3]
N = int((dur + 1.0) * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def put(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf): return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain

def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y

def env(n, a, d):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
    return e

def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 35)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 0.9

def clap():
    n = int(0.22 * SR); x = rng.standard_normal(n)
    x = x - onepole_lp(x, 900)
    return x * env(n, 0.002, 0.06) * 0.35

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); x = rng.standard_normal(n)
    x = x - onepole_lp(x, 6000)
    return x * env(n, 0.001, 0.06 if open_ else 0.012) * 0.22

def saw(f, n):
    t = np.arange(n) / SR
    return 2 * ((t * f) % 1) - 1

def bass(f, length):
    n = int(length * SR); x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR) * 0.6
    x = onepole_lp(x, 380)
    return x * env(n, 0.005, length * 0.9) * 0.55

def pluck(f, length=0.3):
    n = int(length * SR); x = saw(f, n) + saw(f * 1.005, n)
    x = onepole_lp(x, 2500)
    return x * env(n, 0.002, 0.11) * 0.09

def pad(freqs, length):
    n = int(length * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for f in freqs:
        for det in (0.997, 1.003):
            x += saw(f * det, n)
    x = onepole_lp(x, 1200)
    a = np.minimum(1, t / 0.4) * np.minimum(1, (length - t) / 0.4)
    return x * a * 0.022

m = lambda midi: 440 * 2 ** ((midi - 69) / 12)
# Am, F, C, G : roots and chord tones (midi)
prog = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]
arp_pat = [0, 1, 2, 1, 2, 0, 1, 2]
bar = 4 * BEAT
nbars = int(np.ceil(dur / bar))
K, C, H, B, P, PD = (np.zeros(N) for _ in range(6))
for b in range(nbars):
    t0 = b * bar
    root, chord = prog[b % 4]
    last = b == nbars - 1
    section_fill = (b % 8 == 7)
    full = b >= 1
    put(PD, pad([m(x) for x in chord], bar + 0.05), t0)
    for k in range(4):
        tb = t0 + k * BEAT
        if tb >= dur - 0.2: break
        if full and not (section_fill and k == 3): put(K, kick(), tb)
        if full and k in (1, 3): put(C, clap(), tb)
        for s in range(2):
            put(H, hat(open_=(s == 1 and k == 3)), tb + s * BEAT / 2, 0.8 if s else 0.5)
        if full:
            put(B, bass(m(root), BEAT * 0.45), tb + BEAT / 2)
            put(B, bass(m(root), BEAT * 0.4), tb, 0.8)
    for s in range(8):
        ts = t0 + s * BEAT / 2
        if ts >= dur - 0.2: break
        put(P, pluck(m(chord[arp_pat[s]] + 12)), ts)
# ending: a final hit on the last downbeat before dur
end_t = np.floor((dur - 0.05) / BEAT) * BEAT
put(K, kick(), end_t, 0.6)
put(PD, pad([m(x) for x in prog[0][1]] + [m(57 - 12)], 1.8) * 2.5, end_t)
mix_m = K * 1.0 + C + B + PD
mono = mix_m
L = mono + H * 0.9 + P * 1.1; R = mono + H * 1.1 + P * 0.9
# fade the last 1.2 s after end
t = np.arange(N) / SR
fade = np.clip((dur + 0.9 - t) / 1.2, 0, 1)
L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max()); L, R = L / pk * 0.89, R / pk * 0.89

def write(path, l, r=None):
    r = l if r is None else r
    d = np.stack([l, r], 1); d = (np.clip(d, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
write(out, L, R)

# SFX: whoosh (rising band-passed noise, peak at the end) and soft low hit
n = int(0.45 * SR); x = rng.standard_normal(n); tt = np.arange(n) / SR
lp = np.zeros(n); s = 0.0
for i in range(n):
    fc = 300 + 5000 * (tt[i] / 0.45) ** 2
    a = np.exp(-2 * np.pi * fc / SR); s = (1 - a) * x[i] + a * s; lp[i] = s
wh = (lp - onepole_lp(lp, 200)) * (tt / 0.45) ** 2.2 * np.exp(-np.maximum(0, tt - 0.40) * 60)
wh = wh / np.abs(wh).max() * 0.8
write(f"{sfxdir}/whoosh.wav", wh * 0.95, np.concatenate([wh[40:], np.zeros(40)]) * 0.95)
n = int(0.6 * SR); tt = np.arange(n) / SR
f = 40 + 70 * np.exp(-tt * 20)
hit = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6)
cl = rng.standard_normal(n) * np.exp(-tt * 120) * 0.25
hit = (hit + cl); hit = hit / np.abs(hit).max() * 0.85
write(f"{sfxdir}/hit.wav", hit)
print("ok", out, round(dur, 2), "bars", nbars)
