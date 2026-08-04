/**
 * GET  /api/auth - Check password auth requirement and status
 * POST /api/auth - Verify provided password
 */

import { checkAuth, getAuthConfig } from '../_lib/auth.js';
import { json, error, handleCORS } from '../_lib/response.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const config = getAuthConfig(env);
  const authResult = checkAuth(request, env);

  return json({
    required: config.required,
    authenticated: authResult.ok,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = getAuthConfig(env);

  if (!config.required) {
    return json({ required: false, authenticated: true });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional if password is passed via header
  }

  const headerPassword = request.headers.get('X-Access-Password') || '';
  const bodyPassword = body.password || '';
  const provided = (headerPassword || bodyPassword).trim();

  if (provided === config.password) {
    return json({ required: true, authenticated: true });
  }

  return error('访问密码错误', 401);
}

export async function onRequestOptions() {
  return handleCORS();
}
