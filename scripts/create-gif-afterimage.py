"""Create transparent animated WebP previews with a fading history trail."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageSequence


SAMPLE_COUNT = 4
NEAREST_OPACITY = 0.28
DECAY = 0.58
DRIFT_X = 3.0
DRIFT_Y = -1.5


def with_opacity(image: Image.Image, opacity: float) -> Image.Image:
    ghost = image.copy()
    alpha = ghost.getchannel("A").point(lambda value: round(value * opacity))
    ghost.putalpha(alpha)
    return ghost


def process_gif(source_path: Path, target_path: Path) -> int:
    with Image.open(source_path) as source:
        frames = [frame.convert("RGBA") for frame in ImageSequence.Iterator(source)]
        durations = [frame.info.get("duration", source.info.get("duration", 100)) for frame in ImageSequence.Iterator(source)]
        loop = source.info.get("loop", 0)
    if not frames:
        return 0

    output_frames = []
    for current_index, current in enumerate(frames):
        canvas = Image.new("RGBA", current.size, (0, 0, 0, 0))
        for age in range(SAMPLE_COUNT, 0, -1):
            previous_index = current_index - age
            if previous_index < 0:
                continue
            opacity = NEAREST_OPACITY * (DECAY ** (age - 1))
            ghost = with_opacity(frames[previous_index], opacity)
            canvas.alpha_composite(ghost, dest=(round(age * DRIFT_X), round(age * DRIFT_Y)))
        canvas.alpha_composite(current)
        output_frames.append(canvas)

    target_path.parent.mkdir(parents=True, exist_ok=True)
    output_frames[0].save(
        target_path,
        format="WEBP",
        save_all=True,
        append_images=output_frames[1:],
        duration=durations,
        loop=loop,
        lossless=False,
        quality=85,
        method=4,
    )
    return len(output_frames)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_root", type=Path)
    parser.add_argument("target_root", type=Path)
    args = parser.parse_args()
    paths = sorted(args.source_root.rglob("*.gif"))
    frames = 0
    for source_path in paths:
        relative = source_path.relative_to(args.source_root).with_suffix(".webp")
        frames += process_gif(source_path, args.target_root / relative)
    print(f"processed_gifs={len(paths)} frames={frames}")


if __name__ == "__main__":
    main()
