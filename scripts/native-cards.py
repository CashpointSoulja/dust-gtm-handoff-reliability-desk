#!/usr/bin/env python3
"""Frames each native GTMHandoffBrief preview capture as a labelled 1080x1920 still for the walkthrough.
The capture itself is only cropped (right half, the agent panel) and scaled; nothing in it is redrawn.
Usage: native-cards.py CAPTURE_DIR OUT_DIR"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

src_dir, out_dir = sys.argv[1:3]
os.makedirs(out_dir, exist_ok=True)
F = subprocess.check_output(["fc-match", "-f", "%{file}", "DejaVu Sans"]).decode()
FB = subprocess.check_output(["fc-match", "-f", "%{file}", "DejaVu Sans:bold"]).decode()
ITEMS = [("native-normal-draft.png", "Normal packet → draft", "pkt-100102-5139c008"),
         ("native-citations.png", "Each context line cites a packet source", "pkt-100102-5139c008"),
         ("native-missing-fields.png", "Missing evidence → refused", "pkt-100106-d75d9a89"),
         ("native-owner-conflict.png", "Ownership conflict → refused", "pkt-100108-f40534bf")]
for i, (f, title, pk) in enumerate(ITEMS, 1):
    src = Image.open(os.path.join(src_dir, f)).convert("RGB")
    w, h = src.size
    src = src.crop((w // 2, 0, w, h))
    img = Image.new("RGB", (1080, 1920), (28, 25, 23)); d = ImageDraw.Draw(img)
    d.rounded_rectangle((40, 50, 1040, 240), 24, fill=(255, 170, 13))
    d.text((70, 70), "NATIVE DUST UI CAPTURE", font=ImageFont.truetype(FB, 40), fill=(28, 25, 23))
    d.text((70, 125), "GTMHandoffBrief preview · captured in Ayo's workspace", font=ImageFont.truetype(F, 31), fill=(28, 25, 23))
    d.text((70, 175), "Actual native preview capture, shown as a still. Not recreated.", font=ImageFont.truetype(F, 26), fill=(28, 25, 23))
    ft = ImageFont.truetype(FB, 44)
    while d.textlength(title, font=ft) > 960: ft = ImageFont.truetype(FB, ft.size - 2)
    d.text((60, 275), title, font=ft, fill=(255, 255, 255))
    d.text((60, 340), pk, font=ImageFont.truetype(F, 32), fill=(214, 211, 209))
    img.paste(src.resize((1080, round(1080 * src.height / src.width)), Image.LANCZOS), (0, 405))
    img.save(os.path.join(out_dir, f"native-{i}.jpg"), quality=95)
print("wrote", len(ITEMS), "stills to", out_dir)
