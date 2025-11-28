import type {
  DownloadResponse,
  DownloadResult,
  SupportedPlatform,
} from "./types";

/**
 * Vercel Serverless Function for social media content download
 * Optimized for Vercel's Node.js 20.x runtime
 */
export const config = {
  runtime: "nodejs20.x",
  maxDuration: 30, // seconds
};

/**
 * Main handler for Vercel serverless function
 */
export default async function handler(request: Request, env: any) {
  // Add CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS requests for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);

    if (url.pathname !== "/api/download") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { url: downloadUrl } = body;
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    console.log(
      `[${new Date().toISOString()}] Download request from ${clientIP} for URL: ${downloadUrl}`,
    );

    // Process download request
    const response = await processDownloadRequest(downloadUrl, clientIP);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("API Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        message: "An error occurred while processing your request",
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}

/**
 * Process the actual download request
 */
async function processDownloadRequest(
  url: string,
  clientIP: string,
): Promise<DownloadResponse> {
  try {
    // Detect platform
    const platform = detectPlatform(url);

    if (!platform) {
      return {
        success: false,
        error:
          "Unsupported platform. Please enter Instagram, TikTok, or X (Twitter) URL",
      };
    }

    // Check rate limiting (simple implementation)
    if (!checkRateLimit(clientIP)) {
      return {
        success: false,
        error: "Too many requests. Please try again later.",
        platform,
      };
    }

    // Process download based on platform
    let response: DownloadResponse;

    switch (platform) {
      case "instagram":
        response = await processInstagramDownload(url);
        break;
      case "tiktok":
        response = await processTikTokDownload(url);
        break;
      case "twitter":
        response = await processTwitterDownload(url);
        break;
      default:
        response = {
          success: false,
          error: "Platform not supported",
        };
    }

    return response;
  } catch (error) {
    console.error("Download processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): SupportedPlatform | null {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes("instagram.com")) return "instagram";
  if (lowercaseUrl.includes("tiktok.com")) return "tiktok";
  if (lowercaseUrl.includes("x.com") || lowercaseUrl.includes("twitter.com"))
    return "twitter";

  return null;
}

/**
 * Simple rate limiting implementation
 */
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const limit = 100; // requests per hour
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (!rateLimitStore.has(clientIP)) {
    rateLimitStore.set(clientIP, { count: 1, lastReset: now });
    return true;
  }

  const client = rateLimitStore.get(clientIP)!;

  // Reset counter if window has passed
  if (now - client.lastReset > windowMs) {
    rateLimitStore.set(clientIP, { count: 1, lastReset: now });
    return true;
  }

  // Check limit
  if (client.count >= limit) {
    return false;
  }

  // Increment counter
  client.count++;
  return true;
}

/**
 * Process Instagram download
 */
async function processInstagramDownload(
  url: string,
): Promise<DownloadResponse> {
  try {
    // Try different methods for Instagram
    let results: DownloadResult[] = [];

    // Method 1: Try oEmbed API
    try {
      const oembedResult = await tryInstagramOEmbed(url);
      if (oembedResult.success && oembedResult.results.length > 0) {
        results = oembedResult.results;
      }
    } catch (e) {
      console.warn("Instagram oEmbed failed:", e);
    }

    // Method 2: Try metadata extraction
    if (results.length === 0) {
      try {
        const metadataResult = await extractMetadata(url);
        if (metadataResult.success) {
          results = metadataResult.results;
        }
      } catch (e) {
        console.warn("Instagram metadata extraction failed:", e);
      }
    }

    // Method 3: Create demo response
    if (results.length === 0) {
      results = [createInstagramDemoResult(url)];
    }

    return {
      success: true,
      results,
      platform: "instagram",
      message: results.some((r) => r.isMock)
        ? "This is a demo response. Real downloads require a server environment with full Node.js runtime."
        : undefined,
    };
  } catch (error) {
    console.error("Instagram download error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Instagram download failed",
    };
  }
}

/**
 * Process TikTok download
 */
async function processTikTokDownload(url: string): Promise<DownloadResponse> {
  try {
    let results: DownloadResult[] = [];

    // Method 1: Try metadata extraction
    try {
      const metadataResult = await extractMetadata(url);
      if (metadataResult.success) {
        results = metadataResult.results;
      }
    } catch (e) {
      console.warn("TikTok metadata extraction failed:", e);
    }

    // Method 2: Create demo response
    if (results.length === 0) {
      results = [createTikTokDemoResult(url)];
    }

    return {
      success: true,
      results,
      platform: "tiktok",
      message: results.some((r) => r.isMock)
        ? "This is a demo response. Real TikTok downloads require specialized API access."
        : undefined,
    };
  } catch (error) {
    console.error("TikTok download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "TikTok download failed",
    };
  }
}

/**
 * Process Twitter download
 */
async function processTwitterDownload(url: string): Promise<DownloadResponse> {
  try {
    let results: DownloadResult[] = [];

    // Method 1: Try metadata extraction
    try {
      const metadataResult = await extractMetadata(url);
      if (metadataResult.success) {
        results = metadataResult.results;
      }
    } catch (e) {
      console.warn("Twitter metadata extraction failed:", e);
    }

    // Method 2: Create demo response
    if (results.length === 0) {
      results = [createTwitterDemoResult(url)];
    }

    return {
      success: true,
      results,
      platform: "twitter",
      message: "Twitter API access is limited. This is a demo response.",
    };
  } catch (error) {
    console.error("Twitter download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Twitter download failed",
    };
  }
}

/**
 * Try Instagram oEmbed API
 */
async function tryInstagramOEmbed(url: string): Promise<DownloadResponse> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&format=json&maxwidth=640`;

    const response = await fetch(oembedUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Instagram oEmbed API failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.html) {
      throw new Error("No HTML content in oEmbed response");
    }

    // Extract media URLs from HTML
    const mediaUrls = extractMediaUrlsFromHTML(data.html);

    if (mediaUrls.length === 0) {
      throw new Error("No media found in oEmbed response");
    }

    const results: DownloadResult[] = mediaUrls.map((mediaUrl, index) => ({
      id: `instagram-${Date.now()}-${index}`,
      type: mediaUrl.includes(".mp4") ? "video" : "image",
      url: url,
      thumbnail: mediaUrl,
      downloadUrl: mediaUrl,
      title: data.title || "Instagram Content",
      size: "Unknown",
      platform: "instagram",
      quality: mediaUrl.includes("/HD.") ? "hd" : "unknown",
    }));

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Instagram oEmbed error:", error);
    throw error;
  }
}

/**
 * Extract metadata from URL
 */
async function extractMetadata(url: string): Promise<DownloadResponse> {
  try {
    // Use a proxy service for basic metadata extraction
    const proxyUrl = `https://r.jina.ai/http://${encodeURIComponent(url.substring(8))}`;

    const response = await fetch(proxyUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error("Metadata extraction failed");
    }

    const data = await response.json();

    const title = data.title || "Unknown Content";
    const description = data.description || "";

    // Create a demo result with extracted metadata
    const results: DownloadResult[] = [
      {
        id: `metadata-${Date.now()}`,
        type: "video",
        url: url,
        thumbnail: generatePlaceholderThumbnail("instagram"),
        downloadUrl: "#demo-download",
        title: title,
        size: "Unknown",
        platform: "instagram",
        quality: "unknown",
        isMock: true,
      },
    ];

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Metadata extraction error:", error);
    throw error;
  }
}

/**
 * Create Instagram demo result
 */
function createInstagramDemoResult(url: string): DownloadResult {
  return {
    id: `demo-instagram-${Date.now()}`,
    type: "video",
    url: url,
    thumbnail: generatePlaceholderThumbnail("instagram"),
    downloadUrl: "#demo-download",
    title: "Instagram Content (Demo)",
    size: "Unknown",
    platform: "instagram",
    quality: "unknown",
    isMock: true,
  };
}

/**
 * Create TikTok demo result
 */
function createTikTokDemoResult(url: string): DownloadResult {
  return {
    id: `demo-tiktok-${Date.now()}`,
    type: "video",
    url: url,
    thumbnail: generatePlaceholderThumbnail("tiktok"),
    downloadUrl: "#demo-download",
    title: "TikTok Content (Demo)",
    size: "Unknown",
    platform: "tiktok",
    quality: "unknown",
    isMock: true,
  };
}

/**
 * Create Twitter demo result
 */
function createTwitterDemoResult(url: string): DownloadResult {
  return {
    id: `demo-twitter-${Date.now()}`,
    type: "video",
    url: url,
    thumbnail: generatePlaceholderThumbnail("twitter"),
    downloadUrl: "#demo-download",
    title: "Twitter Content (Demo)",
    size: "Unknown",
    platform: "twitter",
    quality: "unknown",
    isMock: true,
  };
}

/**
 * Extract media URLs from HTML
 */
function extractMediaUrlsFromHTML(html: string): string[] {
  const urls: string[] = [];

  // Extract video URLs
  const videoMatches = html.matchAll(/https:\/\/[^"\s]*\.mp4[^"\s]*/g);
  for (const match of videoMatches) {
    if (!urls.includes(match[0])) {
      urls.push(match[0]);
    }
  }

  // Extract image URLs
  const imageMatches = html.matchAll(
    /https:\/\/[^"\s]*\.(jpg|jpeg|png|webp)[^"\s]*/g,
  );
  for (const match of imageMatches) {
    if (!urls.includes(match[0])) {
      urls.push(match[0]);
    }
  }

  return urls;
}

/**
 * Generate platform-specific placeholder thumbnail
 */
function generatePlaceholderThumbnail(platform: string): string {
  const colors = {
    instagram: "FF69B4",
    tiktok: "000000",
    twitter: "1DA1F2",
  };

  const color = colors[platform] || "1a1a2e";
  return `https://via.placeholder.com/400x300/${color}/FFFFFF?text=${platform.toUpperCase()}+Content`;
}

// Type definitions (normally this would be in a separate types file)
interface DownloadResult {
  id: string;
  type: "video" | "image";
  url: string;
  thumbnail: string;
  downloadUrl: string;
  title: string;
  size: string;
  platform: SupportedPlatform;
  quality?: string;
  isMock?: boolean;
}

type SupportedPlatform = "instagram" | "tiktok" | "twitter";

interface DownloadResponse {
  success: boolean;
  results?: DownloadResult[];
  error?: string;
  platform?: SupportedPlatform;
  message?: string;
}
