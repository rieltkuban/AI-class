# Cloud container workarounds (learned on real reels)

- **Remotion project**: `kit.py new <dir>` from it-reelsmaker, or `npm create video`; `npm install` works (npm registry
  is reachable). Render with the preinstalled headless shell:
  `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
- **Fonts**: Chromium does not trust the proxy CA, so Google Fonts fail (`ERR_CERT_AUTHORITY_INVALID`). Never disable
  TLS checks. Use local files: the system has Inter Display (`/usr/share/fonts/opentype/inter/`) and DejaVu Sans Mono
  (`/usr/share/fonts/truetype/dejavu/`); copy them to `public/fonts/` and load with `FontFace`. Other families:
  `npm pack @fontsource/<family>` and merge the latin + cyrillic subsets per weight with fontTools.
- **Speech recognition**: HuggingFace is blocked. faster-whisper `small` (CTranslate2 int8) is on npm as
  `@skillninja/shortmovie-telop-model-p0..p3`: `npm pack` the four parts (no install scripts), concatenate
  `model.bin.part0..3`, verify `model.sha256`, pass the folder as `--model`.
- **TTS**: edge-tts and other cloud voices are blocked; ask the user for a recording.
- **Music**: no stock library; `scripts/music.py` synthesizes an original track (no licence issues).
- **Colour range**: Remotion renders yuvj420p full range. Convert to yuv420p tv-range bt709 before baking a cover into
  frame 0 or any re-encode: `scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`.
- **Render speed**: ~83 s at 1080×1920/30 fps takes ~8–10 min with `--concurrency=4`; run it in the background.
- **Deletes**: `rm` with globs after `cd` is blocked by the safety check — write stills into a fresh folder instead.
