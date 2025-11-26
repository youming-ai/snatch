/**
 * Environment detector to determine runtime capabilities
 */

export type Environment = 'development' | 'production' | 'cloudflare-pages' | 'vercel' | 'netlify' | 'other';

interface EnvironmentInfo {
  environment: Environment;
  isServer: boolean;
  isBrowser: boolean;
  supportsWebScraping: boolean;
  supportsFullSSR: boolean;
  platform: string;
}

/**
 * Detect current environment and capabilities
 */
export function detectEnvironment(): EnvironmentInfo {
  // Check if we're in a browser
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const isServer = !isBrowser;

  // Detect platform/deployment environment
  let environment: Environment = 'other';

  if (isServer) {
    // Server-side detection
    if (typeof process !== 'undefined') {
      if (process.env?.CLOUDFLARE_PAGES) {
        environment = 'cloudflare-pages';
      } else if (process.env?.VERCEL) {
        environment = 'vercel';
      } else if (process.env?.NETLIFY) {
        environment = 'netlify';
      } else if (process.env?.NODE_ENV === 'production') {
        environment = 'production';
      } else {
        environment = 'development';
      }
    }
  } else {
    // Browser-side detection
    if (window.location.hostname.includes('pages.dev')) {
      environment = 'cloudflare-pages';
    } else if (window.location.hostname.includes('vercel.app')) {
      environment = 'vercel';
    } else if (window.location.hostname.includes('netlify.app')) {
      environment = 'netlify';
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      environment = 'development';
    } else if (window.location.protocol === 'https:') {
      environment = 'production';
    }
  }

  // Determine capabilities based on environment
  const supportsFullSSR = isServer &&
    (environment === 'development' || environment === 'production');

  const supportsWebScraping = supportsFullSSR &&
    !['cloudflare-pages', 'vercel', 'netlify'].includes(environment);

  const platform = typeof navigator !== 'undefined'
    ? navigator.platform
    : typeof process !== 'undefined'
    ? process.platform
    : 'unknown';

  return {
    environment,
    isServer,
    isBrowser,
    supportsWebScraping,
    supportsFullSSR,
    platform,
  };
}

/**
 * Check if we're in a Cloudflare Pages environment
 */
export function isCloudflarePages(): boolean {
  const env = detectEnvironment();
  return env.environment === 'cloudflare-pages';
}

/**
 * Check if full server-side functionality is available
 */
export function hasServerCapabilities(): boolean {
  const env = detectEnvironment();
  return env.supportsWebScraping;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  const env = detectEnvironment();

  return {
    ...env,
    useClientSide: !env.supportsWebScraping,
    showDemoModeWarning: ['cloudflare-pages', 'vercel', 'netlify'].includes(env.environment),
    apiEndpoint: env.isBrowser
      ? '/api/download'
      : '/download',
  };
}
