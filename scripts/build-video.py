#!/usr/bin/env python3
"""Assemble the walkthrough: screencast frames -> 30 fps H.264, per-scene voiceover placed at recorded scene starts,
sentence-level subtitles (SRT + burned in), encoder metadata stripped.
Scenes with "slot": true show native Dust material. In draft mode they get a neutral "reserved" card. In final mode they
show the actual native preview captures (NATIVE_DIR, from native-cards.py) as labelled stills. Each entry in the
scene's native_parts has its own still, voiceover WAV (<scene>-p<n>.wav) and caption, held for slot_seconds, so a
still is on screen exactly while its caption runs. Nothing is animated or recreated.
Usage: NATIVE_DIR=... build-video.py REC_DIR VO_DIR OUT_DIR [draft|final]"""
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
native_dir = os.environ.get("NATIVE_DIR")
if mode == "final" and not native_dir:
    sys.exit("final render needs NATIVE_DIR with the native preview captures")

card = f"{out}/slot-card.jpg"
img = Image.new("RGB", (1080, 1920), (250, 249, 247))
d = ImageDraw.Draw(img)

FONT = subprocess.check_output(["fc-match", "-f", "%{file}", "DejaVu Sans"]).decode()
d.rounded_rectangle((90, 640, 990, 1280), 32, outline=(214, 211, 209), width=4, fill=(255, 255, 255))
lines = [("SCENE RESERVED", 34, (120, 113, 108)), ("Native Dust footage", 60, (28, 25, 23)), ("GTMHandoffBrief in Ayo's workspace", 40, (28, 25, 23)),
         ("To be supplied before the final render.", 34, (120, 113, 108)), ("Nothing here is recorded or recreated.", 34, (120, 113, 108))]
y = 720
for t, s, c in lines:
    f = ImageFont.truetype(FONT, s); w = d.textlength(t, font=f); d.text(((1080 - w) / 2, y), t, font=f, fill=c); y += s + 50
img.save(card, quality=95)

def split_sentences(text):
    return [p.strip() for p in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text) if p.strip()]

frames = [f for f in T["frames"] if f["t"] >= start0 - 2]
# Timeline of (time, image); slot boundaries are inserted so a slot never shows Desk frames.
events = [(max(f["t"], start0), f["file"]) for f in frames]
for a, b in slot_ranges:
    before = [e for e in events if e[0] <= b]
    events.append((a, card)); events.append((b, before[-1][1] if before else frames[0]["file"]))
events = sorted(events, key=lambda e: e[0])
events = [(t, card if any(a <= t < b for a, b in slot_ranges) else img) for t, img in events]
if mode == "final":
    slot_ids = [m["id"] for m in marks if scenes[m["id"]].get("slot")]
    for (a, b), sid in zip(slot_ranges, slot_ids):
        sc = scenes[sid]; starts, stills, off = [], [], 0.25
        for q in sc["native_parts"]:
            f = os.path.join(native_dir, q["still"])
            if not os.path.isfile(f): sys.exit(f"missing native capture {f}")
            starts.append(a + off); stills.append(f); off += q["slot_seconds"]
        starts[0] = a
        events = [e for e in events if not (a <= e[0] < b)]
        events += list(zip(starts, stills))
    events = sorted(events, key=lambda e: e[0])
# Concat needs one frame size throughout: a mid-stream size change resets the filter graph and drops stills.
os.makedirs(f"{out}/scaled", exist_ok=True)
def uniform(path):
    dst = f"{out}/scaled/" + os.path.basename(os.path.dirname(path)) + "-" + os.path.basename(path)
    if not os.path.exists(dst):
        im = Image.open(path)
        (im if im.size == (1080, 1920) else im.convert("RGB").resize((1080, 1920), Image.LANCZOS)).save(dst, quality=93)
    return dst
events = [(t, uniform(p)) for t, p in events]
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
    if mode == "final" and s.get("native_parts"):
        segs = [(f"{vo}/{m['id']}-p{n}.wav", q.get("sub", q["vo"]), q["vo_seconds"], q["slot_seconds"]) for n, q in enumerate(s["native_parts"], 1)]
    else:
        segs = [(f"{vo}/{m['id']}.wav", s.get("sub", s["vo"]), s["vo_seconds"], s["vo_seconds"])]
    for wav, text, vsec, slot in segs:
        inputs += ["-i", wav]; n_in = len(inputs) // 2
        filt.append(f"[{n_in}:a]adelay={int(at*1000)}|{int(at*1000)}[a{n_in}]")
        parts = split_sentences(text)
        total = sum(len(p) for p in parts); t = at
        for j, p in enumerate(parts):
            dd = vsec * len(p) / total
            last = j == len(parts) - 1
            cues.append((t, (at + slot if last else t + dd) - 0.05, p)); t += dd
        at += slot
with open(f"{out}/walkthrough.srt", "w") as fh:
    for i, (a, b, txt) in enumerate(cues, 1):
        fh.write(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n\n")
amix = ";".join(filt) + ";" + "".join(f"[a{k}]" for k in range(1, len(inputs) // 2 + 1)) + f"amix=inputs={len(inputs) // 2}:normalize=0,volume=0.9,alimiter=limit=0.89,apad,atrim=0:{dur:.3f}[aout]"
style = "FontName=DejaVu Sans,FontSize=10,PrimaryColour=&H00FFFFFF,BackColour=&H30171C1C,OutlineColour=&H30171C1C,BorderStyle=3,Outline=6,Shadow=0,MarginV=34,MarginL=36,MarginR=36,Alignment=2"
vf = f"[0:v]fps=30,scale=1080:1920:flags=lanczos,format=yuv420p,subtitles={out}/walkthrough.srt:force_style='{style}'[vout]"
name = f"{out}/gtm-handoff-desk-walkthrough-{mode}.mp4"
# Mix the voiceover to one WAV first, then mux it: keeps audio timestamps monotonic.
mixwav = f"{out}/voice-mix.wav"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", *inputs,
                "-filter_complex", amix.replace("[aout]", ",aresample=48000[aout]"), "-map", "[aout]", "-ar", "48000", "-ac", "1", mixwav], check=True)
cmd = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f"{out}/frames.txt", "-i", mixwav,
       "-filter_complex", vf, "-map", "[vout]", "-map", "1:a",
       "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-bsf:v", "filter_units=remove_types=6",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", f"{dur:.3f}",
       "-map_metadata", "-1", "-map_chapters", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
       "-metadata", "title=GTM Handoff Reliability Desk walkthrough (independent concept by Ayo Ahmed, not affiliated with Dust)",
       "-metadata", "artist=Ayo Ahmed", "-movflags", "+faststart", name]
subprocess.run(cmd, check=True)
print("built", name, f"{dur:.2f}s", len(cues), "cues", "slots", slot_ranges)
