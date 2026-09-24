<p align="center">
  <img src="docs/banner.png" alt="Virtboard" width="100%" />
</p>

<p align="center">
  A simple soundboard and voice changer for Windows.<br/>
  Your voice and sounds go to Discord, games and OBS through a virtual microphone.
</p>

<p align="center">
  <a href="https://github.com/scopeddlol/virtboard/releases/latest"><b>Download for Windows</b></a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Virtboard in use" width="880" />
</p>

## Features

- **Unlimited sounds.** Drop in MP3, WAV, OGG, FLAC, M4A, AAC, WEBM or OPUS files.
- **Global shortcuts.** Give any sound a key. Shortcuts work while Virtboard is minimized to the tray.
- **Pages.** Each page has its own shortcuts, so `Num 1` can play one sound on *Memes* and another on *Stream*.
- **Voice changer.** 13 built-in voices, plus your own presets: pitch, robot, bit-crush, distortion, tremolo, filters, EQ, echo, reverb and noise gate.
- **Trimmer.** Trim, fade, change speed, loop, and export as WAV. Your original files are never changed.
- **Volume controls.** Separate sliders for your microphone, sounds, and what you hear in your headphones.
- **Optional playback.** Choose whether you hear the sounds yourself, globally or per sound.
- **Tray.** Close to the tray, start with Windows, and control the mic, voice and pages from the tray menu.

## Install

1. Download `Virtboard-Setup-x.y.z.exe` from the [latest release](https://github.com/scopeddlol/virtboard/releases/latest) and run it.
2. When asked, install **VB-Audio Virtual Cable** (free). It creates the virtual microphone. Restart if its installer asks you to.
3. In Discord, open *Settings → Voice & Video* and set **Input Device** to **CABLE Output (VB-Audio Virtual Cable)**. Use the same device as the microphone in games or OBS.
4. In Virtboard's **Settings**, check that *Virtual mic output* is **CABLE Input** and *Microphone* is your real mic.

Windows only lets signed drivers create audio devices, which is why Virtboard uses VB-CABLE. It isn't bundled; Virtboard downloads it from vb-audio.com when you ask.

## Screenshots

**Soundboard.** Click a sound to play it; its shortcut is shown on the button.

<img src="docs/screenshots/01-soundboard.png" alt="Soundboard" />

<table>
  <tr>
    <td><img src="docs/screenshots/05-pages.png" alt="Pages" /><br/><sub>Pages, each with their own shortcuts</sub></td>
    <td><img src="docs/screenshots/03-context-menu.png" alt="Right-click menu" /><br/><sub>Right-click to preview, edit, copy or move</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/06-page-settings.png" alt="Page settings" /><br/><sub>Page settings</sub></td>
    <td><img src="docs/screenshots/16-empty-page.png" alt="Empty page" /><br/><sub>An empty page</sub></td>
  </tr>
</table>

**Editing a sound.** Drag the highlighted area to trim, then set a shortcut and how it plays.

<img src="docs/screenshots/04-trimmer.png" alt="Sound editor" />

**Voice changer.** Pick a voice from the list. Built-in voices can be duplicated and edited.

<table>
  <tr>
    <td><img src="docs/screenshots/07-voice-changer.png" alt="Voice changer" /><br/><sub>Built-in voice</sub></td>
    <td><img src="docs/screenshots/09-custom-preset.png" alt="Custom preset" /><br/><sub>Your own preset</sub></td>
  </tr>
</table>

**Settings**

<table>
  <tr>
    <td><img src="docs/screenshots/10-settings-audio.png" alt="Audio settings" /><br/><sub>Audio devices</sub></td>
    <td><img src="docs/screenshots/11-device-picker.png" alt="Device picker" /><br/><sub>Choosing an output</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/12-hotkeys.png" alt="Shortcuts" /><br/><sub>Global shortcuts</sub></td>
    <td><img src="docs/screenshots/13-appearance.png" alt="App settings" /><br/><sub>App settings and accent color</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/14-theme-blue.png" alt="Blue accent" /><br/><sub>Blue accent</sub></td>
    <td><img src="docs/screenshots/15-theme-rose.png" alt="Rose accent" /><br/><sub>Rose accent</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/08-welcome.png" alt="Welcome" /><br/><sub>First run</sub></td>
    <td><img src="docs/screenshots/02-pad-hover.png" alt="Hover" /><br/><sub>Hover a sound to edit it</sub></td>
  </tr>
</table>

**Installer**

<table>
  <tr>
    <td><img src="docs/screenshots/installer-1-welcome.png" alt="Installer welcome" /></td>
    <td><img src="docs/screenshots/installer-4-location.png" alt="Install location" /></td>
    <td><img src="docs/screenshots/installer-6-vbcable.png" alt="VB-CABLE prompt" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/installer-2-license.png" alt="License" /></td>
    <td><img src="docs/screenshots/installer-3-mode.png" alt="Install mode" /></td>
    <td><img src="docs/screenshots/installer-7-finish.png" alt="Finish" /></td>
  </tr>
</table>

<sub>Screenshots are captured automatically from the real app on Linux, so the device names are simulated.</sub>

## Default shortcuts

| Action | Shortcut |
|---|---|
| Stop all sounds | `Ctrl` `Alt` `End` |
| Mute / unmute microphone | `Ctrl` `Alt` `M` |
| Voice changer on / off | `Ctrl` `Alt` `V` |
| Next / previous page | `Ctrl` `Alt` `PgDn` / `PgUp` |
| Show / hide Virtboard | `Ctrl` `Alt` `B` |

All of these can be changed in Settings. The numpad works well for sound shortcuts because it doesn't interfere with typing.

## How it works

```mermaid
flowchart LR
  Mic[Microphone] --> FX[Voice changer]
  FX --> Mix((Mix))
  Sounds[Sounds] --> Mix
  Mix --> Cable[CABLE Input]
  Cable --> Apps[Discord / games hear CABLE Output]
  Sounds -. optional .-> Phones[Your headphones]
```

- **Main process (Electron).** Window, tray, global shortcuts and storage. Only the current page's sound shortcuts are registered, which is how one key can do different things on different pages.
- **Audio (Web Audio).** Runs on Chromium's real-time audio thread. The voice changer is a small `AudioWorklet` (noise gate, pitch shift, ring modulation, bit-crush, tremolo) followed by built-in filter, EQ, distortion, echo and reverb nodes. It's disconnected entirely when turned off.
- **Data.** Stored in `%APPDATA%\Virtboard` (`state.json` and a `sounds` folder).

Built with [Electron](https://www.electronjs.org/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [wavesurfer.js](https://wavesurfer.xyz/), [Lucide](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/), [Zustand](https://zustand.docs.pmnd.rs/), [Inter](https://rsms.me/inter/), [electron-builder](https://www.electron.build/) and [NSIS](https://nsis.sourceforge.io/).

## Build from source

```bash
git clone https://github.com/scopeddlol/virtboard
cd virtboard
npm install
npm run dev        # run with hot reload
npm run dist:win   # build release/Virtboard-Setup-x.y.z.exe
```

| Command | Purpose |
|---|---|
| `npm run typecheck` | Type-check the code |
| `npm run icons` | Regenerate the logo, icons and installer images |
| `node scripts/smoke-test.mjs` | End-to-end test of the built app |
| `node scripts/screenshots.mjs` | Recapture the README screenshots |

GitHub Actions builds the installer on Windows and publishes a release when a `v*` tag is pushed.

## Troubleshooting

- **Others can't hear my sounds.** Discord's input device should be `CABLE Output`, and Virtboard's virtual mic output should be `CABLE Input`. Also try turning off Discord's noise suppression, which can filter out sound effects.
- **I hear myself.** Turn off *Hear my voice* in Settings.
- **A shortcut doesn't work.** Another app may already be using it (Virtboard shows a warning icon). Choose a different key.
- **Can I use it without VB-CABLE?** Yes, but only you will hear the sounds.

## License

[MIT](LICENSE). VB-Audio Virtual Cable is made by VB-Audio Software and is not included with Virtboard.
