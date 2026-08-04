/**
 * KV storage helpers for managing conversion links.
 *
 * KV schema:
 *   Key: "link:{customPath}"  → JSON string of link config
 *   Key: "meta:{customPath}"  → JSON string of metadata (access count, etc.)
 */

const PREFIX = 'link:';
const META_PREFIX = 'meta:';

/**
 * Create or update a conversion link.
 * @param {DurableObjectNamespace|KVNamespace} kv
 * @param {object} link - { sourceUrl, targetFormat, customPath, name }
 * @returns {object} The stored link object
 */
export async function createLink(kv, link) {
  const now = Date.now();
  const record = {
    id: link.id || link.customPath,
    sourceUrl: link.sourceUrl,
    targetFormat: link.targetFormat,
    customPath: link.customPath,
    name: link.name || '',
    userAgent: link.userAgent || '',
    createdAt: now,
    accessCount: 0,
  };

  await kv.put(PREFIX + link.customPath, JSON.stringify(record));
  return record;
}

/**
 * Get a conversion link by its custom path.
 * @param {KVNamespace} kv
 * @param {string} path
 * @returns {Promise<object|null>}
 */
export async function getLink(kv, path) {
  const raw = await kv.get(PREFIX + path);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * List all conversion links.
 * @param {KVNamespace} kv
 * @returns {Promise<Array>}
 */
export async function listLinks(kv) {
  const result = await kv.list({ prefix: PREFIX });
  const links = [];
  for (const key of result.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      try {
        links.push(JSON.parse(raw));
      } catch { /* skip invalid */ }
    }
  }
  // Sort by creation date, newest first
  links.sort((a, b) => b.createdAt - a.createdAt);
  return links;
}

/**
 * Delete a conversion link by its custom path.
 * @param {KVNamespace} kv
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function deleteLink(kv, path) {
  const exists = await getLink(kv, path);
  if (!exists) return false;
  await kv.delete(PREFIX + path);
  await kv.delete(META_PREFIX + path);
  return true;
}

/**
 * Increment the access count for a link.
 * @param {KVNamespace} kv
 * @param {string} path
 */
export async function incrementAccess(kv, path) {
  try {
    const link = await getLink(kv, path);
    if (!link) return;
    link.accessCount = (link.accessCount || 0) + 1;
    link.lastAccessed = Date.now();
    await kv.put(PREFIX + path, JSON.stringify(link));
  } catch { /* non-critical */ }
}

/**
 * Check if a custom path already exists.
 * @param {KVNamespace} kv
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function pathExists(kv, path) {
  const link = await getLink(kv, path);
  return link !== null;
}
