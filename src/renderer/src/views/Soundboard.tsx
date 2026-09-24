import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FolderInput, Plus, Search, Settings, Trash2, Upload } from 'lucide-react'
import { useStore } from '@/state/store'
import { engine } from '@/audio/engine'
import { importFromDialog, importFromDrop } from '@/lib/import'
import { SoundPad } from '@/components/SoundPad'
import { Kbd, HotkeyInput } from '@/components/HotkeyInput'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Button, Dialog, Label } from '@/components/ui'

function PageSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const page = useStore((s) => s.pages.find((p) => p.id === s.activePageId)!)
  const pageCount = useStore((s) => s.pages.length)
  const updatePage = useStore((s) => s.updatePage)
  const deletePage = useStore((s) => s.deletePage)
  if (!page) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Page settings" description="Every page has its own set of keybinds — the same key can trigger a different sound on each page." className="w-[min(520px,92vw)]">
      <div className="space-y-5 p-6">
        <div className="flex items-center gap-3">
          <EmojiPicker value={page.emoji} onChange={(emoji) => updatePage(page.id, { emoji })} />
          <input
            value={page.name}
            onChange={(e) => updatePage(page.id, { name: e.target.value })}
            className="h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 font-display text-lg font-semibold text-white outline-none focus:border-accent/60"
          />
        </div>
        <div>
          <Label>Jump-to-page hotkey (global)</Label>
          <HotkeyInput value={page.hotkey} onChange={(hotkey) => updatePage(page.id, { hotkey })} placeholder="Optional" />
        </div>
        <div className="flex justify-between border-t border-white/[0.06] pt-5">
          <Button
            variant="danger"
            disabled={pageCount <= 1}
            onClick={() => {
              deletePage(page.id)
              onOpenChange(false)
            }}
          >
            <Trash2 size={14} /> Delete page & its sounds
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </div>
    </Dialog>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-10 flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-10 py-14 text-center"
    >
      <div className="mb-6 flex h-16 items-end gap-1.5">
        {[0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.65].map((h, i) => (
          <motion.span
            key={i}
            className="w-2.5 rounded-full bg-gradient-to-t from-accent to-accent-2"
            animate={{ height: [`${h * 30}%`, `${h * 100}%`, `${h * 30}%`] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <h3 className="font-display text-xl font-semibold text-white">This page is empty</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
        Drop audio files anywhere in this window, or add them from disk. MP3, WAV, OGG, FLAC, M4A & more — as many as you like.
      </p>
      <Button variant="primary" className="mt-6" onClick={importFromDialog}>
        <Upload size={15} /> Add sounds
      </Button>
    </motion.div>
  )
}

export function Soundboard() {
  const page = useStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const allSounds = useStore((s) => s.sounds)
  const activePageId = useStore((s) => s.activePageId)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const hotkeys = useStore((s) => s.settings.hotkeys)
  const [dragging, setDragging] = useState(false)
  const [pageSettings, setPageSettings] = useState(false)

  const sounds = useMemo(() => allSounds.filter((s) => s.pageId === activePageId), [allSounds, activePageId])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? sounds.filter((s) => s.name.toLowerCase().includes(q)) : sounds
  }, [sounds, search])

  useEffect(() => engine.preload(sounds), [sounds])

  useEffect(() => {
    let depth = 0
    const isFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!isFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (!isFiles(e)) return
      if (--depth <= 0) setDragging(false)
    }
    const over = (e: DragEvent) => {
      if (isFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      if (!isFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      if (e.dataTransfer?.files.length) importFromDrop(e.dataTransfer.files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-4 px-8 pb-5 pt-7">
        <button
          onClick={() => setPageSettings(true)}
          className="grid h-12 w-12 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-accent/35 to-accent/5 text-2xl shadow-[0_10px_30px_-10px_var(--accent)] transition-transform hover:scale-105"
        >
          {page?.emoji}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate font-display text-[26px] font-bold tracking-tight text-white">{page?.name}</h1>
            <button onClick={() => setPageSettings(true)} className="cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
              <Settings size={16} />
            </button>
          </div>
          <div className="mt-0.5 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[12.5px] text-zinc-400">
            <span>{sounds.length} sounds</span>
            <span className="text-zinc-600">•</span>
            <span>{sounds.filter((s) => s.hotkey).length} keybinds</span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1.5">pages <Kbd accel={hotkeys.prevPage} dim /> <Kbd accel={hotkeys.nextPage} dim /></span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sounds"
              className="h-9 w-48 rounded-xl border border-white/[0.07] bg-white/[0.04] pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-zinc-500 focus:border-accent/60 focus:bg-white/[0.06]"
            />
          </div>
          <Button variant="primary" onClick={importFromDialog}>
            <Plus size={16} /> Add sounds
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {sounds.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-3.5">
            {shown.map((s, i) => (
              <SoundPad key={s.id} sound={s} index={i} />
            ))}
            {!search && (
              <button
                onClick={importFromDialog}
                className="flex h-[148px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 text-[12.5px] text-zinc-500 transition-colors hover:border-accent/50 hover:bg-accent/[0.04] hover:text-zinc-200"
              >
                <Plus size={20} /> Add sounds
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-4 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-3 text-white">
              <FolderInput size={40} className="text-accent" />
              <span className="font-display text-xl font-semibold">Drop to add to “{page?.name}”</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageSettings open={pageSettings} onOpenChange={setPageSettings} />
    </div>
  )
}
