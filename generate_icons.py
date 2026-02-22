#!/usr/bin/env python3
"""
generate_icons.py — Run this once to create PWA icons
Usage: python generate_icons.py
Requires: Pillow  (pip install)
"""
import os

try:
    from PIL import Image, ImageDraw, ImageFont
    USE_PILLOW = True
except ImportError:
    USE_PILLOW = False

def make_icon_svg(size):
    """Generate a simple SVG icon — no dependencies needed."""
    r = size // 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <rect width="{size}" height="{size}" rx="{size//5}" fill="#0c0c0e"/>
  <circle cx="{r}" cy="{r}" r="{int(r*0.65)}" fill="#e8193c" opacity="0.15"/>
  <circle cx="{r}" cy="{r}" r="{int(r*0.45)}" fill="#e8193c"/>
  <text x="{r}" y="{int(r*1.18)}" font-family="Arial,sans-serif" font-weight="900"
        font-size="{int(r*0.55)}" fill="white" text-anchor="middle">R</text>
</svg>"""

os.makedirs("icons", exist_ok=True)

for size in [192, 512]:
    svg_path = f"icons/icon-{size}.svg"
    with open(svg_path, "w") as f:
        f.write(make_icon_svg(size))
    print(f"✅ Created {svg_path}")

print("\n📌 Note: Convert SVGs to PNGs for best PWA support.")
print("   Online: https://cloudconvert.com/svg-to-png")
print("   Or install Pillow and use cairosvg:")
print("   pip install cairosvg && python -c \"import cairosvg; cairosvg.svg2png(url='icons/icon-192.svg', write_to='icons/icon-192.png', output_width=192, output_height=192)\"")