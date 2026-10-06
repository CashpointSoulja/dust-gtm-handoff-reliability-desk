#!/usr/bin/env python3
"""Assemble the walkthrough: screencast frames -> 30 fps H.264, per-scene voiceover placed at recorded scene starts,
sentence-level subtitles (SRT + burned in), encoder metadata stripped.
Scenes with "slot": true are filled with a neutral "reserved" card in review drafts. The final render replaces the
card with the supplied native Dust footage (never a recreated Dust screen).
Usage: build-video.py REC_DIR VO_DIR OUT_DIR [draft|final]"""
import json, re, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont

rec, vo, out = sys.argv[1:4]
mode = sys.argv[4] if len(sys.argv) > 4 else "draft"
os.makedirs(out, exist_ok=True)
T = json.load(open(f"{rec}/timings.json"))
S = json.load(open(f"{vo}/scenes-timed.json"))
scenes = {s["id"]: s for s in S}
start0 = T["videoStart"] - 0.2
end = T["end"]
marks = T["marks"]
slot_ranges = []
for i, m in enumerate(marks):
    if scenes[m["id"]].get("slot"):
        slot_ranges.append((m["start"], marks[i + 1]["start"] if i + 1 < len(marks) else end))
if mode == "final":
    sys.exit("final render needs the supplied native Dust clip; not available yet")

card = f"{out}/slot-card.png"
img = Image.new("RGB", (1080, 1920), (250, 249, 247))
d = ImageDraw.Draw(img)

FONT = subprocess.check_output(["fc-match", "-f", "%{file}", "DejaVu Sans"]).decode()
d.rounded_rectangle((90, 640, 990, 1280), 32, outline=(214, 211, 209), width=4, fill=(255, 255, 255))
lines = [("SCENE RESERVED", 34, (120, 113, 108)), ("Native Dust footage", 60, (28, 25, 23)), ("GTMHandoffBrief in Ayo's workspace", 40, (28, 25, 23)),
         ("To be supplied before the final render.", 34, (120, 113, 108)), ("Nothing here is recorded or recreated.", 34, (120, 113, 108))]
y = 720
for t, s, c in lines:
    f = ImageFont.truetype(FONT, s); w = d.textlength(t, font=f); d.text(((1080 - w) / 2, y), t, font=f, fill=c); y += s + 50
img.save(card)

frames = [f for f in T["frames"] if f["t"] >= start0 - 2]
# Timeline of (time, image); slot boundaries are inserted so a slot never shows Desk frames.
events = [(max(f["t"], start0), f["file"]) for f in frames]
for a, b in slot_ranges:
    before = [e for e in events if e[0] <= b]
    events.append((a, card)); events.append((b, before[-1][1] if before else frames[0]["file"]))
events = sorted(events, key=lambda e: e[0])
events = [(t, card if any(a <= t < b for a, b in slot_ranges) else img) for t, img in events]
with open(f"{out}/frames.txt", "w") as fh:
    for i, (t, img) in enumerate(events):
        nxt = events[i + 1][0] if i + 1 < len(events) else end
        if nxt <= start0: continue
        fh.write(f"file '{os.path.abspath(img)}'\nduration {max(0.001, nxt - t):.4f}\n")
    fh.write(f"file '{os.path.abspath(events[-1][1])}'\n")
dur = end - start0

def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

cues, inputs, filt = [], [], []
for k, m in enumerate(marks):
    s = scenes[m["id"]]; at = m["start"] - start0 + 0.25
    inputs += ["-i", f"{vo}/{m['id']}.wav"]
    filt.append(f"[{k+1}:a]adelay={int(at*1000)}|{int(at*1000)}[a{k}]")
    text = s.get("sub", s["vo"])
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text) if p.strip()]
    total = sum(len(p) for p in parts); t = at
    for p in parts:
        dd = s["vo_seconds"] * len(p) / total
        cues.append((t, t + dd - 0.05, p)); t += dd
with open(f"{out}/walkthrough.srt", "w") as fh:
    for i, (a, b, txt) in enumerate(cues, 1):
        fh.write(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n\n")
amix = ";".join(filt) + ";" + "".join(f"[a{k}]" for k in range(len(marks))) + f"amix=inputs={len(marks)}:normalize=0,volume=0.9,alimiter=limit=0.89,apad,atrim=0:{dur:.3f}[aout]"
style = "FontName=DejaVu Sans,FontSize=10,PrimaryColour=&H00FFFFFF,BackColour=&H30171C1C,OutlineColour=&H30171C1C,BorderStyle=3,Outline=6,Shadow=0,MarginV=34,MarginL=36,MarginR=36,Alignment=2"
vf = f"[0:v]fps=30,scale=1080:1920:flags=lanczos,format=yuv420p,subtitles={out}/walkthrough.srt:force_style='{style}'[vout]"
name = f"{out}/gtm-handoff-desk-walkthrough-{mode}.mp4"
cmd = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f"{out}/frames.txt", *inputs,
       "-filter_complex", vf + ";" + amix, "-map", "[vout]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-bsf:v", "filter_units=remove_types=6",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", f"{dur:.3f}",
       "-map_metadata", "-1", "-map_chapters", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
       "-metadata", "title=GTM Handoff Reliability Desk walkthrough (independent concept by Ayo Ahmed, not affiliated with Dust)",
       "-metadata", "artist=Ayo Ahmed", "-movflags", "+faststart", name]
subprocess.run(cmd, check=True)
print("built", name, f"{dur:.2f}s", len(cues), "cues", "slots", slot_ranges)
