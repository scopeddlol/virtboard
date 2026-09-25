import type { PlayMode } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Settings, Upload } from 'lucide-react'
import { useStore } from '@/state/store'
import { engine } from '@/audio/engine'
import { importFromDialog, importFromDrop } from '@/lib/import'
import { findConflict } from '@/lib/conflicts'
import { persisted } from '@/state/store'
import { SoundPad } from '@/components/SoundPad'
import { HotkeyInput } from '@/components/HotkeyInput'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Button, Dialog, Label, Segmented } from '@/components/ui'

function PageSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const page = useStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const pageCount = useStore((s) => s.pages.length)
  const updatePage = useStore((s) => s.updatePage)
  const deletePage = useStore((s) => s.deletePage)
  const conflict = useStore((s) => (page ? findConflict(persisted(s), page.hotkey, { pageId: page.id }) : null))
  if (!page) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Page settings" description="Each page has its own keybinds, so the same key can play a different sound on each page." className="w-[min(460px,92vw)]">
      <div className="space-y-4 px-5 pb-5 pt-3">
        <div>
          <Label>Name</Label>
          <div className="flex gap-2">
            <EmojiPicker value={page.emoji} onChange={(emoji) => updatePage(page.id, { emoji })} />
            <input
              value={page.name}
              onChange={(e) => updatePage(page.id, { name: e.target.value })}
              className="h-8 flex-1 rounded-md border border-line bg-base px-2.5 text-[13px] text-zinc-100 outline-none focus:border-accent"
            />
          </div>
        </div>
        <div>
          <Label>Shortcut to switch to this page</Label>
          <HotkeyInput value={page.hotkey} onChange={(hotkey) => updatePage(page.id, { hotkey })} conflict={conflict} placeholder="None" />
        </div>
        <div>
          <Label>Pressing it again while playing</Label>
          <Segmented<PlayMode> value={page.defaultMode} onChange={(defaultMode) => updatePage(page.id, { defaultMode })} options={[
            { value: 'restart', label: 'Restarts' },
            { value: 'overlap', label: 'Overlaps' },
            { value: 'toggle', label: 'Stops' },
          ]} />
          <p className="mt-2 text-[12px] text-zinc-500">Default for new sounds on this page. Existing sounds keep their own setting.</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button
            variant="danger"
            disabled={pageCount <= 1}
            onClick={() => {
              deletePage(page.id)
              onOpenChange(false)
            }}
          >
            Delete page
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </div>
    </Dialog>
  )
}

export function Soundboard() {
  const page = useStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const allSounds = useStore((s) => s.sounds)
  const activePageId = useStore((s) => s.activePageId)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
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
      if (isFiles(e) && --depth <= 0) setDragging(false)
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
      <div className="flex items-center gap-3 px-6 pb-4 pt-5">
        <h1 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold text-zinc-100">
          <span>{page?.emoji}</span>
          <span className="truncate">{page?.name}</span>
        </h1>
        <button onClick={() => setPageSettings(true)} title="Page settings" className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
          <Settings size={14} />
        </button>
        <div className="flex-1" />
        {sounds.length > 0 && (
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-8 w-44 rounded-md border border-line bg-panel pl-8 pr-2.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent"
            />
          </div>
        )}
        <Button variant="primary" onClick={importFromDialog}>
          <Plus size={14} /> Add sounds
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {sounds.length === 0 ? (
          <button
            onClick={importFromDialog}
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 px-6 py-16 text-center transition-colors hover:border-white/20"
          >
            <Upload size={20} className="text-zinc-500" />
            <span className="text-[14px] font-medium text-zinc-200">Add your first sounds</span>
            <span className="text-[12.5px] text-zinc-500">Click to browse, or drop audio files anywhere in this window.</span>
          </button>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2.5">
              {shown.map((s, i) => (
                <SoundPad key={s.id} sound={s} index={i} />
              ))}
            </div>
            {search && shown.length === 0 && <p className="py-10 text-center text-zinc-500">No sounds match “{search}”.</p>}
            <p className="mt-4 text-[12px] text-zinc-600">Click to play · right-click for more · drag to reorder</p>
          </>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-lg border-2 border-dashed border-accent/70 bg-base/80">
          <span className="text-[14px] font-medium text-zinc-200">Drop to add to “{page?.name}”</span>
        </div>
      )}

      <PageSettings open={pageSettings} onOpenChange={setPageSettings} />
    </div>
  )
}
