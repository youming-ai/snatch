/**
 * Cloudflare Pages Function for download API
 * This handles the server-side logic that can't run in the browser
 */

import type { DownloadResponse } from '../../types/download';

export async function onRequest(context: { request: Request; env: any }) {
  const { request, env } = context;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { url } = body;

    // Basic rate limiting (you can enhance this with KV storage)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    console.log(`Download request from ${clientIP} for URL: ${url}`);

    // Since we can't run Puppeteer/Crawlee in Cloudflare Pages,
    // we return a demo response that shows the UI works
    // In production, you'd need to use external APIs or serverless functions with full Node.js runtime
    const response: DownloadResponse = {
      success: true,
      results: [{
        id: `demo-${Date.now()}`,
        type: 'video',
        url: url,
        thumbnail: 'https://via.placeholder.com/400x225/1a1a2e/16213e?text=Demo+Content',
        downloadUrl: '#demo-download',
        title: 'Demo Content (Cloudflare Pages Limitation)',
        size: 'Unknown',
        platform: 'demo',
        quality: 'unknown',
        isMock: true,
      }],
      platform: 'demo',
      message: 'This is a demo response. Full functionality requires a server environment with Node.js runtime for web scraping.'
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Download function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while processing your request'
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
