"""Validate transparency without mistaking dark sprite details for a black matte."""

from __future__ import annotations

import argparse
from collections import deque
import json
from pathlib import Path
import sys

from PIL import Image


MAX_BORDER_MATTE_RATIO = 0.01
MIN_TRANSPARENT_RATIO = 0.03
MIN_VISIBLE_DARK_DETAIL_RATIO = 0.005


def border_matte_ratio(image: Image.Image) -> float:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_opaque_black(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha > 250 and red < 24 and green < 24 and blue < 24

    for x in range(width):
        if is_opaque_black(x, 0):
            queue.append((x, 0))
        if is_opaque_black(x, height - 1):
            queue.append((x, height - 1))
    for y in range(height):
        if is_opaque_black(0, y):
            queue.append((0, y))
        if is_opaque_black(width - 1, y):
            queue.append((width - 1, y))

    matte_pixels = 0
    while queue:
        x, y = queue.popleft()
        offset = y * width + x
        if visited[offset] or not is_opaque_black(x, y):
            continue
        visited[offset] = 1
        matte_pixels += 1
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                next_offset = next_y * width + next_x
                if not visited[next_offset]:
                    queue.append((next_x, next_y))

    return matte_pixels / (width * height)


def inspect(path: Path) -> dict[str, float | int | str]:
    with Image.open(path) as source:
        frame_count = getattr(source, "n_frames", 1)
        maximum_border_matte = 0.0
        minimum_transparency = 1.0
        maximum_dark_detail = 0.0
        for frame_index in range(frame_count):
            source.seek(frame_index)
            rgba = source.convert("RGBA")
            pixel_count = rgba.width * rgba.height
            alpha_histogram = rgba.getchannel("A").histogram()
            minimum_transparency = min(minimum_transparency, sum(alpha_histogram[:8]) / pixel_count)
            maximum_border_matte = max(maximum_border_matte, border_matte_ratio(rgba))
            red, green, blue, alpha = rgba.split()
            dark_detail = sum(
                1
                for red_value, green_value, blue_value, alpha_value in zip(
                    red.get_flattened_data(),
                    green.get_flattened_data(),
                    blue.get_flattened_data(),
                    alpha.get_flattened_data(),
                )
                if alpha_value > 32 and red_value < 64 and green_value < 64 and blue_value < 64
            ) / pixel_count
            maximum_dark_detail = max(maximum_dark_detail, dark_detail)

    return {
        "path": path.as_posix(),
        "frames": frame_count,
        "maxBorderMatteRatio": maximum_border_matte,
        "minTransparentRatio": minimum_transparency,
        "maxVisibleDarkDetailRatio": maximum_dark_detail,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="*", type=Path)
    parser.add_argument("--stdin-json", action="store_true")
    args = parser.parse_args()
    paths = args.paths
    if args.stdin_json:
        paths.extend(Path(value) for value in json.load(sys.stdin))

    reports = []
    failures = []
    for path in sorted(set(paths)):
        if not path.is_file():
            failures.append(f"missing: {path.as_posix()}")
            continue
        report = inspect(path)
        reports.append(report)
        if report["maxBorderMatteRatio"] > MAX_BORDER_MATTE_RATIO:
            failures.append(f"border matte: {path.as_posix()} ({report['maxBorderMatteRatio']:.4f})")
        if report["minTransparentRatio"] < MIN_TRANSPARENT_RATIO:
            failures.append(f"insufficient transparency: {path.as_posix()} ({report['minTransparentRatio']:.4f})")
        if report["maxVisibleDarkDetailRatio"] < MIN_VISIBLE_DARK_DETAIL_RATIO:
            failures.append(f"dark sprite detail missing: {path.as_posix()} ({report['maxVisibleDarkDetailRatio']:.4f})")

    print(json.dumps({"checked": len(reports), "failures": failures, "assets": reports}, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
