"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { platformRequest } from "@/services/platform.service";
import { addMediaToAlbum } from "@/services/album.service";
import { useMediaDelivery } from "@/hooks/useMediaDelivery";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export function AlbumMediaPicker({ albumId, onAdded }: { albumId: string; onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false), [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (open) platformRequest<{ id: string }[]>("myMedia").then(items => { if (active) setIds(items.map(i => i.id)); }).catch(() => { if (active) setError("Could not load your photos."); });
    return () => { active = false; };
  }, [open]);
  async function add(id: string) {
    if (busy) return;
    setBusy(id); setError("");
    try { await addMediaToAlbum(albumId, id); await onAdded(); setIds(old => old.filter(value => value !== id)); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(null); }
  }
  return <><Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Add photos</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add from your posts</DialogTitle></DialogHeader>
      <div className="p-5 max-h-[60vh] overflow-auto space-y-3">
        <p className="text-xs text-text-secondary">Adding a photo shares it with people who can access this album.</p>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {!ids.length && <p className="text-sm text-text-muted">No available photos. Share a post first, then add its photos here.</p>}
        <div className="grid grid-cols-3 gap-2">{ids.map(id => <Candidate key={id} id={id} disabled={!!busy} onClick={() => add(id)} />)}</div>
      </div>
    </DialogContent></Dialog>
  </>;
}
function Candidate({ id, disabled, onClick }: { id: string; disabled: boolean; onClick: () => void }) {
  const url = useMediaDelivery(id, true);
  return <button type="button" onClick={onClick} disabled={disabled} aria-label="Add this photo" className="relative aspect-square overflow-hidden rounded-lg border border-border disabled:opacity-50">
    {url ? <Image src={url} alt="Your uploaded media" fill unoptimized className="object-cover" /> : <span className="text-xs">Loading…</span>}
  </button>;
}
