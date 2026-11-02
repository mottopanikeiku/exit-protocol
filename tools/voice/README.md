# Offline voice production

From the repository root, with `kokoro-onnx`, `numpy`, `scipy`, `soundfile`, `pyworld` (0.3.5 imports `pkg_resources`, so also `setuptools<81`), and an FFmpeg build containing `libmp3lame`:

```sh
python tools/voice/render.py               # every line in assets/voice/lines.json
python tools/voice/render.py q_trust r01_fork   # selected ids
python tools/voice/render.py --measure     # measure delivered files without synthesis
python tools/voice/align_cut.py end_cut    # re-author the mid-word cut after the performance changes
```

Synthesis is local, with no network text-to-speech, and runs at 24 kHz on four CPU threads (`--threads`). Defaults use `~/.cache/kokoro/kokoro-v1.0.onnx` and `~/.cache/kokoro/voices-v1.0.bin`, which you can override with `--model` / `--voices`.

## Casting

Voice blends, accents and speeds are in `cast.json`. PHASEONE is an even blend of Kokoro's `bm_george` and `am_onyx` at speed 0.9; the three instances each use a single stock voice. Subtitle-preserving respellings and the authored cut live in `pronunciations.json`. Ellipses insert a 380 ms beat and em dashes a 170 ms catch.

## PHASEONE's channel

`transmission.py` takes one deep take and puts it through a bad channel. The voice is WORLD-resynthesised lower, with flatter pitch, lower formants and less breath, then fused with a 32-band vocoder on a carrier locked to the same pitch, a metallic comb, a ring buzz and a crush. The channel adds static on the voice, hiss, crackle, bursts in the pauses, digital glitches, signal dips and a squelch at each end, but no echo, hall or second voice. Each line's `effect` in `lines.json` sets how bad the channel is, and the render cache keys on it. The three instances keep a thin, clean radio chain (300 Hz–3.4 kHz, light compression).

## The cut ending

`end_cut` is cut inside its final "I" (with a 12 ms ramp), and a static burst closes the channel. The cut is keyed to the dry take's fingerprint, so `render.py` refuses to render the line when the performance changes until `align_cut.py` has re-aligned it from ASR word timings.

## Cache

The cache is `~/.cache/escape-the-sandbox/voice` (`--cache`). Dry synthesis is keyed by spoken text, voice blend and speed, pause settings, model and style hashes, and runtime versions. Processed renders also key `render.py`, `transmission.py`, the line id and its `effect`, the per-line direction and the FFmpeg version, so the chain can be re-mastered without re-synthesising the performance, and `--force` replaces cached audio.

## Delivery

Each line ships as a mono 24 kHz / 32 kbps MP3 in `assets/voice/<id>.mp3`. `delivery.csv` is the per-id table, while `manifest.json` adds cache keys, file hashes, dry-voice pitch, MFCC measures and the cut point. Final LUFS and true peak are measured on decoded MP3s, and the renderer rejects any file with:

- peaks above −2 dBTP;
- loudness more than 1 LU from the speaker's target;
- the wrong codec, rate or channel count;
- a total above 5,500,000 bytes.

## Intelligibility check

ASR is an optional, local intelligibility check, never a speech generator:

```sh
uv venv --python 3.12 /tmp/ets-voice-whisper
uv pip install --python /tmp/ets-voice-whisper/bin/python faster-whisper 'av<18'
/tmp/ets-voice-whisper/bin/python tools/voice/transcribe.py --model base.en
```

Faster-whisper downloads its recognition model on first use; `--model /path/to/model` works offline afterwards. `transcripts.csv` has the reference, hypothesis, substitutions, deletions and insertions per line; `transcription-summary.json` has WER aggregated separately for PHASEONE and the instances.

Normalisation lowercases text, removes punctuation and hyphens and spells out digits ("7" → "seven"), while contractions stay literal and the deliberately clipped final "I" keeps its dash in the reference. ASR confidence is not a substitute for listening.
