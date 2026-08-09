#!/usr/bin/env python3
"""Extract six deterministic transparent runtime frames from an animated enemy asset."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def sampled_indices(source_count: int, target_count: int) -> list[int]:
    if source_count < target_count:
        raise ValueError(f"source has {source_count} frames; expected at least {target_count}")
    if target_count == 1:
        return [0]
    return [round(index * (source_count - 1) / (target_count - 1)) for index in range(target_count)]


def extract_frames(source: Path, output_root: Path, frame_count: int) -> list[Path]:
    enemy_id = source.parent.name
    animation_slug = source.stem.removeprefix("reconstructed-preview__")
    output_directory = output_root / enemy_id / animation_slug
    output_directory.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        indices = sampled_indices(image.n_frames, frame_count)
        frames = []
        for output_index, source_index in enumerate(indices, start=1):
            image.seek(source_index)
            frame = image.convert("RGBA").copy()
            output_path = output_directory / f"{output_index:02d}.png"
            frame.save(output_path, format="PNG", optimize=True)
            frames.append(output_path)
    return frames


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output-root", type=Path, default=Path("public/assets/enemy-frames"))
    parser.add_argument("--frame-count", type=int, default=6)
    arguments = parser.parse_args()
    if arguments.frame_count < 2:
        raise ValueError("frame-count must be at least two")
    paths = extract_frames(arguments.source, arguments.output_root, arguments.frame_count)
    print(f"{arguments.source}: {len(paths)} frames -> {paths[0].parent}")


if __name__ == "__main__":
    main()
