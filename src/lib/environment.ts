/**
 * Environment detection utilities
 */

export interface EnvironmentInfo {
  isBrowser: boolean;
  isServer: boolean;
  isVercel: boolean;
  isCloudflarePages: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  supportsServerSideScraping: boolean;
}

/**
 * Check if running in Vercel environment
 */
export function isVercelEnvironment(): boolean {
  if (typeof process === 'undefined') return false;

  return !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_REGION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_REPO_SLUG
  );
}

/**
 * Detect current environment
 */
export function detectEnvironment(): EnvironmentInfo {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const isServer = !isBrowser;

  // Check for Vercel environment
  const isVercel = isVercelEnvironment();

  // Check development vs production
  const isDevelopment =
    process?.env?.NODE_ENV === "development" ||
    (typeof globalThis !== "undefined" && (globalThis as { __DEV__?: boolean }).__DEV__ === true);
  const isProduction = !isDevelopment;

  // Check if server-side scraping is supported
  // Vercel and Cloudflare Pages don't support Puppeteer/Crawlee
  const supportsServerSideScraping = isServer &&
    !isCloudflarePages &&
    !isVercel &&
    (typeof process !== 'undefined' && process.env.ENABLE_SCRAPING !== 'false');

  return {
    isBrowser,
    isServer,
    isVercel,
    isCloudflarePages,
    isDevelopment,
    isProduction,
    supportsServerSideScraping,
  };
}

/**
 * Get appropriate download service based on environment
 */
export async function getDownloadService() {
  const env = detectEnvironment();

  if (env.isVercel) {
    // Vercel environment - use Vercel-optimized service
    try {
      const { vercelDownloadService } = await import('../services/vercel-download.service');
      return vercelDownloadService;
    } catch (error) {
      console.warn('Failed to load Vercel service, falling back to client service:', error);
      const { clientDownloadService } = await import('../services/client-download.service');
      return clientDownloadService;
    }
  } else if (env.supportsServerSideScraping) {
    // Server environment with full Node.js support (not Vercel/Cloudflare)
    const { downloadService } = await import('../services/unified-download.service');
    return downloadService;
  } else {
    // Browser or limited server environment (Cloudflare Pages)
    const { clientDownloadService } = await import('../services/client-download.service');
    return clientDownloadService;
  }
}

/**
 * Get environment configuration
 */
export function getEnvironmentConfig() {
  const env = detectEnvironment();

  return {
    ...env,
    downloadService: getDownloadService(),
    message: env.isVercel
      ? 'Using Vercel-optimized service (limited functionality)'
      : env.supportsServerSideScraping
        ? 'Using full server-side service'
        : 'Using client-side service'
  };
}
