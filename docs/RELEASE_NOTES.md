# Virtboard 0.2.0

## What's new

- Zoom out, zoom in and reset to 100% from the title bar. Ctrl+- / Ctrl++ (or Ctrl+=) / Ctrl+0 work too, and the zoom level is saved.
- Independent Voice Chat and Game Chat output mixes, plus additional named output routes. Each output has separate microphone and soundboard mute controls and global keybinds. Game Chat starts with its microphone muted.
- Per-page defaults for what happens when a sound is pressed again: Restarts, Overlaps or Stops. New sounds inherit their page's default; existing sounds retain their own setting.
- Removed the View on GitHub button from Settings.
- Docker landing page with application screenshots, features, comparisons and direct installer downloads from a mounted `/data` directory. Published as `ghcr.io/scopeddlol/virtboard-website:0.2.0` and `:latest`.

## Separate Discord and game audio

Select a different installed virtual cable device for each output. In Discord and the game, choose each cable's matching recording device as the microphone. Keep Game Chat's microphone muted, and mute Voice Chat's soundboard if you only want the game to hear sounds. Each independent mix needs its own virtual cable device; adding a route in Virtboard does not install a Windows driver.

Existing audio settings, sound files and shortcuts are retained. The previous single virtual output becomes Voice Chat.

## Distribution

The Windows installer is `Virtboard-Setup-0.2.0.exe`. Place it in the website's mounted `./data` directory to make it available to visitors. The website serves downloads directly and does not redirect visitors to the private repository. Operator instructions are in `website/README.md`.
