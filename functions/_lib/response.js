/** Shared response helpers for API endpoints */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Password',
    },
  });
}

export function text(content, contentType = 'text/plain; charset=utf-8', status = 200) {
  return new Response(content, {
    status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

/** Handle CORS preflight */
export function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Password',
    },
  });
}
