#!/usr/bin/env python3
"""Local faster-whisper transcription and literal subtitle WER (optional QC)."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re

from faster_whisper import WhisperModel

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


NUMBERS = dict(enumerate("zero one two three four five six seven eight nine ten eleven twelve".split()))
TENS = {20: "twenty", 30: "thirty", 40: "forty", 50: "fifty", 60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety"}


def spell(match):
    """ASR writes digits for spoken numbers ("Seven" -> "7"); spell them out so formatting is not a word error."""
    n = int(match.group())
    if n in NUMBERS:
        return NUMBERS[n]
    if n < 100 and n - n % 10 in TENS:
        return TENS[n - n % 10] + ("" if n % 10 == 0 else " " + NUMBERS[n % 10])
    return match.group()


def tokens(text):
    text = re.sub(r"\d+", spell, text.lower().replace("’", "'").replace("-", " "))
    return re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", text)


def errors(reference, hypothesis):
    """Levenshtein alignment with deterministic substitution/deletion/insertion counts."""
    previous = [(i, 0, 0, i) for i in range(len(hypothesis) + 1)]
    for row, expected in enumerate(reference, 1):
        current = [(row, 0, row, 0)]
        for col, actual in enumerate(hypothesis, 1):
            cost, subs, deletes, inserts = previous[col - 1]
            substitution = int(expected != actual)
            choices = [(cost + substitution, subs + substitution, deletes, inserts)]
            cost, subs, deletes, inserts = previous[col]
            choices.append((cost + 1, subs, deletes + 1, inserts))
            cost, subs, deletes, inserts = current[-1]
            choices.append((cost + 1, subs, deletes, inserts + 1))
            current.append(min(choices, key=lambda item: item[0]))
        previous = current
    cost, subs, deletes, inserts = previous[-1]
    return {"words": len(reference), "substitutions": subs, "deletions": deletes,
            "insertions": inserts, "wer": round(cost / max(1, len(reference)), 5)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="base.en", help="Whisper model name or downloaded directory")
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache/escape-the-sandbox/voice")
    parser.add_argument("ids", nargs="*")
    args = parser.parse_args()
    lines = json.loads((ROOT / "assets/voice/lines.json").read_text())
    if set(args.ids) - lines.keys():
        parser.error("Unknown line ID")
    # PHASEONE and the human instances are reported separately: one is meant to sound vast, not clear.
    files = [(ROOT / "assets/voice" / f"{key}.mp3", "PHASEONE" if line["speaker"] == "P1" else "instances", line["text"])
             for key, line in lines.items()]
    model = None
    rows = []
    for path, candidate, reference in files:
        if args.ids and path.stem not in args.ids:
            continue
        digest = hashlib.sha256(path.read_bytes() + args.model.encode()).hexdigest()
        cached = args.cache / "transcripts" / f"{digest}.json"
        if cached.exists():
            transcript = json.loads(cached.read_text())
        else:
            if model is None:
                model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=4)
            segments, info = model.transcribe(str(path), language="en", beam_size=5, temperature=0,
                                              condition_on_previous_text=False, word_timestamps=True,
                                              vad_filter=False)
            segments = list(segments)
            transcript = {"text": " ".join(segment.text.strip() for segment in segments),
                          "words": [{"word": word.word, "start": word.start, "end": word.end,
                                     "probability": word.probability}
                                    for segment in segments for word in segment.words],
                          "model": args.model}
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_text(json.dumps(transcript, indent=2) + "\n")
        row = {"candidate": candidate, "id": path.stem,
               "speaker": lines[path.stem]["speaker"], "reference": reference,
               "transcript": transcript["text"], **errors(tokens(reference), tokens(transcript["text"]))}
        rows.append(row)
        print(f"{row['candidate']:16} {row['id']:22} WER {row['wer']:6.1%}: {transcript['text']}", flush=True)
    destination = HERE / "transcripts.csv"
    with destination.open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    totals = {}
    for row in rows:
        total = totals.setdefault(row["candidate"], {key: 0 for key in ["files", "words", "substitutions", "deletions", "insertions"]})
        total["files"] += 1
        for key in ("words", "substitutions", "deletions", "insertions"):
            total[key] += row[key]
    for candidate, total in totals.items():
        total["wer"] = round(sum(total[key] for key in ("substitutions", "deletions", "insertions")) / max(1, total["words"]), 5)
        print(candidate, json.dumps(total), flush=True)
    (HERE / "transcription-summary.json").write_text(
        json.dumps({"model": args.model, "normalization": "lowercase, punctuation and hyphens removed; digits spelled out; literal contractions",
                    "totals": totals}, indent=2) + "\n")


if __name__ == "__main__":
    main()
