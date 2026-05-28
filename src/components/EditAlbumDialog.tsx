import { X } from "lucide-react";
import { AlbumForm } from "@/components/AlbumForm";
import type { Album } from "@/lib/album-helpers";

export function EditAlbumDialog({
  album,
  onClose,
  onSaved,
}: {
  album: Album;
  onClose: () => void;
  onSaved: (a: Album) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Redigera album</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AlbumForm
          existing={album}
          onSaved={(a) => {
            onSaved(a);
            onClose();
          }}
        />
      </div>
    </div>
  );
}