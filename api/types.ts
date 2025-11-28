export interface DownloadResult {
  id: string;
  type: 'video' | 'image';
  url: string;
  thumbnail: string;
  downloadUrl: string;
  title: string;
  size: string;
  platform: SupportedPlatform;
  quality?: string;
  isMock?: boolean;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
}

export interface DownloadResponse {
  success: boolean;
  results?: DownloadResult[];
  error?: string;
  platform?: SupportedPlatform;
  message?: string;
}

export type SupportedPlatform = 'instagram' | 'tiktok' | 'twitter';

export interface RateLimitInfo {
  count: number;
  lastReset: number;
  windowMs: number;
}
