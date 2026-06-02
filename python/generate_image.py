"""Generate images via Google Gemini Imagen, logging spend to the shared ledger.

Usage:
  python generate_image.py --prompt "a calm misty forest at dawn" --out out/forest.png
  python generate_image.py --prompt "..." --out out/forest.png --count 4 --aspect 16:9
  python generate_image.py --prompt "..." --out out/forest.png --model fast

Requires GEMINI_API_KEY in the environment (see ../.env.example).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from google import genai
from google.genai import types

# Friendly tier names -> Imagen 4 model ids.
MODELS = {
    "ultra": "imagen-4.0-ultra-generate-001",
    "standard": "imagen-4.0-generate-001",
    "fast": "imagen-4.0-fast-generate-001",
}


def generate_images(
    prompt: str,
    output_path: str,
    count: int = 1,
    aspect: str = "16:9",
    model: str = "ultra",
) -> list[Path]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    model_id = MODELS.get(model, model)
    print(f"Generating {count} image(s), aspect {aspect}, model {model_id}...")
    print(f"Prompt: {prompt[:120]}...")

    response = client.models.generate_images(
        model=model_id,
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=count,
            aspect_ratio=aspect,
            output_mime_type="image/png",
        ),
    )

    saved: list[Path] = []
    for i, image in enumerate(response.generated_images):
        save_path = out if count == 1 else out.with_stem(f"{out.stem}-{i + 1}")
        save_path.write_bytes(image.image.image_bytes)
        size_kb = save_path.stat().st_size / 1024
        print(f"  Saved: {save_path} ({size_kb:.0f} KB)")
        saved.append(save_path)

    # Log spend to the shared ledger (best-effort; never fail the generation).
    try:
        from cost_tracker import PRICING, log_cost

        cost_per = PRICING["gemini"].get(model_id, 0.06)
        total = log_cost("gemini", model_id, len(saved), cost_per, prompt[:80])
        print(f"\nDone. {len(saved)} image(s) saved. (Cost: ${total:.2f})")
    except Exception:
        print(f"\nDone. {len(saved)} image(s) saved.")
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate images via Gemini Imagen")
    parser.add_argument("--prompt", required=True, help="Image generation prompt")
    parser.add_argument("--out", "-o", required=True, help="Output file path")
    parser.add_argument("--count", "-n", type=int, default=1, help="Number of images (1-4)")
    parser.add_argument(
        "--aspect",
        default="16:9",
        choices=["1:1", "16:9", "9:16", "3:4", "4:3"],
        help="Aspect ratio (default: 16:9)",
    )
    parser.add_argument(
        "--model",
        default="ultra",
        choices=["ultra", "standard", "fast"],
        help="Quality/cost tier (default: ultra)",
    )
    args = parser.parse_args()
    generate_images(args.prompt, args.out, args.count, args.aspect, args.model)


if __name__ == "__main__":
    main()
