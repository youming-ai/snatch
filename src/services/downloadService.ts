// Types for download results
export interface DownloadResult {
  id: string;
  type: "video" | "image";
  url: string;
  thumbnail: string;
  downloadUrl: string;
  title: string;
  size: string;
  platform: "instagram" | "twitter" | "tiktok";
}

// Extract video ID from Instagram URL
function extractInstagramId(url: string): string | null {
  const patterns = [
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Extract tweet ID from Twitter/X URL
function extractTwitterId(url: string): string | null {
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    /(?:twitter\.com|x\.com)\/\w+\/statuses\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Extract video ID from TikTok URL
function extractTikTokId(url: string): string | null {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /tiktok\.com\/t\/([A-Za-z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Instagram downloader using oEmbed API (for basic info)
export async function downloadInstagram(
  url: string,
): Promise<DownloadResult[]> {
  const videoId = extractInstagramId(url);
  if (!videoId) {
    throw new Error("Invalid Instagram URL");
  }

  try {
    // Use Instagram oEmbed API to get basic info
    const oembedUrl = `https://www.instagram.com/reel/${videoId}/embed`;
    const response = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(oembedUrl)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Instagram content");
    }

    const data = await response.json();

    // For demo purposes, we'll create a result with placeholder data
    // In a real implementation, you would need to use a proper Instagram API
    return [
      {
        id: videoId,
        type: "video" as const,
        url: url,
        thumbnail: `https://via.placeholder.com/400x300?text=Instagram+${videoId}`,
        downloadUrl: url, // In real implementation, this would be the actual video URL
        title: `Instagram Reel - ${videoId}`,
        size: "~2.4 MB",
        platform: "instagram" as const,
      },
    ];
  } catch (error) {
    console.error("Instagram download error:", error);
    throw new Error("Failed to download Instagram content");
  }
}

// Twitter/X downloader using oEmbed API
export async function downloadTwitter(url: string): Promise<DownloadResult[]> {
  const tweetId = extractTwitterId(url);
  if (!tweetId) {
    throw new Error("Invalid Twitter/X URL");
  }

  try {
    // Use Twitter oEmbed API to get basic info
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch Twitter content");
    }

    const data = await response.json();

    // For demo purposes, return mock data
    // In a real implementation, you would extract actual media URLs
    return [
      {
        id: tweetId,
        type: "video" as const,
        url: url,
        thumbnail: `https://via.placeholder.com/400x300?text=Twitter+${tweetId}`,
        downloadUrl: url, // In real implementation, this would be the actual video URL
        title: data.author_name
          ? `Tweet by ${data.author_name}`
          : `Tweet ${tweetId}`,
        size: "~1.8 MB",
        platform: "twitter" as const,
      },
    ];
  } catch (error) {
    console.error("Twitter download error:", error);
    throw new Error("Failed to download Twitter content");
  }
}

// TikTok downloader (basic implementation)
export async function downloadTikTok(url: string): Promise<DownloadResult[]> {
  const videoId = extractTikTokId(url);
  if (!videoId) {
    throw new Error("Invalid TikTok URL");
  }

  try {
    // For demo purposes, return mock data
    // In a real implementation, you would need to use TikTok's API or scrape the page
    // Note: Be aware of TikTok's terms of service and rate limiting

    return [
      {
        id: videoId,
        type: "video" as const,
        url: url,
        thumbnail: `https://via.placeholder.com/400x300?text=TikTok+${videoId}`,
        downloadUrl: url, // In real implementation, this would be the actual video URL
        title: `TikTok Video - ${videoId}`,
        size: "~3.2 MB",
        platform: "tiktok" as const,
      },
    ];
  } catch (error) {
    console.error("TikTok download error:", error);
    throw new Error("Failed to download TikTok content");
  }
}

// Main download function that detects platform and calls appropriate handler
export async function downloadFromUrl(url: string): Promise<DownloadResult[]> {
  if (url.includes("instagram.com")) {
    return downloadInstagram(url);
  } else if (url.includes("x.com") || url.includes("twitter.com")) {
    return downloadTwitter(url);
  } else if (url.includes("tiktok.com")) {
    return downloadTikTok(url);
  } else {
    throw new Error(
      "Unsupported platform. Please use Instagram, X (Twitter), or TikTok URL",
    );
  }
}

// Utility function to download file from URL
export function downloadFile(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
