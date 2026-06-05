import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type TrackStatus =
  | "draft"
  | "uploading"
  | "uploaded"
  | "processing"
  | "processed"
  | "metadata_required"
  | "submitted"
  | "reviewing"
  | "approved"
  | "rejected"
  | "mastering"
  | "mastered"
  | "distributed"
  | "published"
  | "failed";

export type ReleaseStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected" | "distributed" | "published" | "failed";

export type UploadSessionFile = { filename: string; contentType: string; size: number };
export type UploadSessionUpload = { trackId: string; fileId: string; uploadUrl: string; r2Key: string };
export type UploadSessionResponse = { uploads: UploadSessionUpload[] };

export type TrackFile = {
  id: string;
  track_id?: string;
  trackId?: string;
  file_type?: string;
  fileType?: string;
  filename: string;
  content_type?: string;
  contentType?: string;
  status?: string;
  r2_key?: string;
  r2Key?: string;
  created_at?: string;
  createdAt?: string;
};

export type ProcessingJob = {
  id: string;
  track_id?: string;
  trackId?: string;
  status: "queued" | "running" | "completed" | "failed";
  error_message?: string | null;
  errorMessage?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

export type Track = {
  id: string;
  title?: string | null;
  status: TrackStatus;
  artist_id?: string | null;
  artistId?: string | null;
  album_id?: string | null;
  albumId?: string | null;
  isrc?: string | null;
  upc?: string | null;
  metadata?: Record<string, unknown> | null;
  technical_metadata?: Record<string, unknown> | null;
  technicalMetadata?: Record<string, unknown> | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

export type TrackStatusResponse = {
  track: Track;
  files?: TrackFile[];
  processingJobs?: ProcessingJob[];
  processing_jobs?: ProcessingJob[];
};

export type TrackMetadataPatch = {
  title?: string;
  artistId?: string | null;
  albumId?: string | null;
  isrc?: string | null;
  upc?: string | null;
  metadata?: Record<string, unknown>;
};

export type Release = {
  id: string;
  title?: string | null;
  status: ReleaseStatus | string;
  releaseType?: string | null;
  releaseDate?: string | null;
  trackIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type AccountInfo = { id: string; email: string; displayName?: string | null; avatarUrl?: string | null };

export function createUploadSession(files: UploadSessionFile[]) {
  return api.post<UploadSessionResponse>("/creator/uploads/session", { files });
}

export function completeUpload(input: { trackId: string; fileId: string; r2Key: string }) {
  return api.post<{ track?: Track; status?: TrackStatus }>("/creator/uploads/complete", input);
}

export function getTrackStatus(trackId: string) {
  return api.get<TrackStatusResponse>(`/creator/tracks/${encodeURIComponent(trackId)}/status`);
}

export function listTracks() {
  return api.get<{ tracks: Track[] }>("/creator/tracks");
}

export function updateTrackMetadata(trackId: string, patch: TrackMetadataPatch) {
  return api.patch<{ track: Track }>(`/creator/tracks/${encodeURIComponent(trackId)}/metadata`, patch);
}

export function submitTrack(trackId: string) {
  return api.post<{ track: Track }>(`/creator/tracks/${encodeURIComponent(trackId)}/submit`);
}

export function listReleases() {
  return api.get<{ releases: Release[] }>("/creator/releases");
}

export function getRelease(releaseId: string) {
  return api.get<{ release: Release; tracks?: Track[] }>(`/creator/releases/${encodeURIComponent(releaseId)}`);
}

export function getDistributionStatus() {
  return api.get<{ releases?: Release[]; tracks?: Track[] }>("/creator/distribution");
}

export function getDashboard() {
  return api.get<{ tracks?: Track[]; releases?: Release[]; summary?: Record<string, unknown> }>("/creator/dashboard");
}

export function getMe() {
  return api.get<AccountInfo>("/creator/me");
}

export function updateAccount(patch: { displayName?: string }) {
  return api.patch<AccountInfo>("/creator/me", patch);
}

export const creatorQueryKeys = {
  dashboard: ["creator", "dashboard"] as const,
  tracks: ["creator", "tracks"] as const,
  trackStatus: (trackId: string) => ["creator", "tracks", trackId, "status"] as const,
  releases: ["creator", "releases"] as const,
  release: (releaseId: string) => ["creator", "releases", releaseId] as const,
  distribution: ["creator", "distribution"] as const,
  me: ["creator", "me"] as const,
};

export function useCreatorTracks() {
  return useQuery({ queryKey: creatorQueryKeys.tracks, queryFn: listTracks });
}

export function useTrackStatus(trackId: string, enabled = true) {
  return useQuery({
    queryKey: creatorQueryKeys.trackStatus(trackId),
    queryFn: () => getTrackStatus(trackId),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.track.status;
      return status === "uploading" || status === "uploaded" || status === "processing" ? 3000 : false;
    },
  });
}

export function useUpdateTrackMetadata(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: TrackMetadataPatch) => updateTrackMetadata(trackId, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: creatorQueryKeys.tracks });
      void qc.invalidateQueries({ queryKey: creatorQueryKeys.trackStatus(trackId) });
    },
  });
}

export function useSubmitTrack(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitTrack(trackId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: creatorQueryKeys.tracks });
      void qc.invalidateQueries({ queryKey: creatorQueryKeys.trackStatus(trackId) });
    },
  });
}
