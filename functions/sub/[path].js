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
import { incrementAccess } from '../_lib/store.js';
import { handleCORS } from '../_lib/response.js';

// How long a converted subscription stays cached at the edge.
// The client refresh interval is 6 min (Profile-Update-Interval), so a
// 5-minute cache serves almost every refresh from the edge without
// re-fetching the (often slow) source subscription.
const CACHE_TTL = 300;

export async function onRequestGet(context) {
  const { params, env, request } = context;

  if (!env.SUBCONVERT_KV) {
    return new Response('KV namespace not configured', { status: 500 });
  }

  // The splat parameter gives us the full path after /sub/
  const path = params.path;
  if (!path) {
    return new Response('Subscription path is required', { status: 400 });
  }

  // Serve from the edge cache when possible. This avoids re-fetching and
  // re-converting the source on every client refresh (the main cause of
  // slow loads / timeouts when the source is slow or rate-limited).
  const cache = caches.default;
  const cacheKey = new Request(request.url);
  const cached = await cache.match(cacheKey);
  if (cached) {
    // Still bump the access counter in the background.
    context.waitUntil(incrementAccess(env.SUBCONVERT_KV, path));
    return cached;
  }

  // Cache miss: do the full pipeline (fetch source → convert → count).
  const result = await processSubscriptionRequest(env.SUBCONVERT_KV, path);

  if (result.error) {
    return new Response(result.message, { status: result.error });
  }

  // Build response with appropriate headers
  const headers = {
    'Content-Type': result.contentType,
    // Allow edge/CDN caching for CACHE_TTL seconds so repeated client
    // fetches are served instantly without hitting the source again.
    'Cache-Control': `public, max-age=${CACHE_TTL}`,
    // Subscription info header (used by Clash clients)
    'Subscription-Userinfo': `upload=0; download=0; total=0; expire=0`,
    'Profile-Update-Interval': '6',
    // Allow cross-origin access
    'Access-Control-Allow-Origin': '*',
  };

  const response = new Response(result.content, {
    status: 200,
    headers,
  });

  // Store a clone in the cache for subsequent requests.
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export async function onRequestOptions() {
  return handleCORS();
}
