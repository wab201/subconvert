/**
 * GET  /api/links      - List all conversion links
 * DELETE /api/links    - Delete a link by path (query: ?path=xxx)
 *
 * GET response:
 *   { "links": [ { id, sourceUrl, targetFormat, customPath, name, createdAt, accessCount, lastAccessed } ] }
 *
 * DELETE response:
 *   { "success": true, "deleted": "path" }
 */

import { listLinks, deleteLink } from '../_lib/store.js';
import { json, error, handleCORS } from '../_lib/response.js';
import { checkAuth } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) {
    return error('Unauthorized: 访问密码错误或缺失', 401);
  }

  if (!env.SUBCONVERT_KV) {
    return error('KV namespace not configured', 500);
  }

  const links = await listLinks(env.SUBCONVERT_KV);

  // Build full subscription URLs
  const origin = new URL(request.url).origin;

  const linksWithUrl = links.map(link => ({
    ...link,
    subscriptionUrl: `${origin}/sub/${encodeURIComponent(link.customPath)}`,
  }));

  return json({ links: linksWithUrl });
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) {
    return error('Unauthorized: 访问密码错误或缺失', 401);
  }

  if (!env.SUBCONVERT_KV) {
    return error('KV namespace not configured', 500);
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!path) {
    return error('path query parameter is required');
  }

  const deleted = await deleteLink(env.SUBCONVERT_KV, path);
  if (!deleted) {
    return error('Link not found', 404);
  }

  return json({ success: true, deleted: path });
}

export async function onRequestOptions() {
  return handleCORS();
}
