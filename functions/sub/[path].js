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
    // No Cache-Control header is set on purpose: every explicit value we tried
    // was wrong for "rely solely on the server-side edge cache".
    //  - no-store  -> Cloudflare cache.put() returns 413 and the edge cache
    //                 silently stops working (every request re-fetches source)
    //  - no-cache  -> edge entry has ~0 freshness, cache.match() misses next time
    //  - max-age=N -> client and edge TTL are coupled, single-user refresh defeats it
    // With NO cache-control directive (and no Expires), Cloudflare applies its
    // default Edge TTL of 120 min for 200 responses, so caches.default stores a
    // warm entry for up to ~2h. Client-side caching is left to the client; per
    // the project's decision the client refresh interval is not something we try
    // to control from here.
    // Subscription-Userinfo: restored from the source subscription so the
    // client keeps seeing traffic usage / expiry. Falls back to zeros when
    // the source does not report it.
    'Subscription-Userinfo': result.userInfo || 'upload=0; download=0; total=0; expire=0',
    // Allow cross-origin access
    'Access-Control-Allow-Origin': '*',
  };

  // Carry the source's management-page URL through (if any), so clients can
  // open the subscription's dashboard directly.
  if (result.webPageUrl) {
    headers['profile-web-page-url'] = result.webPageUrl;
  }

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
