---
name: reels-motion-pro
description: Make or remake a vertical Reels / YouTube Shorts / TikTok video with motion graphics rendered in code (Remotion): faceless explainers, infographic and "N steps" reels, voice-over reels, prompt lists, kinetic typography. Applies the @iishka26 series style (dark, one orange accent), Apple motion rules (critically damped springs, push transitions, liquid glass) and the retention tactics that work in 2026 (payoff in the first 3 s, pattern break at 2–4 s, phrase captions with the spoken word lit, a visual reset every 2–4 s). Use whenever the user asks to edit, make, remake or improve a reel/short from an image, an infographic, a voice-over, a script or a previous reel, or asks for "motion graphics", "живой ролик", "эффектнее", "как у топовых авторов".
---

# Reels Motion Pro

A reel is a Remotion composition that is a pure function of the frame. Voice, captions and slides are timed to the
speech; slide changes land on the music's beat grid. Everything is drawn in code: no stock, no other author's design.

Read `references/research.md` once per session (what works and why, with sources). Read `references/environment.md`
when running in a cloud container (no HuggingFace, Chromium distrusts the proxy CA, etc.).

## 0. Rules that win over everything below
- Reply in the user's language (Russian for @iishka26), plain words, no file paths or tool names in replies.
- Never rewrite the user's texts, scripts, voice or music without an explicit request. Doubtful wording → a remark.
- Redraw other authors' material (infographics, carousels) in the series style; never show their nick, logo or layout.
  Retell facts only from the source or the speech; anything the agent adds goes to "проверить" in the report.
- Content accuracy: slash-commands and "prompt tricks" are conventions, not built-in features; overclaims stay in the
  voice if the user recorded them, but are named in the critical review.
- Distinct, content-based filenames (`10_shagov_claude_v2.mp4`); keep the previous version before re-rendering.
- Before delivery: a critical review "как мировой лидер по производству рилсов" — errors, weak spots, what was fixed,
  what is left.

## 1. Series style (@iishka26 default)
| Token | Value |
|---|---|
| background | `#0E0E10` + drifting dot grid (`#26262C`, 54 px) + film grain 6–8 % + one soft accent glow |
| text / dim / panel | `#F2EFE9` / `#8C8982` / `#1B1B20` |
| accent (ONE) | `#FF7A30`, text on accent `#141414` |
| display | Inter Display 900/800/500, tracking −0.03 em (big) … −0.01 em (UI) |
| labels | DejaVu Sans Mono Bold, caps, +0.08 em |
| safe box 9:16 | x 72–890, y 230–1340 (Shorts/Reels UI: top 250, right column x>890 from y 1000, bottom from y 1340) |

Paint the danger zones on every contact sheet (red boxes `0,0,1080,250`, `0,1340,1080,580`, `890,1000,190,920`).

## 2. Retention structure (works for any explainer)
1. **0–3 s hook = payoff before context.** Big type rising word by word, the key word in accent at 140–150 px,
   a pattern break on it (6–10 px shake for 8 frames + scale punch) at 2–4 s, a visual metaphor (½ ring, chat bubble).
2. **Zoom-through** (log-space dolly ×6 over 0.4 s) from the hook into a **flick**: the list of chapters flashes one
   word per half-beat with a counter `n/N` and a progress bar — the viewer sees the whole map in 2–3 s.
3. **Chapters / cards**: progress bar (N segments, current one fills), huge accent number with a settle, mono label
   `ШАГ 03 / 10`, title on ONE line (`fitTitle`: size = safe width / (chars × 0.66), max 104), an accent rule that draws,
   then a mini-UI module whose elements land on their spoken words.
4. **Something new every 2–4 s**: a chip, a node, a typed line, a toggle, a counter. Never a static frame > 4 s.
5. **CTA**: the spoken CTA gets its own slide (bookmark that fills = "Сохраните").
6. **Bonus / cheat-sheet slides** after the voice (music only, 2.5 s each, label "ПАУЗА — ЧИТАЙ"): dense material
   from the source that would not fit the voice — the save mechanic.
7. **End card ≥ 2.5 s**: the channel link assembled per letter in accent, a pulsing pill CTA, a bell on the assembly.

## 3. Motion vocabulary (Apple + motion-reel rules)
- Default spring is critically damped (`damping 200`): calm, no wobble. Bounce (`damping ~11, stiffness 190`) only for
  things that are "thrown": numbers, pills, nodes, letters of the nick.
- Text rises under a mask word by word (2–4 frame stagger). Never "everything fades in".
- Transitions: **push** — the old slide leaves left while the new one enters from the right, both on screen, 10 frames
  centered on the beat, blur ∝ speed (sin(πp)·14 px). Enter and exit along the same path. No full-frame flashes except
  1–2 structural moments.
- Liquid glass panels: translucent fill, 1.5 px light top edge, deep shadow, one specular sweep after landing.
- Beat pulse (exp decay over 3 frames on every 0.5 s beat) on live elements: progress segment, hub, "✓ выполнено".
- Mini-UI beats a sentence: terminal with traffic lights and typed command, toggle switch, hub-and-spoke diagram
  with dashed lines that draw, app windows (site / calculator / doc), avatar row, checklist, grid of blocks.
- Avoid slow looping oscillations (~0.2 Hz bobbing) and blinking everywhere: one idle motion per slide at most.

## 4. Captions (2026 "dynamic minimalism")
Phrase chunks of 2–4 words (`buildChunks(words, 4, 24)`), on a dark glass pill at y ≈ 1196, left-aligned in the safe
box. Spoken word = accent + a small pop, past words ink, upcoming words 35 %. No emoji, no per-syllable bouncing.

## 5. Pipeline
1. **Inputs**: source (image / script / voice), length, platform, CTA. If the user said "Создай / Приступай /
   Переделай" — build straight away; otherwise show a short shot list (time · scene · on screen) first.
2. **Voice**: transcribe word-level (faster-whisper; in the cloud see environment.md), cut pauses by the audio
   envelope, speed-up with pitch kept (`atempo`), fix the transcript for captions only (names in Latin: Claude, GitHub).
3. **Beat grid**: 120 BPM → 0.5 s. Slide changes = the beat at or just before the chapter's first word.
4. **Build** from `assets/ReelTemplate.tsx`: edit `SCENES`, the step modules and the bonus data. Keep the template's
   primitives (Rise, Glass, Pill, Progress, StepHead, Captions, Backdrop, Grain, push logic). The template imports
   `brandFont` and `buildChunks` from the it-reelsmaker kit (`src/kit/`, created by `kit.py new`); props are the kit's
   `reelkit-props.json` (`video` = the rough cut with the voice, `captions` = word timings on the output timeline).
5. **Critique loop, ≥ 2 rounds**: stills at every scene's settled moment + mid-transition, cropped to the safe box,
   danger zones painted. Score hook / readability at phone size / motion / variety / brand / sync (1–10), fix the
   three worst, repeat until all ≥ 8.
6. **Render** in the background; check frames = duration × 30, audio present.
7. **Sound**: music (user's track or `scripts/music.py <seconds> music.wav sfxdir`, an original 120 BPM track + whoosh
   and hit), SFX plan: hit on the hook and the pattern break, whoosh 0.4 s before every push, quiet clicks on the
   flick, bell on the nick. Master: voice −14 LUFS, music bed ~16 dB under the voice with sidechain ducking, true peak
   ≤ −1 dBTP; check the music-only part sits ≈ 12 dB under the speech part.
8. **Cover**: the strongest settled frame rendered without captions; convert the render to yuv420p tv-range
   bt709 before baking it into frame 0 (Remotion writes yuvj420p full range — the baked cover comes out washed).
9. **Deliver**: the video, the cover, separate slide PNGs (settled frames without captions), the critical review.

## 6. Pre-delivery checklist
- [ ] every word inside x 72–890, y 230–1340; captions never under a module
- [ ] titles on one line; no element overlapping another on any still
- [ ] slide changes on the beat; elements on their spoken words (±2 frames)
- [ ] new event every 2–4 s; hook pattern break at 2–4 s
- [ ] one accent colour, two faces, Cyrillic glyphs present in both
- [ ] facts only from the source/speech; added items listed for checking
- [ ] −14 LUFS, TP ≤ −1 dB, audio = video duration; music clearly under the voice
- [ ] previous version kept, distinct filename, cover + slide PNGs delivered
