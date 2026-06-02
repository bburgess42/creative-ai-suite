"""Generate short narration clips via ElevenLabs text-to-speech.

Idempotent: skips a clip that already exists unless --force. Demonstrates
model selection (v3 for audio-tag support vs multilingual_v2) and per-clip
voice tuning.

Usage:
  python tts_narration.py                 # render all clips in SCRIPTS
  python tts_narration.py --only intro    # render one
  python tts_narration.py --force         # overwrite existing

Requires ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the environment.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import requests

OUTPUT_DIR = Path("out") / "narration"

# Example clips. The intro uses an [audio tag], which only eleven_v3 honours.
SCRIPTS = {
    "intro": "[whispers] Welcome.",
    "outro": (
        "Thanks for listening. "
        '<break time="0.4s"/> '
        "Subscribe for more."
    ),
}

# Per-clip voice tuning. Lower stability lets audio tags express on v3;
# higher stability flattens dynamics for a smooth, even outro.
VOICE_SETTINGS = {
    "intro": {"stability": 0.40, "similarity_boost": 0.75, "style": 0.00},
    "outro": {"stability": 0.82, "similarity_boost": 0.80, "style": 0.00, "use_speaker_boost": True},
}


def generate(label: str, text: str, voice_id: str, api_key: str, force: bool) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / f"{label}.mp3"
    if out.exists() and not force:
        print(f"[skip] {out.name} already exists (use --force to regenerate)")
        return out

    # [audio tags] require eleven_v3; the plain outro stays on multilingual_v2.
    model_id = "eleven_v3" if "[" in text else "eleven_multilingual_v2"
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    body = {"text": text, "model_id": model_id, "voice_settings": VOICE_SETTINGS[label]}

    print(f"[gen ] {label}: {len(text)} chars -> {out.name} ({model_id})")
    r = requests.post(url, headers=headers, json=body, timeout=60)
    if not r.ok:
        print(f"ElevenLabs error {r.status_code}: {r.text[:300]}", file=sys.stderr)
        sys.exit(1)
    out.write_bytes(r.content)
    print(f"[ok  ] wrote {out} ({len(r.content)} bytes)")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate narration via ElevenLabs")
    ap.add_argument("--only", choices=list(SCRIPTS), help="only generate one clip")
    ap.add_argument("--force", action="store_true", help="overwrite existing files")
    args = ap.parse_args()

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not api_key or not voice_id:
        print("missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in env", file=sys.stderr)
        sys.exit(1)

    targets = [args.only] if args.only else list(SCRIPTS)
    for label in targets:
        generate(label, SCRIPTS[label], voice_id, api_key, args.force)


if __name__ == "__main__":
    main()
