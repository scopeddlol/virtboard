Microphone fixes for Virtboard.

### Fixed

- **Sounds echoing back into the mic.** If Windows' default recording device was **CABLE Output** (VB-CABLE often sets this when it installs), Virtboard recorded its own output instead of your mic. Your real voice never got through, and sounds fed back into themselves. Virtboard now refuses to use a virtual cable as the mic and switches to your real one, preferring NVIDIA Broadcast, RTX Voice or Krisp.
- **Mic errors were hidden.** If Windows blocked the mic (privacy settings, exclusive mode, device in use), you just got silence. Virtboard now shows the reason and how to fix it.
- **The wrong mic could open.** The mic you pick is now the one that opens. If it's gone, Virtboard falls back to another mic and tells you.
- **The mic reconnects** after it's unplugged, after its driver restarts, and after you change the virtual output.

### New

- **Settings → Microphone** shows the device Virtboard is listening to, with a live input meter.

### Install

1. Download `Virtboard-Setup-0.1.1.exe` below and run it.
2. Let it install VB-Audio Virtual Cable (free), and restart if asked.
3. In Discord, set **Input Device** to **CABLE Output (VB-Audio Virtual Cable)**.

The installer isn't code-signed yet, so Windows SmartScreen may warn you. Choose **More info → Run anyway**.
