import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createParser } from "eventsource-parser";
import { Sparkles, X, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createArtistImage } from "@/lib/catalog-edit.functions";
import type { ArtistImage } from "@/components/ArtistImageManager";

const STREAM_ENDPOINT = "/api/generate-artist-image";
const COST_LABEL = "~$0.035";

const KIND_LABEL: Record<ArtistImage["kind"], string> = {
  avatar: "Profilbild (1:1)",
  cover: "Omslag / hero (16:9)",
  press: "Pressbild (3:2)",
};

function defaultPrompt(kind: ArtistImage["kind"], artistName: string) {
  switch (kind) {
    case "avatar":
      return `Studio-porträtt av musikartisten ${artistName}, naturligt ljus, mjuk bokeh-bakgrund, fotografisk realism`;
    case "cover":
      return `Cinematisk pressbild av musikartisten ${artistName}, atmosfärisk belysning, bred komposition, lugnt uttryck`;
    case "press":
      return `Modern pressbild av musikartisten ${artistName}, neutral bakgrund, professionellt foto`;
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function AiImageGenerator({
  artistId,
  userId,
  artistName,
  defaultKind = "press",
  referenceImagePath = null,
  onClose,
  onSaved,
}: {
  artistId: string;
  userId: string;
  artistName: string;
  defaultKind?: ArtistImage["kind"];
  referenceImagePath?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createImageFn = useServerFn(createArtistImage);
  const [kind, setKind] = useState<ArtistImage["kind"]>(defaultKind);
  const [prompt, setPrompt] = useState(() => defaultPrompt(defaultKind, artistName));
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const promptManuallyEdited = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function changeKind(next: ArtistImage["kind"]) {
    setKind(next);
    if (!promptManuallyEdited.current) {
      setPrompt(defaultPrompt(next, artistName));
    }
  }

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
      const res = await fetch(STREAM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          artistId,
          prompt,
          kind,
          referenceImagePath,
        }),
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

  async function save() {
    if (!preview || !isFinal) return;
    setSaving(true);
    setError(null);
    try {
      const blob = dataUrlToBlob(preview);
      const path = `artists/${userId}/${artistId}/ai-${crypto.randomUUID()}.png`;
      const up = await supabase.storage
        .from("artwork")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (up.error) throw up.error;
      await createImageFn({
        data: {
          artistId,
          storage_path: path,
          kind,
          visibility: "link_only",
          credit: "AI-genererad (Gemini 3.1 Flash)",
          caption: prompt.slice(0, 200),
          sort_order: 0,
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">
              {referenceImagePath ? "Variera bild med AI" : "Skapa bild med AI"}
            </h2>
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
          {!referenceImagePath && (
            <div>
              <label className="mb-1 block text-xs font-medium">Typ</label>
              <select
                value={kind}
                onChange={(e) => changeKind(e.target.value as ArtistImage["kind"])}
                disabled={streaming || saving}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(KIND_LABEL) as ArtistImage["kind"][]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => {
                promptManuallyEdited.current = true;
                setPrompt(e.target.value);
              }}
              rows={3}
              maxLength={2000}
              disabled={streaming || saving}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Modell: Gemini 3.1 Flash Image · Kostnad per generering: {COST_LABEL}
              {referenceImagePath ? " · Använder befintlig bild som referens" : ""}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-secondary">
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
              <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
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
            disabled={streaming || saving}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Stäng
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={streaming || saving || prompt.trim().length < 3}
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
            onClick={save}
            disabled={!preview || !isFinal || saving || streaming}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Spara till galleri
          </button>
        </div>
      </div>
    </div>
  );
}