/**
 * Main conversion pipeline: fetch source subscription → parse → convert → output.
 * All processing happens locally on Cloudflare's edge — no third-party conversion services.
 */

import { parseSubscription } from './sub-parse.js';
import { generateSubscription } from './sub-generate.js';
import { getLink, incrementAccess } from './store.js';

/** Default User-Agent for fetching subscriptions (many providers require a specific UA) */
const DEFAULT_UA = 'clash';

/**
 * Fetch source subscription content.
 * @param {string} url - Source subscription URL
 * @param {string} userAgent - Optional custom User-Agent
 * @returns {Promise<string>} Raw subscription content
 */
export async function fetchSubscription(url, userAgent) {
  const ua = userAgent || DEFAULT_UA;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': '*/*',
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch subscription: ${resp.status} ${resp.statusText}`);
  }

  const content = await resp.text();
  if (!content || !content.trim()) {
    throw new Error('Subscription content is empty');
  }

  return content;
}

/**
 * Convert subscription content from one format to another.
 * @param {string} content - Raw subscription content
 * @param {string} targetFormat - Target output format
 * @param {object} options - Additional options
 * @returns {{content: string, contentType: string, sourceFormat: string, nodeCount: number}}
 */
export function convertSubscription(content, targetFormat, options = {}) {
  // Auto-detect and parse source format
  const { nodes, format: sourceFormat } = parseSubscription(content);

  if (nodes.length === 0) {
    throw new Error(`No proxy nodes found in subscription (detected format: ${sourceFormat})`);
  }

  // Generate target format
  const { content: output, contentType } = generateSubscription(nodes, targetFormat, options);

  return {
    content: output,
    contentType,
    sourceFormat,
    nodeCount: nodes.length,
  };
}

/**
 * Full conversion pipeline: fetch → parse → convert.
 * Fetches the source subscription, converts to target format, and updates access count.
 *
 * @param {KVNamespace} kv
 * @param {string} path - Custom path of the link
 * @returns {Promise<{content: string, contentType: string, nodeCount: number, sourceFormat: string}>}
 */
export async function processSubscriptionRequest(kv, path) {
  // Get link config from KV
  const link = await getLink(kv, path);
  if (!link) {
    return { error: 404, message: 'Subscription link not found' };
  }

  // Fetch source subscription
  let sourceContent;
  try {
    sourceContent = await fetchSubscription(link.sourceUrl, link.userAgent);
  } catch (e) {
    return { error: 502, message: `Failed to fetch source: ${e.message}` };
  }

  // Convert
  let result;
  try {
    result = convertSubscription(sourceContent, link.targetFormat, { name: link.name });
  } catch (e) {
    return { error: 500, message: `Conversion failed: ${e.message}` };
  }

  // Update access count (fire and forget)
  incrementAccess(kv, path);

  return {
    content: result.content,
    contentType: result.contentType,
    nodeCount: result.nodeCount,
    sourceFormat: result.sourceFormat,
  };
}
