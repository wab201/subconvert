/**
 * GET /sub/:path - Subscription output endpoint
 *
 * Fetches the source subscription, converts to the target format,
 * and returns the result. This endpoint is hit every time a client
 * fetches the subscription URL, so it always pulls the latest source.
 *
 * The conversion happens entirely on Cloudflare's edge — no third-party
 * conversion services are used, ensuring subscription data never leaves
 * your own infrastructure.
 */

import { processSubscriptionRequest } from '../_lib/convert.js';
import { handleCORS } from '../_lib/response.js';

export async function onRequestGet(context) {
  const { params, env } = context;

  if (!env.SUBCONVERT_KV) {
    return new Response('KV namespace not configured', { status: 500 });
  }

  // The splat parameter gives us the full path after /sub/
  const path = params.path;
  if (!path) {
    return new Response('Subscription path is required', { status: 400 });
  }

  // Process the subscription request
  const result = await processSubscriptionRequest(env.SUBCONVERT_KV, path);

  if (result.error) {
    return new Response(result.message, { status: result.error });
  }

  // Build response with appropriate headers
  const headers = {
    'Content-Type': result.contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    // Subscription info header (used by Clash clients)
    'Subscription-Userinfo': `upload=0; download=0; total=0; expire=0`,
    'Profile-Update-Interval': '6',
    // Allow cross-origin access
    'Access-Control-Allow-Origin': '*',
  };

  // Add Content-Disposition for file download
  const formatExtensions = {
    clash: 'yaml',
    singbox: 'json',
    base64: 'txt',
    plain: 'txt',
  };

  return new Response(result.content, {
    status: 200,
    headers,
  });
}

export async function onRequestOptions() {
  return handleCORS();
}
