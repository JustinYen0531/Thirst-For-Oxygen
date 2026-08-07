"""Remove connected black matte pixels from animated GIFs without redrawing sprites.

The authored previews use a black canvas, but some frames carry that canvas as
opaque pixels while others use a GIF transparency index. A border flood-fill
keeps black details inside the enemy intact and converts only the matte to GIF
transparency.
"""

from __future__ import annotations

import argparse
from collections import Counter, deque
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageSequence


BACKGROUND_TOLERANCE = 24
TRANSPARENT_INDEX = 255
TRANSPARENT_RGB = (255, 0, 255)


def matte_mask(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    border_colours = []
    for x in range(width):
        for y in (0, height - 1):
            red, green, blue, alpha = pixels[x, y]
            if alpha:
                border_colours.append((red, green, blue))
    for y in range(1, height - 1):
        for x in (0, width - 1):
            red, green, blue, alpha = pixels[x, y]
            if alpha:
                border_colours.append((red, green, blue))
    background_colour = Counter(border_colours).most_common(1)[0][0] if border_colours else (0, 0, 0)

    def is_matte(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha == 0 or max(abs(red - background_colour[0]), abs(green - background_colour[1]), abs(blue - background_colour[2])) <= BACKGROUND_TOLERANCE

    for x in range(width):
        if is_matte(x, 0):
            queue.append((x, 0))
        if is_matte(x, height - 1):
            queue.append((x, height - 1))
    for y in range(height):
        if is_matte(0, y):
            queue.append((0, y))
        if is_matte(width - 1, y):
            queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        offset = y * width + x
        if visited[offset] or not is_matte(x, y):
            continue
        visited[offset] = 1
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                next_offset = next_y * width + next_x
                if not visited[next_offset]:
                    queue.append((next_x, next_y))

    return Image.frombytes("L", (width, height), bytes(visited))


def transparent_frame(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    mask = matte_mask(rgba)
    rgb = rgba.convert("RGB")
    rgb.paste(TRANSPARENT_RGB, mask=mask)
    indexed = rgb.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    palette = indexed.getpalette()
    palette.extend([0] * (768 - len(palette)))
    palette[TRANSPARENT_INDEX * 3:TRANSPARENT_INDEX * 3 + 3] = list(TRANSPARENT_RGB)
    indexed.putpalette(palette)
    indexed_pixels = list(indexed.get_flattened_data())
    for offset, is_matte in enumerate(mask.get_flattened_data()):
        if is_matte:
            indexed_pixels[offset] = TRANSPARENT_INDEX
    indexed.putdata(indexed_pixels)
    indexed.info["transparency"] = TRANSPARENT_INDEX
    return indexed


def process_gif(path: Path) -> tuple[int, int]:
    with Image.open(path) as source:
        frames = []
        durations = []
        for frame in ImageSequence.Iterator(source):
            frames.append(transparent_frame(frame))
            durations.append(frame.info.get("duration", source.info.get("duration", 100)))
        loop = source.info.get("loop", 0)
    if not frames:
        return (0, 0)
    temp = NamedTemporaryFile(suffix=".gif", dir=path.parent, delete=False)
    temporary_path = Path(temp.name)
    temp.close()
    try:
        frames[0].save(
            temporary_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=loop,
            # Full transparent frames avoid GIF delta/disposal compositing
            # reintroducing an opaque matte on later frames in some viewers.
            disposal=1,
            transparency=TRANSPARENT_INDEX,
            optimize=False,
        )
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return (len(frames), sum(1 for frame in frames if frame.info.get("transparency") == TRANSPARENT_INDEX))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("roots", nargs="+", type=Path)
    args = parser.parse_args()
    paths = sorted({path for root in args.roots for path in (root.rglob("*.gif") if root.is_dir() else [root]) if path.suffix.lower() == ".gif"})
    total_frames = 0
    for path in paths:
        frames, _ = process_gif(path)
        total_frames += frames
    print(f"processed_gifs={len(paths)} frames={total_frames}")


if __name__ == "__main__":
    main()
