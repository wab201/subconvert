/**
 * Parse subscription content in various formats into unified node arrays.
 *
 * Supported input formats:
 * - base64: Base64-encoded list of proxy URIs
 * - clash: Clash/Mihomo YAML config
 * - singbox: Sing-box JSON config
 * - plain: Plain text list of proxy URIs (one per line)
 */

import yaml from 'js-yaml';
import { parseURI } from './uri-parse.js';
import { b64Decode, tryBase64Decode } from './utils.js';

/**
 * Auto-detect and parse subscription content.
 * @param {string} content - Raw subscription content
 * @returns {{nodes: Array, format: string}}
 */
export function parseSubscription(content) {
  if (!content || !content.trim()) return { nodes: [], format: 'unknown' };

  const format = detectFormat(content);
  let nodes = [];

  switch (format) {
    case 'base64':
      nodes = parseBase64Sub(content);
      break;
    case 'clash':
      nodes = parseClashSub(content);
      break;
    case 'singbox':
      nodes = parseSingboxSub(content);
      break;
    case 'plain':
      nodes = parsePlainSub(content);
      break;
  }

  return { nodes, format };
}

/**
 * Detect the format of subscription content.
 */
export function detectFormat(content) {
  const trimmed = content.trim();

  // Check if it's JSON (sing-box)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json.outbounds || json.proxies) return 'singbox';
    } catch { /* not JSON */ }
  }

  // Check if it's YAML (clash)
  if (trimmed.includes('proxies:') || (trimmed.includes('proxy-groups:') && trimmed.includes('rules:'))) {
    try {
      const doc = yaml.load(trimmed);
      if (doc && doc.proxies && Array.isArray(doc.proxies)) return 'clash';
    } catch { /* not valid YAML */ }
  }

  // Check if it's base64 encoded
  const decoded = tryBase64Decode(trimmed);
  if (decoded) {
    if (/:\/\//.test(decoded)) return 'base64';
  }

  // Check if it's plain text with proxy URIs
  if (/:\/\//.test(trimmed)) return 'plain';

  return 'unknown';
}

/** Parse base64-encoded subscription (decodes to URI list) */
export function parseBase64Sub(content) {
  const decoded = b64Decode(content.trim());
  if (!decoded) return [];
  return parsePlainSub(decoded);
}

/** Parse plain text list of proxy URIs */
export function parsePlainSub(content) {
  const lines = content.trim().split(/[\r\n]+/);
  const nodes = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const node = parseURI(trimmed);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** Parse Clash/Mihomo YAML subscription */
export function parseClashSub(content) {
  const doc = yaml.load(content);
  if (!doc || !doc.proxies || !Array.isArray(doc.proxies)) return [];

  const nodes = [];
  for (const proxy of doc.proxies) {
    const node = clashProxyToNode(proxy);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** Convert a Clash proxy entry to unified node format */
function clashProxyToNode(p) {
  if (!p || !p.type) return null;
  const base = {
    type: p.type,
    name: p.name || '',
    server: p.server,
    port: parseInt(p.port, 10),
  };

  switch (p.type) {
    case 'ss':
      return {
        ...base,
        cipher: p.cipher,
        password: p.password,
      };

    case 'vmess':
      return {
        ...base,
        uuid: p.uuid,
        alterId: p.aid || p.alterId || 0,
        cipher: p.cipher || 'auto',
        network: p.network || 'tcp',
        tls: p.tls ? 'tls' : 'none',
        sni: p.servername || p.sni,
        skipCertVerify: p['skip-cert-verify'] || false,
        wsPath: p['ws-opts']?.path,
        wsHost: p['ws-opts']?.headers?.Host,
        grpcServiceName: p['grpc-opts']?.['grpc-service-name'],
        grpcMode: p['grpc-opts']?.['grpc-mode'],
        h2Host: p['h2-opts']?.host,
        h2Path: p['h2-opts']?.path,
        alpn: p.alpn,
        fingerprint: p['client-fingerprint'],
      };

    case 'vless':
      return {
        ...base,
        uuid: p.uuid,
        flow: p.flow,
        network: p.network || 'tcp',
        tls: p['reality-opts'] ? 'reality' : (p.tls === true ? 'tls' : 'none'),
        sni: p.servername || p.sni,
        skipCertVerify: p['skip-cert-verify'] || false,
        realityPublicKey: p['reality-opts']?.['public-key'],
        realityShortId: p['reality-opts']?.['short-id'],
        wsPath: p['ws-opts']?.path,
        wsHost: p['ws-opts']?.headers?.Host,
        grpcServiceName: p['grpc-opts']?.['grpc-service-name'],
        grpcMode: p['grpc-opts']?.['grpc-mode'],
        h2Host: p['h2-opts']?.host,
        h2Path: p['h2-opts']?.path,
        alpn: p.alpn,
        fingerprint: p['client-fingerprint'],
      };

    case 'trojan':
      return {
        ...base,
        password: p.password,
        network: p.network || 'tcp',
        tls: 'tls',
        sni: p.sni || p.servername,
        skipCertVerify: p['skip-cert-verify'] || false,
        wsPath: p['ws-opts']?.path,
        wsHost: p['ws-opts']?.headers?.Host,
        grpcServiceName: p['grpc-opts']?.['grpc-service-name'],
        grpcMode: p['grpc-opts']?.['grpc-mode'],
        alpn: p.alpn,
        fingerprint: p['client-fingerprint'],
      };

    case 'hysteria2':
    case 'hy2':
      return {
        ...base,
        type: 'hysteria2',
        auth: p.password || p.auth,
        password: p.password || p.auth,
        tls: 'tls',
        sni: p.sni,
        skipCertVerify: p['skip-cert-verify'] || false,
        up: p.up,
        down: p.down,
        obfs: p.obfs,
        obfsPassword: p['obfs-password'],
        alpn: p.alpn,
      };

    case 'tuic':
      return {
        ...base,
        uuid: p.uuid,
        password: p.password,
        tls: 'tls',
        sni: p.sni,
        skipCertVerify: p['skip-cert-verify'] || false,
        congestionControl: p['congestion-controller'] || p['congestion-control'],
        udpRelayMode: p['udp-relay-mode'],
        alpn: p.alpn,
      };

    default:
      // Unknown type, store as-is with minimal fields
      return { ...base, _raw: p };
  }
}

/** Parse Sing-box JSON subscription */
export function parseSingboxSub(content) {
  const doc = JSON.parse(content);
  if (!doc.outbounds || !Array.isArray(doc.outbounds)) return [];

  const nodes = [];
  for (const ob of doc.outbounds) {
    const node = singboxOutboundToNode(ob);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** Convert a Sing-box outbound to unified node format */
function singboxOutboundToNode(ob) {
  if (!ob || !ob.type) return null;
  // Skip non-proxy outbounds
  const skipTypes = ['direct', 'block', 'dns', 'selector', 'urltest', 'compat'];
  if (skipTypes.includes(ob.type)) return null;

  const base = {
    type: ob.type === 'shadowsocks' ? 'ss' : ob.type,
    name: ob.tag || '',
    server: ob.server,
    port: ob.server_port,
  };

  switch (ob.type) {
    case 'shadowsocks':
      return {
        ...base,
        type: 'ss',
        cipher: ob.method,
        password: ob.password,
      };

    case 'vmess':
      return {
        ...base,
        uuid: ob.uuid,
        alterId: ob.alter_id || 0,
        cipher: ob.security || 'auto',
        network: ob.transport?.type || 'tcp',
        tls: ob.tls?.enabled ? 'tls' : 'none',
        sni: ob.tls?.server_name,
        skipCertVerify: ob.tls?.insecure || false,
        alpn: ob.tls?.alpn,
        wsPath: ob.transport?.path,
        wsHost: ob.transport?.headers?.Host,
        grpcServiceName: ob.transport?.service_name,
        grpcMode: ob.transport?.mode,
        h2Host: ob.transport?.host,
        h2Path: ob.transport?.path,
        fingerprint: ob.tls?.utls?.fingerprint,
      };

    case 'vless':
      return {
        ...base,
        uuid: ob.uuid,
        flow: ob.flow,
        network: ob.transport?.type || 'tcp',
        tls: ob.tls?.enabled ? (ob.tls?.reality ? 'reality' : 'tls') : 'none',
        sni: ob.tls?.server_name,
        skipCertVerify: ob.tls?.insecure || false,
        realityPublicKey: ob.tls?.reality?.public_key,
        realityShortId: ob.tls?.reality?.short_id,
        wsPath: ob.transport?.path,
        wsHost: ob.transport?.headers?.Host,
        grpcServiceName: ob.transport?.service_name,
        grpcMode: ob.transport?.mode,
        h2Host: ob.transport?.host,
        h2Path: ob.transport?.path,
        alpn: ob.tls?.alpn,
        fingerprint: ob.tls?.utls?.fingerprint,
      };

    case 'trojan':
      return {
        ...base,
        password: ob.password,
        network: ob.transport?.type || 'tcp',
        tls: 'tls',
        sni: ob.tls?.server_name,
        skipCertVerify: ob.tls?.insecure || false,
        wsPath: ob.transport?.path,
        wsHost: ob.transport?.headers?.Host,
        grpcServiceName: ob.transport?.service_name,
        grpcMode: ob.transport?.mode,
        alpn: ob.tls?.alpn,
        fingerprint: ob.tls?.utls?.fingerprint,
      };

    case 'hysteria2':
      return {
        ...base,
        auth: ob.password,
        password: ob.password,
        tls: 'tls',
        sni: ob.tls?.server_name,
        skipCertVerify: ob.tls?.insecure || false,
        up: ob.up_mbps ? `${ob.up_mbps} Mbps` : undefined,
        down: ob.down_mbps ? `${ob.down_mbps} Mbps` : undefined,
        alpn: ob.tls?.alpn,
      };

    case 'tuic':
      return {
        ...base,
        uuid: ob.uuid,
        password: ob.password,
        tls: 'tls',
        sni: ob.tls?.server_name,
        skipCertVerify: ob.tls?.insecure || false,
        congestionControl: ob.congestion_control,
        udpRelayMode: ob.udp_relay_mode,
        alpn: ob.tls?.alpn,
      };

    default:
      return { ...base, _raw: ob };
  }
}
