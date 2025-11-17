export interface DownloadResult {
  id: string
  type: 'video' | 'image'
  url: string
  thumbnail: string
  downloadUrl: string
  title: string
  size: string
  platform: 'instagram' | 'twitter' | 'tiktok'
}

export interface PlatformDetector {
  detect(url: string): 'instagram' | 'twitter' | 'tiktok' | null
  extractId(url: string): string | null
}

class SocialMediaPlatformDetector implements PlatformDetector {
  detect(url: string): 'instagram' | 'twitter' | 'tiktok' | null {
    const normalizedUrl = url.toLowerCase().trim()

    if (normalizedUrl.includes('instagram.com')) {
      return 'instagram'
    }
    if (normalizedUrl.includes('x.com') || normalizedUrl.includes('twitter.com')) {
      return 'twitter'
    }
    if (normalizedUrl.includes('tiktok.com')) {
      return 'tiktok'
    }

    return null
  }

  extractId(url: string): string | null {
    const platform = this.detect(url)
    if (!platform) return null

    try {
      const urlObj = new URL(url)

      switch (platform) {
        case 'instagram':
          // Extract reel/post ID from Instagram URL
          const instagramPath = urlObj.pathname
          const reelMatch = instagramPath.match(/\/reel\/([^\/]+)/)
          const postMatch = instagramPath.match(/\/p\/([^\/]+)/)
          return reelMatch?.[1] || postMatch?.[1] || null

        case 'twitter':
          // Extract tweet ID from X/Twitter URL
          const twitterPath = urlObj.pathname
          const tweetMatch = twitterPath.match(/\/status\/(\d+)/)
          return tweetMatch?.[1] || null

        case 'tiktok':
          // Extract video ID from TikTok URL
          const tiktokPath = urlObj.pathname
          const videoMatch = tiktokPath.match(/\/video\/(\d+)/)
          return videoMatch?.[1] || null

        default:
          return null
      }
    } catch {
      return null
    }
  }
}

export class DownloadService {
  private detector: PlatformDetector

  constructor() {
    this.detector = new SocialMediaPlatformDetector()
  }

  async download(url: string): Promise<DownloadResult[]> {
    const platform = this.detector.detect(url)
    if (!platform) {
      throw new Error('Unsupported platform. Please use Instagram, X (Twitter), or TikTok URLs.')
    }

    const contentId = this.detector.extractId(url)
    if (!contentId) {
      throw new Error(`Could not extract ${platform} content ID from URL.`)
    }

    // Simulate API call to backend
    // In a real implementation, this would call your backend API
    console.log(`Downloading ${platform} content with ID: ${contentId}`)

    // Mock implementation - replace with actual API calls
    return this.mockDownload(platform, url, contentId)
  }

  private async mockDownload(
    platform: 'instagram' | 'twitter' | 'tiktok',
    originalUrl: string,
    contentId: string
  ): Promise<DownloadResult[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000))

    // Generate mock results based on platform
    const baseResult: DownloadResult = {
      id: `${platform}-${contentId}-${Date.now()}`,
      type: 'video',
      url: originalUrl,
      thumbnail: `https://via.placeholder.com/400x300/1a1a2e/16213e?text=${platform.toUpperCase()}+Content`,
      downloadUrl: '#', // Would be actual download URL
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Content`,
      size: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
      platform
    }

    // Some platforms might have multiple quality options
    if (platform === 'instagram') {
      return [
        { ...baseResult, title: 'Instagram Reel - HD Quality', size: '4.2 MB' },
        { ...baseResult, id: `${baseResult.id}-sd`, title: 'Instagram Reel - SD Quality', size: '1.8 MB' }
      ]
    }

    if (platform === 'tiktok') {
      return [
        { ...baseResult, title: 'TikTok Video - No Watermark', size: '3.1 MB' },
        { ...baseResult, id: `${base.result.id}-watermark`, title: 'TikTok Video - With Watermark', size: '2.8 MB' }
      ]
    }

    return [baseResult]
  }

  detectPlatform(url: string): 'instagram' | 'twitter' | 'tiktok' | null {
    return this.detector.detect(url)
  }
}

export const downloadService = new DownloadService()
