#!/usr/bin/env bash
# Captures installer screenshots on Linux (needs wine32+wine64, Xvfb, xdotool, ImageMagick).
# Builds a screenshot-only variant that skips the "is Virtboard running?" check,
# which gives false positives under Wine.
set -euo pipefail
cd "$(dirname "$0")/.."
printf '!include "%s/build/installer.nsh"\n!macro customCheckAppRunning\n!macroend\n' "$PWD" > build/.screens.nsh
WINEDEBUG=-all xvfb-run -a npx electron-builder --win nsis --x64 --publish never \
  -c.nsis.include=build/.screens.nsh -c.directories.output=release-screens >/dev/null
rm build/.screens.nsh

export DISPLAY=:77 WINEDEBUG=-all
Xvfb :77 -screen 0 1000x700x24 >/dev/null 2>&1 &
XPID=$!
trap 'kill $XPID 2>/dev/null || true' EXIT
sleep 2
rm -rf "$HOME"/.wine/drive_c/users/*/AppData/Local/Programs/Virtboard || true
wine release-screens/Virtboard-Setup-*.exe >/dev/null 2>&1 &
OUT=docs/screenshots
snap() {
  sleep "${2:-2}"
  local wid
  wid=$(xdotool search --name "Virtboard Setup" | tail -1)
  import -window "$wid" "$OUT/$1.png"
  echo "📸 $1"
}
sleep 12
snap installer-1-welcome 0
xdotool key Return; snap installer-2-license
xdotool key alt+a; sleep 0.5; xdotool key Return; snap installer-3-mode
xdotool key Return; snap installer-4-location
xdotool key Return; snap installer-5-installing 3
# wait for the VB-CABLE prompt (a message box) to appear
for i in $(seq 1 60); do
  if xdotool search --name "^Virtboard Setup$" >/dev/null 2>&1 && [ "$(xdotool search --name 'Virtboard Setup' | wc -l)" -gt 1 ]; then break; fi
  sleep 1
done
sleep 1
import -window root /tmp/vb-prompt.png
convert /tmp/vb-prompt.png -trim +repage "$OUT/installer-6-vbcable.png"; echo "📸 installer-6-vbcable"
xdotool key n; snap installer-7-finish 4
