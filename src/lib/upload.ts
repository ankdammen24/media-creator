import type { UploadSessionUpload } from "./api-creator";

export const AUDIO_ACCEPT = "audio/wav,audio/x-wav,audio/wave,audio/vnd.wave,audio/mpeg,audio/mp3,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,.wav,.mp3,.flac,.aif,.aiff";
export const ALLOWED_AUDIO_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/mpeg", "audio/mp3", "audio/flac", "audio/x-flac", "audio/aiff", "audio/x-aiff"]);
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function validateAudioFile(file: File) {
  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    return `Filtypen stöds inte: ${file.type || "okänd"}`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Filen är för stor. Maxstorlek är ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return null;
}

export function putFileToR2(upload: UploadSessionUpload, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`R2-uppladdningen misslyckades (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Nätverksfel vid uppladdning till lagring"));
    xhr.send(file);
  });
}
