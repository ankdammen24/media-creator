// Typed wrappers for the external Media Rosenqvist creator endpoints.
// Shapes are best-effort based on the spec described in the project brief.
// If the real API differs, only this file needs to change.
import { api } from "./api-client";

// ---------- Types ----------

export type TrackStatus =
  | "pending_upload"
  | "uploaded"
  | "processing"
  | "processed"
  | "failed"
  | "submitted"
  | "approved"
  | "rejected"
  | "distributed";

export type ReleaseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "scheduled"
  | "distributed";

export type DistributionPlatformStatus =
  | "pending"
  | "submitted"
  | "live"
  | "rejected"
  | "takedown";

export type UploadSessionFile = {
  filename: string;
  size: number;
  contentType: string;
};

export type UploadSessionTrack = {
  trackId: string;
  filename: string;
  /** Pre-signed Cloudflare R2 PUT URL. */
  putUrl: string;
  /** Headers the client MUST set on the PUT (e.g. Content-Type). */
  headers?: Record<string, string>;
  /** Optional R2 object key for reference. */
  key?: string;
};

export type UploadSessionResponse = {
  sessionId?: string;
  uploads: UploadSessionTrack[];
};

export type TrackStatusResponse = {
  trackId: string;
  status: TrackStatus;
  /** 0..100 — processing progress if known. */
  progress?: number;
  loudness?: { i?: number; tp?: number; lra?: number } | null;
  durationSeconds?: number | null;
  message?: string | null;
  error?: string | null;
};

export type Track = {
  id: string;
  title: string;
  status: TrackStatus;
  durationSeconds?: number | null;
  artist?: string | null;
  albumId?: string | null;
  releaseId?: string | null;
  artworkUrl?: string | null;
  isrc?: string | null;
  explicit?: boolean;
  language?: string | null;
  primaryGenre?: string | null;
  secondaryGenre?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TrackMetadataPatch = Partial<
  Pick<
    Track,
    | "title"
    | "artist"
    | "isrc"
    | "explicit"
    | "language"
    | "primaryGenre"
    | "secondaryGenre"
  >
> & {
  featuredArtists?: string[];
  songwriters?: string[];
  producers?: string[];
  description?: string | null;
};

export type Release = {
  id: string;
  title: string;
  status: ReleaseStatus;
  releaseType?: "single" | "ep" | "album" | "podcast";
  artist?: string | null;
  artworkUrl?: string | null;
  releaseDate?: string | null;
  upc?: string | null;
  trackIds?: string[];
  distributionPlatforms?: string[];
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateReleasePayload = {
  title: string;
  releaseType: "single" | "ep" | "album" | "podcast";
  trackIds: string[];
  releaseDate?: string;
  distributionPlatforms?: string[];
};

export type DistributionEntry = {
  platform: string;
  status: DistributionPlatformStatus;
  externalUrl?: string | null;
  externalId?: string | null;
  submittedAt?: string | null;
  liveAt?: string | null;
  rejectionReason?: string | null;
};

export type DistributionStatus = {
  releaseId: string;
  platforms: DistributionEntry[];
};

export type DashboardSummary = {
  trackCounts: Partial<Record<TrackStatus, number>>;
  releaseCounts: Partial<Record<ReleaseStatus, number>>;
  recentTracks?: Track[];
  recentReleases?: Release[];
};

export type AccountInfo = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
};

// ---------- Uploads ----------

export function createUploadSession(files: UploadSessionFile[]) {
  return api.post<UploadSessionResponse>("/creator/uploads/session", { files });
}

export function completeUpload(trackId: string) {
  return api.post<{ trackId: string; status: TrackStatus }>("/creator/uploads/complete", {
    trackId,
  });
}

export function getTrackStatus(trackId: string) {
  return api.get<TrackStatusResponse>(`/creator/tracks/${encodeURIComponent(trackId)}/status`);
}

// ---------- Tracks ----------

export function listTracks(params?: { status?: TrackStatus | "all" }) {
  const qs = params?.status && params.status !== "all" ? `?status=${params.status}` : "";
  return api.get<{ tracks: Track[] }>(`/creator/tracks${qs}`);
}

export function getTrack(trackId: string) {
  return api.get<{ track: Track }>(`/creator/tracks/${encodeURIComponent(trackId)}`);
}

export function updateTrackMetadata(trackId: string, patch: TrackMetadataPatch) {
  return api.patch<{ track: Track }>(
    `/creator/tracks/${encodeURIComponent(trackId)}`,
    patch,
  );
}

export function submitTrack(trackId: string) {
  return api.post<{ track: Track }>(
    `/creator/tracks/${encodeURIComponent(trackId)}/submit`,
  );
}

// ---------- Releases ----------

export function listReleases() {
  return api.get<{ releases: Release[] }>("/creator/releases");
}

export function getRelease(releaseId: string) {
  return api.get<{ release: Release; tracks: Track[] }>(
    `/creator/releases/${encodeURIComponent(releaseId)}`,
  );
}

export function createRelease(payload: CreateReleasePayload) {
  return api.post<{ release: Release }>("/creator/releases", payload);
}

export function submitRelease(releaseId: string) {
  return api.post<{ release: Release }>(
    `/creator/releases/${encodeURIComponent(releaseId)}/submit`,
  );
}

export function getDistributionStatus(releaseId: string) {
  return api.get<DistributionStatus>(
    `/creator/releases/${encodeURIComponent(releaseId)}/distribution`,
  );
}

// ---------- Dashboard / Account ----------

export function getDashboard() {
  return api.get<DashboardSummary>("/creator/dashboard");
}

export function getMe() {
  return api.get<AccountInfo>("/creator/me");
}

export function updateAccount(patch: { displayName?: string }) {
  return api.patch<AccountInfo>("/creator/me", patch);
}
