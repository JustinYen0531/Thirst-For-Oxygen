from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def slice_sheet(source: Path, output_dir: Path, action: str, preview_dir: Path) -> None:
    sheet = Image.open(source).convert("RGBA")
    if sheet.size != (1536, 1024):
        raise ValueError(f"{source} must be 1536x1024, got {sheet.size}")

    output_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    cell_width, cell_height = 512, 512
    for index in range(6):
        column = index % 3
        row = index // 3
        # The generated work sheet has a thin white grid. Trim it before
        # resizing so the grid never becomes part of an independent frame.
        left = column * cell_width + 4
        top = row * cell_height + 4
        right = (column + 1) * cell_width - 4
        bottom = (row + 1) * cell_height - 4
        frame = sheet.crop((left, top, right, bottom)).resize((512, 512), Image.Resampling.LANCZOS)
        frame_path = output_dir / f"player-diver__{action}__{index + 1:02d}.png"
        frame.save(frame_path, format="PNG", optimize=True)
        frames.append(frame)

    preview_path = preview_dir / f"player-diver__{action}.gif"
    frames[0].save(
        preview_path,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=84,
        loop=0,
        disposal=2,
        transparency=0,
    )
    print(f"{action}: frames=6 preview={preview_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Slice a 3x2 player sprite sheet into six transparent PNG frames.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preview-dir", type=Path, required=True)
    parser.add_argument("--action", required=True, choices=("swim", "hurt", "death", "fast-ascent"))
    args = parser.parse_args()
    slice_sheet(args.source, args.output_dir, args.action, args.preview_dir)


if __name__ == "__main__":
    main()
