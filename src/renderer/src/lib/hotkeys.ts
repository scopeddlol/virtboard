// Convert DOM keyboard events into Electron accelerators, and accelerators into pretty labels.

const CODE_MAP: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
  Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Escape: 'Escape',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
  MediaPlayPause: 'MediaPlayPause', MediaTrackNext: 'MediaNextTrack', MediaTrackPrevious: 'MediaPreviousTrack', MediaStop: 'MediaStop',
  AudioVolumeUp: 'VolumeUp', AudioVolumeDown: 'VolumeDown', AudioVolumeMute: 'VolumeMute',
  PrintScreen: 'PrintScreen', ScrollLock: 'Scrolllock', Pause: 'Pause',
}

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`
  if (/^F\d{1,2}$/.test(code)) return code
  return CODE_MAP[code] ?? null
}

/** Returns an accelerator, '' to clear, or null if the event isn't a complete combo yet. */
export function eventToAccelerator(e: KeyboardEvent): string | null {
  const key = keyName(e.code)
  if (!key) return null
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Super')
  return [...mods, key].join('+')
}

const PRETTY: Record<string, string> = {
  numadd: 'Num +', numsub: 'Num −', nummult: 'Num ×', numdiv: 'Num ÷', numdec: 'Num .',
  Up: '↑', Down: '↓', Left: '←', Right: '→', Super: 'Win', PageUp: 'PgUp', PageDown: 'PgDn',
  MediaPlayPause: '⏯', MediaNextTrack: '⏭', MediaPreviousTrack: '⏮', MediaStop: '⏹', Backspace: '⌫',
}

export function prettyParts(accel: string): string[] {
  if (!accel) return []
  // Split on "+" but keep a literal "+" key (e.g. "Ctrl++").
  const parts = accel.replace(/\+\+$/, '+PLUS').split('+').map((p) => (p === 'PLUS' ? '+' : p))
  return parts.map((p) => PRETTY[p] ?? (/^num\d$/.test(p) ? `Num ${p.slice(3)}` : p))
}

/** Single keys that would swallow normal typing system-wide. */
export function blocksTyping(accel: string) {
  return /^([A-Z0-9]|Space|Enter|Tab|Backspace|[-=[\];',./`\\])$/.test(accel) || /^Shift\+([A-Z0-9])$/.test(accel)
}
