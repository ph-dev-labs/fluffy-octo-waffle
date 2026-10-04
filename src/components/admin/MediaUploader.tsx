"use client";

import { AnimatePresence, motion, Reorder } from "motion/react";
import { AlertTriangle, ImagePlus, Loader2, Play, Star, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import SmartImage from "@/components/ui/SmartImage";
import { ApiError, fetchJson } from "@/lib/client/fetch-json";
import { cn } from "@/lib/utils";

interface Signature {
  timestamp: number;
  folder: string;
  allowed_formats: string;
  signature: string;
  apiKey: string;
  uploadUrl: string;
}

interface Upload {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

const MAX_IMAGE_MB = 10; // Cloudinary free plan limit
const MAX_VIDEO_MB = 100;

/**
 * Signed direct-to-Cloudinary uploader with progress, drag-to-reorder and
 * "first = cover". Writes the final URL list into a hidden input so it works
 * with plain server-action forms.
 */
export function MediaUploader({
  name,
  initial = [],
  folder,
  max = 12,
  allowVideo = false,
  single = false,
}: {
  name: string;
  initial?: string[];
  folder: "containers" | "gallery";
  max?: number;
  allowVideo?: boolean;
  single?: boolean;
}) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const limit = single ? 1 : max;

  const uploadOne = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      const isVideo = file.type.startsWith("video/");
      const sizeMb = file.size / 1024 / 1024;
      if (isVideo && !allowVideo) return toast.error(`${file.name}: videos aren't allowed here`);
      if (!isVideo && !file.type.startsWith("image/")) return toast.error(`${file.name}: unsupported file type`);
      if (sizeMb > (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB)) return toast.error(`${file.name}: max ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB} MB`);

      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      const setUp = (patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));

      try {
        const sig = await fetchJson<Signature>("/api/admin/upload-signature", { method: "POST", json: { folder }, retries: 2 });
        const body = new FormData();
        body.append("file", file);
        body.append("api_key", sig.apiKey);
        body.append("timestamp", String(sig.timestamp));
        body.append("signature", sig.signature);
        body.append("folder", sig.folder);
        body.append("allowed_formats", sig.allowed_formats);

        const url = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", sig.uploadUrl);
          xhr.timeout = 5 * 60_000;
          xhr.upload.onprogress = (e) => e.lengthComputable && setUp({ progress: Math.round((e.loaded / e.total) * 100) });
          xhr.onload = () => {
            try {
              const res = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url);
              else reject(new Error(res.error?.message ?? `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error — check your connection"));
          xhr.ontimeout = () => reject(new Error("Upload timed out"));
          xhr.send(body);
        });

        setUrls((u) => (single ? [url] : [...u, url].slice(0, limit)));
        setUploads((u) => u.filter((x) => x.id !== id));
      } catch (err) {
        setUp({ error: err instanceof ApiError || err instanceof Error ? err.message : "Upload failed" });
      }
    },
    [allowVideo, folder, limit, single],
  );

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = limit - urls.length - uploads.filter((u) => !u.error).length;
    const list = Array.from(files).slice(0, single ? 1 : Math.max(0, room));
    if (!list.length) return toast.error(`Maximum ${limit} file${limit === 1 ? "" : "s"}`);
    list.forEach((f) => void uploadOne(f));
  };

  const isVideo = (u: string) => /\/video\/upload\/|\.(mp4|mov|webm)$/i.test(u);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={single ? (urls[0] ?? "") : JSON.stringify(urls)} />

      {urls.length ? (
        <Reorder.Group axis="x" values={urls} onReorder={setUrls} className="flex flex-wrap gap-3" as="ul">
          {urls.map((u, i) => (
            <Reorder.Item key={u} value={u} as="li" className="group relative size-28 cursor-grab overflow-hidden rounded-xl bg-ink-100 ring-1 ring-ink-900/10 active:cursor-grabbing" whileDrag={{ scale: 1.06, zIndex: 10 }}>
              {isVideo(u) ? (
                <div className="grid size-full place-items-center bg-ink-900 text-white"><Play className="size-6" /></div>
              ) : (
                <SmartImage src={u} alt="" fill sizes="112px" className="pointer-events-none object-cover" />
              )}
              {i === 0 && !single ? (
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white"><Star className="size-2.5 fill-current" /> Cover</span>
              ) : null}
              <button type="button" onClick={() => setUrls((x) => x.filter((y) => y !== u))} className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-ink-950/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="Remove">
                <X className="size-3.5" />
              </button>
              {i !== 0 && !single ? (
                <button type="button" onClick={() => setUrls((x) => [u, ...x.filter((y) => y !== u)])} className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-white/90 py-0.5 text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
                  Make cover
                </button>
              ) : null}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : null}

      <AnimatePresence initial={false}>
        {uploads.map((u) => (
          <motion.div key={u.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", u.error ? "bg-danger-100 text-danger-600" : "bg-ink-50")}>
            {u.error ? <AlertTriangle className="size-4 shrink-0" /> : <Loader2 className="size-4 shrink-0 animate-spin text-brand-600" />}
            <span className="min-w-0 flex-1 truncate">{u.name}{u.error ? ` — ${u.error}` : ""}</span>
            {u.error ? (
              <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))} className="text-xs font-semibold underline">Dismiss</button>
            ) : (
              <span className="w-28">
                <span className="block h-1.5 overflow-hidden rounded-full bg-ink-200">
                  <motion.span className="block h-full bg-brand-600" animate={{ width: `${u.progress}%` }} />
                </span>
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {urls.length < limit || single ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn("flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors", dragOver ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-ink-300 hover:bg-ink-50")}
        >
          <ImagePlus className="size-6 text-ink-400" />
          <span className="font-medium">{single && urls.length ? "Replace file" : "Click or drop files to upload"}</span>
          <span className="text-xs text-ink-400">
            {allowVideo ? `Images ≤ ${MAX_IMAGE_MB} MB · Videos ≤ ${MAX_VIDEO_MB} MB` : `JPG, PNG, WebP, HEIC ≤ ${MAX_IMAGE_MB} MB`}
            {!single ? ` · up to ${limit} · drag thumbnails to reorder` : ""}
          </span>
        </button>
      ) : null}
      <input ref={inputRef} type="file" hidden multiple={!single} accept={allowVideo ? "image/*,video/mp4,video/quicktime,video/webm" : "image/*"} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
