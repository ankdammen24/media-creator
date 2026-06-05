export type UserRole = 'creator' | 'admin';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: UserRole;
}

export type TrackStatus =
  | 'draft'
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'metadata_required'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'mastering'
  | 'mastered'
  | 'distributed'
  | 'published'
  | 'failed';

export type FileType =
  | 'original'
  | 'normalized'
  | 'preview'
  | 'technical_metadata'
  | 'master'
  | 'distribution_master'
  | 'distribution_preview'
  | 'artwork';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface UploadInputFile {
  filename: string;
  contentType: string;
  size: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
