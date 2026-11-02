#!/usr/bin/env python3
"""Author the cut direction for a line that is interrupted mid-word (end_cut).

Synthesizes (or reuses) the exact dry take render.py will use, finds the final word with local ASR
word timestamps, and stores a cut inside it, keyed to that dry take's cache fingerprint, in
pronunciations.json. render.py refuses to render the line if the performance later changes.
"""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path

import soundfile as sf

import render


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("line_id", nargs="?", default="end_cut")
    parser.add_argument("--into", type=float, default=0.55, help="Fraction into the final word to cut")
    parser.add_argument("--asr-model", default="base.en")
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache/escape-the-sandbox/voice")
    parser.add_argument("--model", type=Path, default=Path.home() / ".cache/kokoro/kokoro-v1.0.onnx")
    parser.add_argument("--voices", type=Path, default=Path.home() / ".cache/kokoro/voices-v1.0.bin")
    args = parser.parse_args()
    import onnxruntime as ort
    from faster_whisper import WhisperModel
    from kokoro_onnx import Kokoro

    settings = render.load(render.HERE / "cast.json")
    pronunciations = render.load(render.HERE / "pronunciations.json")
    line = render.load(render.ROOT / "assets/voice/lines.json")[args.line_id]
    profile = settings["speakers"][line["speaker"]]
    text, _ = render.normalize_text(line["text"], pronunciations, args.line_id)
    identity = {"model": render.sha256(args.model), "voices": render.sha256(args.voices),
                "kokoro": importlib.metadata.version("kokoro-onnx"), "onnxruntime": ort.__version__}
    synthesis = {**identity, "synthesis_version": 1, "text": text,
                 "profile": {key: profile[key] for key in ("voices", "lang", "speed")},
                 "ellipsis_ms": settings["ellipsis_ms"], "dash_ms": settings["dash_ms"]}
    dry_key = hashlib.sha256(json.dumps(synthesis, sort_keys=True).encode()).hexdigest()
    dry = args.cache / "synthesis" / dry_key / "dry.wav"
    if not dry.exists():
        engine = Kokoro(str(args.model), str(args.voices))
        audio = render.synthesize(engine, text, profile, settings)
        dry.parent.mkdir(parents=True, exist_ok=True)
        sf.write(dry, audio, render.RATE, subtype="FLOAT")
        render.store(dry.parent / "settings.json", synthesis)
    segments, _ = WhisperModel(args.asr_model, device="cpu", compute_type="int8").transcribe(
        str(dry), language="en", word_timestamps=True, beam_size=5)
    words = [word for segment in segments for word in segment.words]
    last = words[-1]
    at = round(last.start + max(0.09, (last.end - last.start) * args.into), 3)
    override = pronunciations["lines"][args.line_id]
    override["cut"] = {"at_s": at, "dry_cache_key": dry_key}
    override["note"] = (f"ASR-aligned final word '{last.word.strip()}' spans {last.start:.2f}-{last.end:.2f} s; "
                        f"the channel closes {at - last.start:.3f} s into it, hall included: a 12 ms disconnect ramp "
                        "after all effects, then a 24 ms zero guard. The dry fingerprint forces re-alignment when the "
                        "performance changes; the subtitle keeps its dash.")
    render.store(render.HERE / "pronunciations.json", pronunciations)
    print(f"{args.line_id}: final word {last.word.strip()!r} {last.start:.2f}-{last.end:.2f}s, cut at {at:.3f}s ({dry})")


if __name__ == "__main__":
    main()
