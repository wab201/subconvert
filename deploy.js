// Deploy launcher - clears proxy env vars before starting wrangler
// Same workaround as dev.js for the HTTPS_PROXY interference issue

const { spawn } = require('child_process');
const path = require('path');

// Remove proxy environment variables that interfere with wrangler's fetch
const proxyVars = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy',
  'NO_PROXY', 'no_proxy'
];

for (const v of proxyVars) {
  delete process.env[v];
}

console.log('[deploy] Proxy environment variables cleared.');

// Start wrangler pages deploy
const wranglerBin = path.join(__dirname, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const child = spawn(process.execPath, [
  wranglerBin, 'pages', 'deploy', 'public'
], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (err) => {
  console.error('[deploy] Failed to start wrangler:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
