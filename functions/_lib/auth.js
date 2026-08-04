/**
 * Auth utilities for SubConvert
 */

/**
 * Get password auth configuration from Cloudflare environment
 */
export function getAuthConfig(env) {
  const configuredPassword = (env && (env.ACCESS_PASSWORD || env.ADMIN_PASSWORD)) || '';
  const password = typeof configuredPassword === 'string' ? configuredPassword.trim() : String(configuredPassword);
  return {
    required: password.length > 0,
    password,
  };
}

/**
 * Verify request authentication against configured password
 */
export function checkAuth(request, env) {
  const { required, password } = getAuthConfig(env);
  if (!required) {
    return { ok: true, required: false };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const customHeader = request.headers.get('X-Access-Password') || '';

  let providedPassword = '';
  if (customHeader) {
    providedPassword = customHeader.trim();
  } else if (authHeader.toLowerCase().startsWith('bearer ')) {
    providedPassword = authHeader.substring(7).trim();
  }

  if (providedPassword === password) {
    return { ok: true, required: true };
  }

  return { ok: false, required: true };
}
