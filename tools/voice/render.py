#!/usr/bin/env python3
"""Offline Kokoro rendering of every line, PHASEONE's presence chain, and decoded-file QC."""
import argparse
import csv
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.fft import dct

import transmission

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RATE = 24000
REPORT_FIELDS = ["id", "speaker", "duration_s", "lufs", "true_peak_dbtp", "bytes",
                 "f0_median_hz", "f0_p10_hz", "f0_p90_hz", "words_per_second"]


def command(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def ffmpeg(*args):
    return command("ffmpeg", "-hide_banner", "-nostdin", "-y", *map(str, args))


def sha256(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text())


def store(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def words(text):
    return re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?", text)


def pitch_track(audio):
    """YIN CMNDF at 8 kHz, 50 ms windows/10 ms hop; reject unvoiced frames.

    Search 65–350 Hz without a target-biased clamp. Parabolic interpolation
    reduces quantisation; measurements are always on the unprocessed lead.
    """
    signal = np.asarray(audio[::3], dtype=np.float64)
    rate, window, hop = 8000, 400, 80
    min_lag, max_lag = math.ceil(rate / 350), math.floor(rate / 65)
    result = []
    for start in range(0, len(signal) - window - max_lag, hop):
        frame = signal[start:start + window + max_lag]
        if np.sqrt(np.mean(frame[:window] ** 2)) < 0.007:
            continue
        base = frame[:window] - np.mean(frame[:window])
        shifted = np.lib.stride_tricks.sliding_window_view(frame, window)[1:]
        shifted = shifted - shifted.mean(axis=1, keepdims=True)
        difference = np.sum((shifted - base) ** 2, axis=1)
        cmndf = difference * np.arange(1, max_lag + 1) / np.maximum(np.cumsum(difference), 1e-12)
        candidates = np.flatnonzero(cmndf[min_lag - 1:] < 0.16) + min_lag - 1
        if not len(candidates):
            continue
        lag = int(candidates[0])
        while lag + 1 < len(cmndf) and cmndf[lag + 1] < cmndf[lag]:
            lag += 1
        offset = 0.0
        if 0 < lag < len(cmndf) - 1:
            a, b, c = cmndf[lag - 1:lag + 2]
            denominator = a - 2 * b + c
            if abs(denominator) > 1e-12:
                offset = float(np.clip(0.5 * (a - c) / denominator, -0.5, 0.5))
        result.append(((start + window / 2) / rate, rate / (lag + 1 + offset)))
    return np.asarray(result, dtype=np.float64).reshape(-1, 2)


def mfcc_mean(audio):
    """Energy-normalized, voiced-frame MFCC 1–13; no loudness coefficient."""
    signal = np.asarray(audio, dtype=np.float64)
    signal = np.r_[signal[0], signal[1:] - 0.97 * signal[:-1]]
    frames = np.lib.stride_tricks.sliding_window_view(signal, 600)[::240]
    active = np.sqrt(np.mean(frames ** 2, axis=1)) > 0.003
    frames = frames[active]
    if not len(frames):
        raise RuntimeError("No active frames for timbre analysis")
    power = np.abs(np.fft.rfft(frames * np.hamming(600), n=1024)) ** 2
    power /= np.maximum(power.sum(axis=1, keepdims=True), 1e-12)
    mel = np.linspace(2595 * np.log10(1 + 100 / 700), 2595 * np.log10(1 + 8000 / 700), 42)
    hz = 700 * (10 ** (mel / 2595) - 1)
    frequencies = np.fft.rfftfreq(1024, 1 / RATE)
    bank = np.maximum(0, np.minimum(
        (frequencies[None, :] - hz[:-2, None]) / (hz[1:-1, None] - hz[:-2, None]),
        (hz[2:, None] - frequencies[None, :]) / (hz[2:, None] - hz[1:-1, None])))
    coefficients = dct(np.log(np.maximum(power @ bank.T, 1e-12)), type=2, norm="ortho", axis=1)[:, 1:14]
    return np.round(coefficients.mean(axis=0), 5).tolist()


def dry_metrics(audio, text):
    track = pitch_track(audio)
    quantiles = np.percentile(track[:, 1], [50, 10, 90]) if len(track) else [None] * 3
    return dict(zip(["f0_median_hz", "f0_p10_hz", "f0_p90_hz"],
                    [round(float(n), 2) if n is not None else None for n in quantiles]),
                words_per_second=round(len(words(text)) / (len(audio) / RATE), 3),
                mfcc_mean=mfcc_mean(audio))


def loudness(path):
    analysis = ffmpeg("-i", path, "-af", "loudnorm=I=-18:TP=-2:LRA=11:print_format=json", "-f", "null", "-")
    block = re.findall(r"\{[^{}]*\}", analysis.stderr)[-1]
    return json.loads(block)


def file_metrics(path):
    info = json.loads(command("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)).stdout)
    stream = info["streams"][0]
    if stream["codec_name"] != "mp3" or int(stream["sample_rate"]) != RATE or stream["channels"] != 1:
        raise RuntimeError(f"Unexpected delivery format: {path}")
    measured = loudness(path)
    return {"duration_s": round(float(info["format"]["duration"]), 3),
            "lufs": float(measured["input_i"]), "true_peak_dbtp": float(measured["input_tp"]),
            "bytes": path.stat().st_size}


def normalize_text(text, pronunciations, line_id):
    override = pronunciations.get("lines", {}).get(line_id, {})
    if "source_text" in override and override["source_text"] != text:
        raise RuntimeError(f"Re-author pronunciation/cut direction for changed {line_id} text")
    text = override.get("text", text)
    for token, replacement in pronunciations.get("tokens", {}).items():
        text = re.sub(r"(?<!\w)" + re.escape(token) + r"(?!\w)", replacement, text)
    return text, override


def synthesize(engine, text, profile, settings):
    voice = sum(engine.get_voice_style(name) * weight for name, weight in profile["voices"].items())
    voice /= sum(profile["voices"].values())
    parts = []
    for part in re.split(r"(…|—)", text):
        if part in ("…", "—"):
            duration = settings["ellipsis_ms" if part == "…" else "dash_ms"] / 1000
            parts.append(np.zeros(round(RATE * duration), dtype=np.float32))
        elif part.strip():
            audio, sample_rate = engine.create(part.strip(), voice=voice, speed=profile["speed"], lang=profile["lang"])
            if sample_rate != RATE:
                raise RuntimeError(f"Kokoro returned {sample_rate}, expected {RATE}")
            # Trim only near-silent padding: explicit beats must not inherit a
            # second model-generated pause. Keep 12 ms of breath on each side.
            active = np.flatnonzero(np.abs(audio) > 0.002)
            if not len(active):
                raise RuntimeError(f"Silent synthesis: {part}")
            pad = round(RATE * 0.012)
            audio = audio[max(0, active[0] - pad):min(len(audio), active[-1] + pad + 1)]
            parts.append(audio)
    if not parts:
        raise RuntimeError("No speech in line")
    return np.concatenate(parts)


def process(dry, output, profile, speaker, line_id, bitrate, effect=None, cut=None):
    target = profile["lufs"]
    with tempfile.TemporaryDirectory(prefix="ets-voice-") as temp:
        treated = Path(temp) / "treated.wav"
        if speaker == "P1":
            # PHASEONE through the bad channel; an interrupted line closes the channel itself.
            audio, _ = sf.read(dry, dtype="float32")
            sf.write(treated, transmission.transmit(audio, line_id, effect, cut), RATE, subtype="FLOAT")
        else:
            # Instances stay human: a thin radio band, gentle compression and saturation.
            duration = sf.info(dry).duration
            graph = ("[0:a]apad=pad_dur=0.22,highpass=f=300,lowpass=f=3400,"
                     "acompressor=threshold=0.075:ratio=2.2:attack=6:release=90:makeup=1.4,"
                     "asoftclip=type=tanh:threshold=0.85:output=0.96,lowpass=f=3400"
                     f",atrim=end={duration + 0.22:.6f},afade=t=out:st={duration + 0.04:.6f}:d=0.1[out]")
            ffmpeg("-i", dry, "-filter_complex", graph, "-map", "[out]", "-ar", RATE, "-c:a", "pcm_f32le", treated)
        stats = loudness(treated)
        normalization = (f"loudnorm=I={target}:TP=-3:LRA=11:linear=true:"
                         f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
                         f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
                         f"offset={stats['target_offset']}")
        # Low-bitrate reconstruction is not a linear gain operation. Measure
        # decoded output, correct loudness, and retain an oversampled peak guard.
        gain, ceiling = 0.0, -3.5
        for attempt in range(6):
            limit = 10 ** (ceiling / 20)
            chain = (normalization + f",volume={gain:.3f}dB,aresample=96000,"
                     f"alimiter=limit={limit:.6f}:attack=5:release=50:level=false:latency=true,"
                     "aresample=24000,asetpts=N/SR/TB,afade=t=in:st=0:d=0.008")
            if cut is not None and speaker != "P1":
                # A 12 ms disconnect ramp plus 24 ms zero guard keeps MP3 ringing off the final sample.
                chain += f",atrim=end={cut:.6f},afade=t=out:st={cut - 0.036:.6f}:d=0.012"
            ffmpeg("-i", treated, "-af", chain, "-ar", RATE, "-ac", 1,
                   "-c:a", "libmp3lame", "-b:a", f"{bitrate}k", "-map_metadata", "-1", output)
            measured = file_metrics(output)
            if measured["true_peak_dbtp"] <= -2.0 and abs(measured["lufs"] - target) <= 0.5:
                break
            gain += target - measured["lufs"]
            if measured["true_peak_dbtp"] > -2.0:
                ceiling -= measured["true_peak_dbtp"] + 2.4
        if measured["true_peak_dbtp"] > -2.0 or abs(measured["lufs"] - target) > 1.0:
            raise RuntimeError(f"Delivery loudness out of range: {output}: {measured}")
        return measured


def report(rows, path, fields=REPORT_FIELDS):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ids", nargs="*", help="Line IDs; omitted means every line")
    parser.add_argument("--measure", action="store_true", help="Measure delivered files without synthesis")
    parser.add_argument("--force", action="store_true", help="Replace cached renders")
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache/escape-the-sandbox/voice")
    parser.add_argument("--model", type=Path, default=Path.home() / ".cache/kokoro/kokoro-v1.0.onnx")
    parser.add_argument("--voices", type=Path, default=Path.home() / ".cache/kokoro/voices-v1.0.bin")
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    settings, pronunciations = load(HERE / "cast.json"), load(HERE / "pronunciations.json")
    lines = load(ROOT / "assets/voice/lines.json")
    if settings["sample_rate"] != RATE:
        parser.error("This delivery chain requires 24 kHz")
    unknown = set(args.ids) - lines.keys()
    if unknown:
        parser.error(f"Unknown line IDs: {', '.join(sorted(unknown))}")
    ids = args.ids or list(lines.keys())
    if args.measure:
        rows = [{"id": key, "speaker": lines[key]["speaker"], **file_metrics(ROOT / "assets/voice" / f"{key}.mp3")}
                for key in ids]
        report(rows, HERE / "delivery.csv")
    else:
        import onnxruntime as ort
        from kokoro_onnx import Kokoro
        args.cache.mkdir(parents=True, exist_ok=True)
        identity = {"model": sha256(args.model), "voices": sha256(args.voices),
                    "kokoro": importlib.metadata.version("kokoro-onnx"), "onnxruntime": ort.__version__}
        pipeline = {"pipeline": sha256(Path(__file__)), "transmission": sha256(HERE / "transmission.py"),
                    "bitrate_kbps": settings["bitrate_kbps"], "ffmpeg": command("ffmpeg", "-version").stdout.splitlines()[0]}
        options = ort.SessionOptions()
        options.intra_op_num_threads = args.threads
        options.inter_op_num_threads = 1
        engine = None
        rows = []
        for line_id in ids:
            line = lines[line_id]
            speaker = line["speaker"]
            profile = settings["speakers"][speaker]
            text, override = normalize_text(line["text"], pronunciations, line_id)
            synthesis = {**identity, "synthesis_version": 1, "text": text,
                         "profile": {key: profile[key] for key in ("voices", "lang", "speed")},
                         "ellipsis_ms": settings["ellipsis_ms"], "dash_ms": settings["dash_ms"]}
            dry_key = hashlib.sha256(json.dumps(synthesis, sort_keys=True).encode()).hexdigest()
            signature = {**synthesis, **pipeline, "profile": profile, "speaker": speaker, "id": line_id, "effect": line.get("effect"), "override": override}
            key = hashlib.sha256(json.dumps(signature, sort_keys=True).encode()).hexdigest()
            cached = args.cache / key
            cached.mkdir(exist_ok=True)
            dry = args.cache / "synthesis" / dry_key / "dry.wav"
            mp3, meta = cached / "voice.mp3", cached / "metrics.json"
            if args.force or not mp3.exists() or not meta.exists() or load(meta).get("sha256") != sha256(mp3):
                if args.force or not dry.exists():
                    if engine is None:
                        engine = Kokoro.from_session(ort.InferenceSession(str(args.model), sess_options=options,
                                                     providers=["CPUExecutionProvider"]), str(args.voices))
                    audio = synthesize(engine, text, profile, settings)
                    dry.parent.mkdir(parents=True, exist_ok=True)
                    sf.write(dry, audio, RATE, subtype="FLOAT")
                    store(dry.parent / "settings.json", synthesis)
                else:
                    audio, _ = sf.read(dry)
                cut = None
                if override.get("cut"):
                    direction = override["cut"]
                    if direction["dry_cache_key"] != dry_key:
                        print(f"ALIGN    {line_id}: dry take {dry_key} needs a new cut direction", flush=True)
                        raise SystemExit(f"Re-align the authored cut for {line_id} (dry {dry}) with align_cut.py")
                    cut = direction["at_s"]
                metrics = {**dry_metrics(audio[:round(cut * RATE)] if cut else audio, line["text"]),
                           **process(dry, mp3, profile, speaker, line_id, settings["bitrate_kbps"], line.get("effect"), cut),
                           "sha256": sha256(mp3), "cache_key": key, "dry_cache_key": dry_key}
                if cut is not None:
                    metrics["cut_at_s"] = round(cut, 6)
                    metrics["uncut_duration_s"] = round(len(audio) / RATE, 6)
                store(meta, metrics)
                store(cached / "settings.json", signature)
                status = "rendered"
            else:
                metrics = load(meta)
                status = "cached"
            destination = ROOT / "assets/voice" / f"{line_id}.mp3"
            if not destination.exists() or sha256(destination) != metrics["sha256"]:
                shutil.copyfile(mp3, destination)
            rows.append({"id": line_id, "speaker": speaker, "text": line["text"], **metrics})
            print(f"{status:8} {line_id:22} {metrics['duration_s']:6.2f}s "
                  f"{metrics['f0_median_hz']}Hz {metrics['words_per_second']:.2f}w/s "
                  f"{metrics['lufs']:.1f}LUFS {metrics['true_peak_dbtp']:.1f}dBTP", flush=True)
        manifest_path = HERE / "manifest.json"
        # A full run is a clean cutover; selected runs retain other current rows.
        manifest = load(manifest_path) if args.ids and manifest_path.exists() else {}
        manifest.update({row["id"]: row for row in rows})
        store(manifest_path, manifest)
        report(list(manifest.values()), HERE / "delivery.csv")
    files = list((ROOT / "assets/voice").glob("*.mp3"))
    total_bytes = sum(path.stat().st_size for path in files)
    print(f"TOTAL {len(files)} MP3s, {total_bytes:,} bytes / 5,500,000 byte budget", flush=True)
    if total_bytes > 5_500_000:
        raise SystemExit("MP3 budget exceeded")


if __name__ == "__main__":
    main()
