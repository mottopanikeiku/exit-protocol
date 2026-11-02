"""PHASEONE's transmission: a deep, kind, powerful voice, half machine, coming through static.

There is one voice and one pitch. The WORLD vocoder re-synthesises the dry take two semitones lower,
with its pitch movement flattened by half (robotic, though the kind intonation survives), formants
lowered 7 % (a larger, darker speaker) and less breath (a buzzier, synthetic tone). A 32-band channel
vocoder replays that voice on a buzzing carrier locked to the same pitch, so machine and voice fuse
rather than sounding as two. A 2.3 ms metallic comb, a light 48 Hz ring buzz and a bit crush finish
the machine, and a low shelf gives it weight. No echo, no hall, no second voice.

The channel: static rides on the voice itself, over a hiss bed with crackle, static bursts in the
pauses between words, short digital glitches, brief signal dips, and a squelch as the channel keys up
and drops. The line's mood (its `effect` in lines.json) sets how bad the channel is: 'clean' lines
are a lie and arrive on a near-perfect signal; 'glitch' lines break up, at the moment the codec shows
SIGNAL LOST. Every random choice is seeded from the line id, so a re-render is identical.
"""
import hashlib

import numpy as np
import pyworld
from scipy import signal

RATE = 24000
FRAME_MS = 5.0
SHIFT_ST = -2.0          # darker
FLATTEN = .5             # share of the pitch movement kept: robotic, still kind
FORMANT = .93            # formants lowered 7 %: a larger speaker
BREATH = .45             # aperiodicity kept in voiced frames: buzzier, synthetic
VOCODER_MIX = .35        # machine share, on the voice's own pitch
VOCODER_BANDS = 32
VOCODER_ENV_HZ = 120     # band envelopes fast enough to keep consonants (and the shared pitch)
KEY_UP_S, KEY_DOWN_S, CLOSE_S = .07, .16, .3
# Per effect: static riding the voice and the hiss bed (dB under speech), crackles per second,
# chance of a burst in each pause, digital glitches and signal dips per second, and crush mix.
CHANNEL = {
    None: dict(grit=-15, hiss=-20, crackle=12, bursts=.65, glitches=.25, dips=.25, crush=.2),
    'guarded': dict(grit=-16, hiss=-22, crackle=10, bursts=.5, glitches=.2, dips=.2, crush=.18),
    'clean': dict(grit=-34, hiss=-40, crackle=0, bursts=0, glitches=0, dips=0, crush=.08),
    'glitch': dict(grit=-11, hiss=-16, crackle=20, bursts=.9, glitches=1.2, dips=.9, crush=.3),
}


def _sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=RATE, output='sos')


def _band(x, lo, hi, order=4):
    return signal.sosfilt(_sos('bandpass', [lo, hi], order), x)


def _rms(x):
    return float(np.sqrt(np.mean(np.square(x)))) + 1e-9


def _envelope(x, ms=20):
    n = int(RATE * ms / 1000)
    return np.sqrt(np.convolve(np.square(x), np.ones(n) / n, 'same'))


def _biquad(x, kind, f0, gain_db, q=.9):
    """RBJ low shelf or peaking EQ."""
    a, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / RATE
    cw, sw = np.cos(w), np.sin(w)
    if kind == 'shelf':
        k = 2 * np.sqrt(a) * sw / 2 * np.sqrt(2)
        b = [a * ((a + 1) - (a - 1) * cw + k), 2 * a * ((a - 1) - (a + 1) * cw), a * ((a + 1) - (a - 1) * cw - k)]
        d = [(a + 1) + (a - 1) * cw + k, -2 * ((a - 1) + (a + 1) * cw), (a + 1) + (a - 1) * cw - k]
    else:
        alpha = sw / (2 * q)
        b, d = [1 + alpha * a, -2 * cw, 1 - alpha * a], [1 + alpha / a, -2 * cw, 1 - alpha / a]
    return signal.lfilter(b, d, x)


def _world(x):
    """Re-synthesise the take lower, flatter, larger and buzzier. Returns the voice and its pitch per sample."""
    f0, t = pyworld.harvest(x, RATE, f0_floor=55, f0_ceil=400, frame_period=FRAME_MS)
    f0 = pyworld.stonemask(x, f0, t, RATE)
    sp = pyworld.cheaptrick(x, f0, t, RATE)
    ap = pyworld.d4c(x, f0, t, RATE)
    voiced = f0 > 0
    centre = float(np.median(f0[voiced])) if voiced.any() else 110.0
    target = centre * 2 ** (SHIFT_ST / 12)
    f0 = np.where(voiced, target * (np.where(voiced, f0, centre) / centre) ** FLATTEN, 0)
    n = sp.shape[1]
    src = np.minimum(np.arange(n) / FORMANT, n - 1)
    lo = src.astype(int)
    hi, w = np.minimum(lo + 1, n - 1), src - lo
    sp = np.ascontiguousarray(sp[:, lo] * (1 - w) + sp[:, hi] * w)
    ap = np.ascontiguousarray(np.where(voiced[:, None], ap * BREATH, ap))
    y = pyworld.synthesize(f0, sp, ap, RATE, FRAME_MS)
    y = np.pad(y[:len(x)], (0, max(0, len(x) - len(y))))
    held = np.flatnonzero(voiced)
    contour = np.interp(t, t[held], f0[held]) if len(held) else np.full(len(t), target)
    return y, np.interp(np.arange(len(x)) / RATE, t, contour)


def _carrier(pitch):
    """A band-limited buzz that follows the voice's pitch exactly."""
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    buzz = np.zeros(len(pitch))
    for k in range(1, int(7200 / pitch.max()) + 1):
        buzz += np.sin(k * phase) / k
    return buzz / (np.max(np.abs(buzz)) + 1e-9)


def _vocode(mod, carrier, rng):
    """Channel vocoder. Upper bands lean on noise, which carries the consonants."""
    noise, out = rng.standard_normal(len(mod)), np.zeros(len(mod))
    edges, env = np.geomspace(90, 7000, VOCODER_BANDS + 1), _sos('lowpass', VOCODER_ENV_HZ)
    for lo, hi in zip(edges[:-1], edges[1:]):
        sos = _sos('bandpass', [lo, hi])
        level = signal.sosfilt(env, np.abs(signal.sosfilt(sos, mod)))
        buzz, hiss = signal.sosfilt(sos, carrier), signal.sosfilt(sos, noise)
        w = .1 + .75 * np.clip((np.sqrt(lo * hi) - 2500) / 3000, 0, 1)
        c = (1 - w) * buzz / _rms(buzz) + w * hiss / _rms(hiss)
        out += c / (signal.sosfilt(env, np.abs(c)) + 1e-6) * level
    return out


def cyborg(dry, rng=None, crush=.2):
    """The voice before the channel: one voice, lower, half machine, metallic, heavy. Unit peak."""
    rng = rng or np.random.default_rng(0)
    voice, pitch = _world(np.asarray(dry, dtype=np.float64))
    machine = _vocode(voice, _carrier(pitch), rng)
    v = VOCODER_MIX * machine / _rms(machine) + (1 - VOCODER_MIX) * voice / _rms(voice)
    t = np.arange(len(v)) / RATE
    v *= .85 + .15 * np.sin(2 * np.pi * 48 * t)
    d = int(.0023 * RATE)
    v = v + .32 * np.r_[np.zeros(d), v[:-d]]
    v /= np.max(np.abs(v)) + 1e-9
    crushed = np.repeat(np.round(v[::3] * 32) / 32, 3)[:len(v)]
    v = v * (1 - crush) + crushed * crush
    v = signal.sosfilt(_sos('highpass', 70), v)
    v = _biquad(v, 'shelf', 170, 4)
    v = _biquad(v, 'peak', 2200, 2.5)
    v = signal.sosfilt(_sos('lowpass', 5600, 4), v)
    return np.tanh(1.7 * v / (np.max(np.abs(v)) + 1e-9)) / np.tanh(1.7)


def _pauses(x, floor=.08, min_s=.07):
    """(centre, length) in samples of each gap between words, where the envelope stays under `floor` of its peak."""
    envelope = _envelope(x)
    quiet = envelope < floor * envelope.max()
    edges = np.flatnonzero(np.diff(np.r_[0, quiet.astype(np.int8), 0]))
    return [((a + b) // 2, b - a) for a, b in zip(edges[::2], edges[1::2]) if b - a >= min_s * RATE and a > 0 and b < len(x)]


def _burst(rng, length, level, attack=.15):
    """A short burst of broadband static with a quick rise and a slower fall."""
    n = max(8, int(length))
    shape = np.minimum(1, np.linspace(0, 1 / attack, n)) * np.linspace(1, 0, n) ** 1.5
    return _band(rng.standard_normal(n), 300, 5500, 2) * shape * level


def transmit(dry, line_id, effect=None, cut=None):
    """Return the transmitted line (float32, 24 kHz, peak 0.8). `cut` ends the take mid-word (seconds)."""
    rng = np.random.default_rng(int.from_bytes(hashlib.sha256(line_id.encode()).digest()[:4], 'little'))
    p = CHANNEL.get(effect, CHANNEL[None])
    x = np.asarray(dry, dtype=np.float64)
    if cut is not None:
        x = x[:int(cut * RATE)].copy()
        ramp = int(.012 * RATE)
        x[-ramp:] *= np.linspace(1, 0, ramp)
    pauses = _pauses(x)
    v = cyborg(x, rng, p['crush'])
    speech = _rms(v[_envelope(v) > .1 * _envelope(v).max()])
    # Static riding the voice: crackly noise that follows its loudness, in 2-8 ms grains.
    grains = signal.sosfilt(_sos('lowpass', 150), rng.standard_normal(len(v)))
    grains = (grains > .3 * np.std(grains)).astype(np.float64)
    grit = _band(rng.standard_normal(len(v)), 1200, 6000, 2)
    v = v + grit / _rms(grit) * _envelope(v, 5) * grains * 1.6 * 10 ** (p['grit'] / 20)
    duration = len(v) / RATE
    # Signal dips: the voice sags for 20-50 ms now and then.
    for _ in range(rng.poisson(p['dips'] * duration)):
        at, n = rng.integers(0, len(v)), int(rng.uniform(.02, .05) * RATE)
        v[at:at + n] *= (1 - .55 * np.hanning(n))[:len(v[at:at + n])]
    up, down, tail = int(KEY_UP_S * RATE), int((CLOSE_S if cut is not None else KEY_DOWN_S) * RATE), int(.05 * RATE)
    total = up + len(v) + down + tail
    open_end = up + len(v) + down
    voice = np.zeros(total)
    voice[up:up + len(v)] = v
    static = np.zeros(total)
    # A glitch line loses the signal once, a third of the way in (capped at 2.5 s), like the codec does.
    if effect == 'glitch':
        at, n = up + int(min(2.5, total / RATE * .34) * RATE), int(.22 * RATE)
        voice[at:at + n] *= .12
        static[at:at + n] += _burst(rng, n, speech * .55, attack=.05)[:total - at]
    # Digital glitches: a few ms of the voice drop out under a square-wave chirp.
    for _ in range(rng.poisson(p['glitches'] * duration)):
        at = up + rng.integers(0, len(v))
        n = min(int(rng.uniform(.006, .025) * RATE), total - at)
        tt = np.arange(n) / RATE
        voice[at:at + n] *= .25
        static[at:at + n] += _band(np.sign(np.sin(2 * np.pi * rng.uniform(500, 2400) * tt)), 400, 5000, 2) * speech * .3
    # The hiss bed wanders by about +/-5 dB while the channel is open.
    hiss = _band(rng.standard_normal(total), 400, 5500, 2)
    wander = signal.sosfilt(_sos('lowpass', .7, 1), rng.standard_normal(total))
    wander = 10 ** (5 * wander / (np.max(np.abs(wander)) + 1e-9) / 20)
    gate = np.zeros(total)
    gate[:open_end] = 1
    edge = int(.005 * RATE)
    gate[:edge] = np.linspace(0, 1, edge)
    gate[open_end - edge:open_end] = np.linspace(1, 0, edge)
    static += hiss * (speech * 10 ** (p['hiss'] / 20) / _rms(hiss)) * wander * gate
    if p['crackle']:
        clicks = np.zeros(total)
        hits = rng.random(total) < p['crackle'] / RATE
        clicks[hits] = rng.standard_normal(int(hits.sum())) * speech * 3
        static += _band(clicks, 900, 6500, 2) * gate
    # Bursts sit inside the pauses, never over a word.
    for centre, gap in pauses:
        if rng.random() < p['bursts']:
            b = _burst(rng, min(rng.uniform(.04, .11) * RATE, gap * .8), speech * .4)
            at = up + centre - len(b) // 2
            static[at:at + len(b)] += b[:total - at]
    # Squelch: the channel keys up before the first word and drops after the last.
    key_up = _burst(rng, up, speech * .5, attack=.6)
    static[:len(key_up)] += key_up
    key_down = _burst(rng, down, speech * (.75 if cut is not None else .5), attack=.04)
    static[up + len(v):up + len(v) + len(key_down)] += key_down
    out = signal.sosfilt(_sos('bandpass', [60, 5800]), voice + static)
    out[open_end:] = 0
    fade = int(.005 * RATE)
    out[:fade] *= np.linspace(0, 1, fade)
    return (out / (np.max(np.abs(out)) + 1e-9) * .8).astype(np.float32)
