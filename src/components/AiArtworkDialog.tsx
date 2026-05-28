import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createParser } from "eventsource-parser";
import { Sparkles, X, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ENDPOINT = "/api/generate-artwork";
const COST_LABEL = "~$0.035";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export type AiArtworkDialogProps = {
  open: boolean;
  defaultPrompt?: string;
  aspect?: "1:1" | "16:9" | "3:2";
  title?: string;
  filenameHint?: string;
  onClose: () => void;
  onGenerated: (file: File) => void;
};

export function AiArtworkDialog({
  open,
  defaultPrompt = "",
  aspect = "1:1",
  title = "Skapa bild med AI",
  filenameHint = "ai-artwork",
  onClose,
  onGenerated,
}: AiArtworkDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt);
      setPreview(null);
      setIsFinal(false);
      setError(null);
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function generate() {
    setError(null);
    setPreview(null);
    setIsFinal(false);
    setStreaming(true);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setError("Du måste vara inloggad.");
      setStreaming(false);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let sawCompleted = false;

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, aspect }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Fel ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const parser = createParser({
        onEvent(ev) {
          if (
            ev.event !== "image_generation.partial_image" &&
            ev.event !== "image_generation.completed"
          ) {
            return;
          }
          let payload: { b64_json?: string };
          try {
            payload = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (!payload.b64_json) return;
          const final = ev.event === "image_generation.completed";
          flushSync(() => {
            setPreview(`data:image/png;base64,${payload.b64_json}`);
            if (final) setIsFinal(true);
          });
          if (final) sawCompleted = true;
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(value);
        }
      } finally {
        reader.cancel().catch(() => {});
      }
      if (!sawCompleted) throw new Error("Strömmen avbröts innan bilden var klar.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function useImage() {
    if (!preview || !isFinal) return;
    const blob = dataUrlToBlob(preview);
    const safe = filenameHint.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40) || "ai-artwork";
    const file = new File([blob], `${safe}-${Date.now()}.png`, { type: "image/png" });
    onGenerated(file);
    onClose();
  }

  const aspectClass =
    aspect === "16:9" ? "aspect-video" : aspect === "3:2" ? "aspect-[3/2]" : "aspect-square";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Stäng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={streaming}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Modell: Gemini 3.1 Flash Image · Aspekt: {aspect} · Kostnad: {COST_LABEL}
            </p>
          </div>

          <div
            className={
              "overflow-hidden rounded-lg border border-border bg-secondary " + aspectClass
            }
          >
            {preview ? (
              <img
                src={preview}
                alt="Förhandsvisning"
                className={
                  "h-full w-full object-contain transition-[filter] duration-300 " +
                  (isFinal ? "blur-0" : "blur-2xl")
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {streaming ? "Renderar…" : "Ingen bild ännu — klicka Generera"}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={streaming}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={streaming || prompt.trim().length < 3}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
          >
            {streaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {preview ? "Generera igen" : "Generera"}
          </button>
          <button
            type="button"
            onClick={useImage}
            disabled={!preview || !isFinal || streaming}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Använd bild
          </button>
        </div>
      </div>
    </div>
  );
}