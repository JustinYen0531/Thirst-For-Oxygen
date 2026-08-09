"""Turn one chroma-keyed 3x2 boss sheet into tracked game assets.

The six transparent PNG frames are the editable source assets.  The resulting
GIF is copied to public/ for the encyclopedia and formal play.  The afterimage
WebP remains a separate step so it can reuse the project's shared trail
generator.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from PIL import Image


SHEET_SIZE = (1536, 1024)
FRAME_SIZE = (512, 512)
FRAME_COUNT = 6
PREVIEW_DURATION_MS = 240
CHROMA_HELPER = Path(
    r"C:\Users\閻星澄\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py"
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--enemy-id", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--key-color", required=True)
    parser.add_argument("--gdd-root", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    return parser.parse_args()


def _run_chroma_helper(source: Path, target: Path, key_color: str) -> None:
    if not CHROMA_HELPER.exists():
        raise SystemExit(f"Missing imagegen chroma helper: {CHROMA_HELPER}")
    subprocess.run(
        [
            sys.executable,
            str(CHROMA_HELPER),
            "--input",
            str(source),
            "--out",
            str(target),
            "--key-color",
            key_color,
            "--soft-matte",
            "--transparent-threshold",
            "80",
            "--opaque-threshold",
            "180",
            "--despill",
            "--edge-contract",
            "1",
            "--edge-feather",
            "0.6",
            "--force",
        ],
        check=True,
    )


def _clear_cell_border(frame: Image.Image) -> Image.Image:
    """Remove any generated grid hairline without touching the sprite."""
    cleaned = frame.copy()
    pixels = cleaned.load()
    width, height = cleaned.size
    for x in range(width):
        pixels[x, 0] = (0, 0, 0, 0)
        pixels[x, height - 1] = (0, 0, 0, 0)
    for y in range(height):
        pixels[0, y] = (0, 0, 0, 0)
        pixels[width - 1, y] = (0, 0, 0, 0)
    return cleaned


def _to_gif_frame(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    paletted = frame.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    transparent = Image.new("L", frame.size, 0)
    transparent.paste(255, mask=alpha.point(lambda value: 255 if value <= 8 else 0))
    paletted.paste(255, mask=transparent)
    paletted.info["transparency"] = 255
    return paletted


def main() -> None:
    args = _parse_args()
    source = args.input.resolve()
    if not source.exists():
        raise SystemExit(f"Missing source sheet: {source}")

    asset_root = args.gdd_root / "重構素材"
    frame_root = asset_root / "sprite_frames" / args.slug
    preview_root = asset_root / "preview_gifs"
    public_root = args.public_root / args.enemy_id
    for folder in (frame_root, preview_root, public_root):
        folder.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="boss-sprite-sheet-") as workdir:
        transparent_sheet = Path(workdir) / f"{args.slug}__transparent.png"
        _run_chroma_helper(source, transparent_sheet, args.key_color)
        with Image.open(transparent_sheet) as sheet_image:
            sheet = sheet_image.convert("RGBA")
    if sheet.size != SHEET_SIZE:
        raise SystemExit(f"Expected {SHEET_SIZE}, got {sheet.size}: {source}")

    frames: list[Image.Image] = []
    warnings: list[str] = []
    for index in range(FRAME_COUNT):
        column = index % 3
        row = index // 3
        left = column * FRAME_SIZE[0]
        top = row * FRAME_SIZE[1]
        frame = sheet.crop((left, top, left + FRAME_SIZE[0], top + FRAME_SIZE[1]))
        frame = _clear_cell_border(frame)
        alpha = frame.getchannel("A")
        bbox = alpha.getbbox()
        if bbox is None:
            raise SystemExit(f"Frame {index + 1} is empty: {source}")
        transparent_ratio = sum(value == 0 for value in alpha.get_flattened_data()) / (FRAME_SIZE[0] * FRAME_SIZE[1])
        if transparent_ratio < 0.08:
            warnings.append(f"frame-{index + 1:02d} low transparency={transparent_ratio:.3f}")
        if bbox[0] <= 1 or bbox[1] <= 1 or bbox[2] >= FRAME_SIZE[0] - 1 or bbox[3] >= FRAME_SIZE[1] - 1:
            warnings.append(f"frame-{index + 1:02d} touches cell edge bbox={bbox}")
        frame_path = frame_root / f"{args.enemy_id}__{args.slug}__{index + 1:02d}.png"
        frame.save(frame_path, format="PNG", optimize=True)
        frames.append(frame)

    preview_name = f"reconstructed-preview__{args.slug}.gif"
    preview_path = preview_root / preview_name
    public_path = public_root / preview_name
    gif_frames = [_to_gif_frame(frame) for frame in frames]
    gif_frames[0].save(
        preview_path,
        format="GIF",
        save_all=True,
        append_images=gif_frames[1:],
        duration=PREVIEW_DURATION_MS,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )
    shutil.copy2(preview_path, public_path)

    print(
        f"processed enemy={args.enemy_id} slug={args.slug} frames={len(frames)} "
        f"preview={preview_path} public={public_path}"
    )
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)


if __name__ == "__main__":
    main()
