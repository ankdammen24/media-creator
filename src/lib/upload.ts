// Helpers for the direct-to-R2 upload step. Uses XHR so we can report progress.
import type { UploadSessionTrack } from "./api-creator";

export type UploadProgress = {
  trackId: string;
  loaded: number;
  total: number;
  percent: number;
};

export function putFileToR2(
  upload: UploadSessionTrack,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.putUrl, true);

    const headers = upload.headers ?? { "Content-Type": file.type || "application/octet-stream" };
    for (const [k, v] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(k, v);
      } catch {
        /* some headers are forbidden by the browser — ignore */
      }
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          trackId: upload.trackId,
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(file);
  });
}

export const AUDIO_ACCEPT = "audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/mpeg,audio/mp4,audio/aac,.wav,.flac,.aif,.aiff,.mp3,.m4a";

export const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
