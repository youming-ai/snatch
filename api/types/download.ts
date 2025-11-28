export type SupportedPlatform = 'instagram' | 'tiktok' | 'twitter';

export interface DownloadResult {
  id: string;
  type: 'video' | 'image';
  url: string;
  thumbnail: string;
  downloadUrl: string;
  title: string;
  size: string;
  platform: SupportedPlatform;
  quality?: 'hd' | 'sd' | 'unknown';
  isMock?: boolean;
}

export interface DownloadResponse {
  success: boolean;
  results?: DownloadResult[];
  platform?: SupportedPlatform;
  error?: string;
  message?: string;
}
