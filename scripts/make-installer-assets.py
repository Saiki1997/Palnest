#!/usr/bin/env python3
"""Build NSIS wizard bitmaps + a multi-size ICO from the Palnest nest mark."""
from __future__ import annotations

import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "electron" / "resources"
WIZ = RES / "wizard"
ICON_PNG = RES / "icon.png"

TEAL = (78, 201, 196)
TEAL_DIM = (26, 61, 56)
BG = (12, 17, 16)
BG2 = (16, 38, 35)
INK = (215, 236, 232)
MUTED = (138, 163, 173)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    path = Path("/usr/share/fonts/truetype/dejavu") / name
    return ImageFont.truetype(str(path), size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vertical_gradient(size, top, bottom):
    w, h = size
    im = Image.new("RGB", size, top)
    px = im.load()
    for y in range(h):
        c = lerp(top, bottom, y / max(h - 1, 1))
        for x in range(w):
            px[x, y] = c
    return im


def load_mark(size: int) -> Image.Image:
    mark = Image.open(ICON_PNG).convert("RGBA")
    mark = mark.resize((size, size), Image.Resampling.LANCZOS)
    glow = Image.new("RGBA", (size + 24, size + 24), (0, 0, 0, 0))
    blob = Image.new("L", (size + 24, size + 24), 0)
    d = ImageDraw.Draw(blob)
    d.ellipse((4, 4, size + 20, size + 20), fill=90)
    blob = blob.filter(ImageFilter.GaussianBlur(8))
    tint = Image.new("RGBA", glow.size, (*TEAL, 0))
    tint.putalpha(blob)
    out = Image.new("RGBA", glow.size, (0, 0, 0, 0))
    out = Image.alpha_composite(out, tint)
    out.paste(mark, (12, 12), mark)
    return out


def save_bmp(im: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "BMP")


def sidebar() -> None:
    w, h = 164, 314
    im = vertical_gradient((w, h), BG, BG2)
    draw = ImageDraw.Draw(im)
    draw.rectangle((0, 0, 3, h), fill=TEAL)
    draw.ellipse((18, 28, 146, 156), outline=TEAL_DIM, width=2)
    mark = load_mark(88)
    im.paste(mark, (26, 42), mark)
    title = font(18, bold=True)
    sub = font(11)
    ver = font(10)
    draw.text((18, 188), "PALNEST", font=title, fill=INK)
    draw.text((18, 214), "Palworld Server", font=sub, fill=MUTED)
    draw.text((18, 230), "& Mod Manager", font=sub, fill=MUTED)
    draw.line((18, 258, 146, 258), fill=TEAL_DIM, width=1)
    draw.text((18, 270), "Setup wizard  2.3.0", font=ver, fill=TEAL)
    draw.text((18, 290), "Choose folder + shortcuts", font=ver, fill=MUTED)
    save_bmp(im, WIZ / "sidebar.bmp")


def header() -> None:
    w, h = 150, 57
    im = vertical_gradient((w, h), BG2, BG)
    draw = ImageDraw.Draw(im)
    draw.rectangle((0, h - 2, w, h), fill=TEAL)
    mark = Image.open(ICON_PNG).convert("RGBA").resize((32, 32), Image.Resampling.LANCZOS)
    im.paste(mark, (10, 12), mark)
    draw.text((50, 12), "Palnest", font=font(14, bold=True), fill=INK)
    draw.text((50, 32), "Setup 2.3.0", font=font(10), fill=MUTED)
    save_bmp(im, WIZ / "header.bmp")


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def write_ico(images: list[Image.Image], dest: Path) -> None:
    pngs = [png_bytes(im) for im in images]
    count = len(pngs)
    header = struct.pack("<HHH", 0, 1, count)
    entries = []
    offset = 6 + 16 * count
    body = b""
    for im, png in zip(images, pngs):
        w = 0 if im.width >= 256 else im.width
        h = 0 if im.height >= 256 else im.height
        entries.append(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(png), offset))
        body += png
        offset += len(png)
    dest.write_bytes(header + b"".join(entries) + body)


def ico() -> None:
    base = Image.open(ICON_PNG).convert("RGBA")
    sizes = [16, 24, 32, 48, 64, 128, 256]
    imgs = [base.resize((s, s), Image.Resampling.LANCZOS) for s in sizes]
    write_ico(imgs, RES / "icon.ico")


def main() -> None:
    WIZ.mkdir(parents=True, exist_ok=True)
    sidebar()
    header()
    ico()
    print("wrote", WIZ / "sidebar.bmp", (WIZ / "sidebar.bmp").stat().st_size)
    print("wrote", WIZ / "header.bmp", (WIZ / "header.bmp").stat().st_size)
    print("wrote", RES / "icon.ico", (RES / "icon.ico").stat().st_size)


if __name__ == "__main__":
    main()
