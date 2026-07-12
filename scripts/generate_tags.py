#!/usr/bin/env python3
"""
generate_tags.py — Big Book Pacer auto-tagging pass

What it does
------------
1. Walks library/master.json and identifies every RC question (a "verbal"
   section question on a page >= the section's first passage page) and every
   CR question (all questions in "cr" sections). SC/analogy/antonym and all
   quant questions are skipped — they have no sub-type taxonomy.
2. For each RC/CR question, sends the question crop (and, for RC, the
   relevant passage crop) to the Anthropic API and asks for exactly one
   sub-type label from the fixed taxonomy below, plus a confidence score.
3. For RC questions, also computes a cheap passage-length bucket from the
   passage image's pixel height (no OCR, no extra API call).
4. Writes results incrementally to library/tags.json, keyed by the same
   "test-sid-q" qKey the app already uses (see js/data.js). Safe to stop and
   re-run: already-tagged keys are skipped.

Usage
-----
    export ANTHROPIC_API_KEY=sk-ant-...
    pip install anthropic --break-system-packages
    python3 scripts/generate_tags.py                 # tag everything untagged
    python3 scripts/generate_tags.py --test 1         # just test 1 (dry run friendly)
    python3 scripts/generate_tags.py --limit 20        # first 20 only, for a cost check
    python3 scripts/generate_tags.py --dry-run         # print what would be sent, no API calls

Cost/time notes
----------------
~911 questions to tag (581 RC + 330 CR) as of this handoff. Each call sends
1-2 small JPEGs (~5-60KB) and a short prompt. Run --limit 20 first and check
the output before committing to a full run — this is the "scoping" step the
original handoff flagged as needed before starting.
"""

import argparse
import base64
import json
import os
import struct
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER_PATH = ROOT / "library" / "master.json"
TAGS_PATH = ROOT / "library" / "tags.json"

RC_SUBTYPES = [
    "inference", "main-idea", "detail", "vocab-in-context", "tone", "structure",
]
CR_SUBTYPES = [
    "weaken", "strengthen", "assumption", "inference", "paradox",
    "evaluate", "bold-face", "parallel",
]

TAXONOMY_BY_TYPE = {"rc": RC_SUBTYPES, "cr": CR_SUBTYPES}


def q_key(test, sid, q):
    return f"{test}-{sid}-{q}"


def load_master():
    with open(MASTER_PATH) as f:
        return json.load(f)


def load_tags():
    if TAGS_PATH.exists():
        with open(TAGS_PATH) as f:
            return json.load(f)
    return {}


def save_tags(tags):
    TAGS_PATH.write_text(json.dumps(tags, indent=2, sort_keys=True))


def png_or_jpeg_height(path):
    """Cheap image height read without pulling in Pillow. Falls back to None."""
    try:
        with open(path, "rb") as f:
            head = f.read(32)
        if head[:2] == b"\xff\xd8":  # JPEG
            with open(path, "rb") as f:
                f.seek(2)
                while True:
                    marker = f.read(2)
                    if len(marker) < 2 or marker[0] != 0xFF:
                        return None
                    if marker[1] in (0xC0, 0xC2):
                        f.read(3)
                        h = struct.unpack(">H", f.read(2))[0]
                        return h
                    seg_len = struct.unpack(">H", f.read(2))[0]
                    f.seek(seg_len - 2, 1)
        if head[:8] == b"\x89PNG\r\n\x1a\n":  # PNG
            return struct.unpack(">I", head[20:24])[0]
    except Exception:
        return None
    return None


def passage_length_bucket(height_px):
    if height_px is None:
        return "unknown"
    if height_px < 900:
        return "short"
    if height_px < 1600:
        return "medium"
    return "long"


def collect_targets(master):
    """Returns list of dicts: {qkey, type, test, sid, q, question_img, passage_img}"""
    targets = []
    for sec in master:
        test, sid, kind = sec["test"], sec["sid"], sec["kind"]
        base_dir = ROOT / f"t{test:02d}" / sid

        if kind == "cr":
            for q in sec["questions"]:
                targets.append({
                    "qkey": q_key(test, sid, q["q"]),
                    "type": "cr",
                    "test": test, "sid": sid, "q": q["q"],
                    "question_img": base_dir / q["img"],
                    "passage_img": None,
                })

        elif kind == "verbal":
            passages = [c for c in sec.get("contexts", []) if c.get("type") == "passage"]
            if not passages:
                continue  # SC/analogy/antonym only section, nothing to tag
            min_passage_page = min(c["page"] for c in passages)
            # naive nearest-passage assignment: last passage whose page <= question page
            passages_sorted = sorted(passages, key=lambda c: c["page"])
            for q in sec["questions"]:
                if q["page"] < min_passage_page:
                    continue  # SC/analogy/antonym question, skip
                nearest = passages_sorted[0]
                for p in passages_sorted:
                    if p["page"] <= q["page"]:
                        nearest = p
                targets.append({
                    "qkey": q_key(test, sid, q["q"]),
                    "type": "rc",
                    "test": test, "sid": sid, "q": q["q"],
                    "question_img": base_dir / q["img"],
                    "passage_img": base_dir / nearest["img"],
                })
    return targets


def b64_image(path):
    data = path.read_bytes()
    media_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return media_type, base64.b64encode(data).decode()


def build_prompt(qtype):
    labels = TAXONOMY_BY_TYPE[qtype]
    kind_name = "reading comprehension" if qtype == "rc" else "critical reasoning"
    return (
        f"This is a GRE {kind_name} question crop"
        + (" and its passage" if qtype == "rc" else "")
        + f". Classify the question into exactly one of these sub-types: "
        f"{', '.join(labels)}. "
        "Respond with ONLY a JSON object, no other text: "
        '{"subType": "<one label from the list>", "confidence": <0.0-1.0>}'
    )


def tag_one(client, target, model="claude-sonnet-4-6"):
    content = []
    media_type, b64 = b64_image(target["question_img"])
    content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})
    if target["passage_img"] and target["passage_img"].exists():
        pmedia, pb64 = b64_image(target["passage_img"])
        content.append({"type": "image", "source": {"type": "base64", "media_type": pmedia, "data": pb64}})
    content.append({"type": "text", "text": build_prompt(target["type"])})

    resp = client.messages.create(
        model=model,
        max_tokens=200,
        messages=[{"role": "user", "content": content}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    text = text.strip("`").replace("json\n", "").strip()
    parsed = json.loads(text)
    return parsed["subType"], float(parsed.get("confidence", 0.0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", type=int, default=None, help="only this test number")
    ap.add_argument("--limit", type=int, default=None, help="stop after N new tags (for a cost check)")
    ap.add_argument("--dry-run", action="store_true", help="print targets, make no API calls")
    ap.add_argument("--model", default="claude-sonnet-4-6")
    args = ap.parse_args()

    master = load_master()
    tags = load_tags()
    targets = collect_targets(master)
    if args.test is not None:
        targets = [t for t in targets if t["test"] == args.test]
    targets = [t for t in targets if t["qkey"] not in tags]

    print(f"{len(targets)} untagged RC/CR questions to process"
          + (f" (test {args.test} only)" if args.test else ""))

    if args.dry_run:
        for t in targets[: args.limit or 20]:
            print(t["qkey"], t["type"], t["question_img"].name,
                  t["passage_img"].name if t["passage_img"] else "-")
        return

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set. Export it and re-run.", file=sys.stderr)
        sys.exit(1)

    try:
        import anthropic
    except ImportError:
        print("Run: pip install anthropic --break-system-packages", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    processed = 0
    for t in targets:
        if args.limit and processed >= args.limit:
            break
        if not t["question_img"].exists():
            continue
        try:
            sub_type, confidence = tag_one(client, t, model=args.model)
        except Exception as e:
            print(f"  FAILED {t['qkey']}: {e}", file=sys.stderr)
            continue

        entry = {
            "type": t["type"],
            "subType": sub_type,
            "confidence": round(confidence, 2),
            "source": "auto",
        }
        if t["type"] == "rc" and t["passage_img"]:
            h = png_or_jpeg_height(t["passage_img"])
            entry["passageLength"] = passage_length_bucket(h)

        tags[t["qkey"]] = entry
        processed += 1
        print(f"  {t['qkey']:14s} -> {sub_type:20s} ({confidence:.2f})")

        if processed % 10 == 0:
            save_tags(tags)  # checkpoint every 10 so a crash doesn't lose progress
        time.sleep(0.2)  # light throttle

    save_tags(tags)
    print(f"Done. {processed} new tags written. {len(tags)} total in {TAGS_PATH}.")


if __name__ == "__main__":
    main()
