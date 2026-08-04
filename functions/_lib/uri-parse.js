/**
 * Parse individual proxy protocol URIs into unified node objects.
 *
 * Supported protocols: ss, vmess, vless, trojan, hysteria2 (hy2), tuic
 *
 * Unified node format:
 * {
 *   type, name, server, port,
 *   // SS
 *   cipher?, password?,
 *   // VMess/VLESS
 *   uuid?, alterId?, flow?,
 *   // Transport
 *   network?, // tcp | ws | grpc | h2 | httpupgrade
 *   wsPath?, wsHost?,
 *   grpcServiceName?, grpcMode?,
 *   h2Host?, h2Path?,
 *   // TLS
 *   tls?, // tls | reality | none
 *   sni?, alpn?, fingerprint?, skipCertVerify?,
 *   // Reality
 *   realityPublicKey?, realityShortId?,
 *   // Hysteria2
 *   auth?, up?, down?,
 *   // TUIC
 *   congestionControl?, udpRelayMode?,
 * }
 */

import { b64Decode, b64UrlDecode, parseQueryString, decodeName } from './utils.js';

/** Parse a single proxy URI, auto-detecting the protocol */
export function parseURI(uri) {
  uri = uri.trim();
  if (!uri) return null;

  try {
    if (uri.startsWith('ss://')) return parseSS(uri);
    if (uri.startsWith('vmess://')) return parseVMess(uri);
    if (uri.startsWith('vless://')) return parseVLESS(uri);
    if (uri.startsWith('trojan://')) return parseTrojan(uri);
    if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) return parseHysteria2(uri);
    if (uri.startsWith('tuic://')) return parseTUIC(uri);
    if (uri.startsWith('hysteria://')) return parseHysteria2(uri.replace('hysteria://', 'hysteria2://'));
  } catch (e) {
    console.error('Parse error for URI:', e);
    return null;
  }
  return null;
}

/** Parse Shadowsocks URI (supports both SIP002 and legacy formats) */
function parseSS(uri) {
  // SIP002: ss://base64url(method:password)@host:port#name
  //         ss://base64url(method:password)@host:port/?plugin=...#name
  // Legacy: ss://base64(method:password@host:port)#name
  const body = uri.slice(5);
  const hashIdx = body.indexOf('#');
  const name = hashIdx >= 0 ? decodeName(body.slice(hashIdx + 1)) : '';
  const main = hashIdx >= 0 ? body.slice(0, hashIdx) : body;

  let method, password, server, port;

  if (main.includes('@')) {
    // SIP002 format
    const atIdx = main.lastIndexOf('@');
    const userInfo = main.slice(0, atIdx);
    const hostPort = main.slice(atIdx + 1);
    // Remove query string from hostPort
    const qIdx = hostPort.indexOf('?');
    const hostPart = qIdx >= 0 ? hostPort.slice(0, qIdx) : hostPort;

    // Try base64url decode the user info
    let decoded = b64UrlDecode(userInfo);
    if (!decoded) decoded = b64Decode(userInfo);
    if (!decoded) decoded = userInfo; // might be plaintext

    const colonIdx = decoded.indexOf(':');
    method = decoded.slice(0, colonIdx);
    password = decoded.slice(colonIdx + 1);

    // Parse host:port (handle IPv6)
    const lastColon = hostPart.lastIndexOf(':');
    server = hostPart.slice(0, lastColon).replace(/^\[|\]$/g, '');
    port = parseInt(hostPart.slice(lastColon + 1), 10);
  } else {
    // Legacy format: base64(method:password@host:port)
    const decoded = b64Decode(main);
    if (!decoded) return null;
    const atIdx = decoded.lastIndexOf('@');
    const methodPass = decoded.slice(0, atIdx);
    const hostPort = decoded.slice(atIdx + 1);
    const colonIdx = methodPass.indexOf(':');
    method = methodPass.slice(0, colonIdx);
    password = methodPass.slice(colonIdx + 1);
    const lastColon = hostPort.lastIndexOf(':');
    server = hostPort.slice(0, lastColon).replace(/^\[|\]$/g, '');
    port = parseInt(hostPort.slice(lastColon + 1), 10);
  }

  if (!server || !port || !method) return null;

  return {
    type: 'ss',
    name: name || `${server}:${port}`,
    server,
    port,
    cipher: method,
    password,
  };
}

/** Parse VMess URI (vmess://base64(json)) */
function parseVMess(uri) {
  const decoded = b64Decode(uri.slice(8));
  if (!decoded) return null;
  const config = JSON.parse(decoded);

  const node = {
    type: 'vmess',
    name: config.ps || config.remarks || '',
    server: config.add,
    port: parseInt(config.port, 10),
    uuid: config.id,
    alterId: parseInt(config.aid, 10) || 0,
    cipher: config.scy || 'auto',
    network: config.net || 'tcp',
    tls: (config.tls === 'tls' || config.tls === 'reality') ? config.tls : 'none',
  };

  if (config.sni) node.sni = config.sni;
  if (config.host) node.wsHost = config.host;
  if (config.path) node.wsPath = config.path;
  if (config.alpn) node.alpn = config.alpn;
  if (config.fp) node.fingerprint = config.fp;
  if (config.verify_cert === false || config.allowInsecure) node.skipCertVerify = true;

  // gRPC
  if (config.net === 'grpc' && config.path) {
    node.grpcServiceName = config.path;
    node.grpcMode = config.type || 'gun';
  }

  // h2
  if (config.net === 'h2') {
    if (config.host) node.h2Host = config.host.split(',');
    if (config.path) node.h2Path = config.path;
  }

  return node;
}

/** Parse VLESS URI */
function parseVLESS(uri) {
  const url = new URL(uri);
  const params = url.searchParams;

  const node = {
    type: 'vless',
    name: decodeName(url.hash.slice(1)),
    server: url.hostname,
    port: parseInt(url.port, 10),
    uuid: url.username,
    network: params.get('type') || 'tcp',
    tls: 'none',
  };

  const security = params.get('security');
  if (security === 'tls') node.tls = 'tls';
  else if (security === 'reality') node.tls = 'reality';
  else node.tls = 'none';

  if (params.get('flow')) node.flow = params.get('flow');
  if (params.get('sni')) node.sni = params.get('sni');
  if (params.get('alpn')) node.alpn = params.get('alpn').split(',');
  if (params.get('fp')) node.fingerprint = params.get('fp');
  if (params.get('allowInsecure') === '1') node.skipCertVerify = true;

  // Reality options
  if (node.tls === 'reality') {
    if (params.get('pbk')) node.realityPublicKey = params.get('pbk');
    if (params.get('sid')) node.realityShortId = params.get('sid');
  }

  // Transport options
  if (node.network === 'ws') {
    if (params.get('path')) node.wsPath = params.get('path');
    if (params.get('host')) node.wsHost = params.get('host');
  } else if (node.network === 'grpc') {
    if (params.get('serviceName')) node.grpcServiceName = params.get('serviceName');
    if (params.get('mode')) node.grpcMode = params.get('mode');
  } else if (node.network === 'h2' || node.network === 'http') {
    node.network = 'h2';
    if (params.get('host')) node.h2Host = params.get('host').split(',');
    if (params.get('path')) node.h2Path = params.get('path');
  }

  if (!node.name) node.name = `${node.server}:${node.port}`;
  return node;
}

/** Parse Trojan URI */
function parseTrojan(uri) {
  const url = new URL(uri);
  const params = url.searchParams;

  const node = {
    type: 'trojan',
    name: decodeName(url.hash.slice(1)),
    server: url.hostname,
    port: parseInt(url.port, 10),
    password: decodeURIComponent(url.username),
    network: params.get('type') || 'tcp',
    tls: 'tls', // Trojan always uses TLS
  };

  if (params.get('sni')) node.sni = params.get('sni');
  if (params.get('alpn')) node.alpn = params.get('alpn').split(',');
  if (params.get('fp')) node.fingerprint = params.get('fp');
  if (params.get('allowInsecure') === '1') node.skipCertVerify = true;

  // Transport options
  if (node.network === 'ws') {
    if (params.get('path')) node.wsPath = params.get('path');
    if (params.get('host')) node.wsHost = params.get('host');
  } else if (node.network === 'grpc') {
    if (params.get('serviceName')) node.grpcServiceName = params.get('serviceName');
    if (params.get('mode')) node.grpcMode = params.get('mode');
  }

  if (!node.name) node.name = `${node.server}:${node.port}`;
  return node;
}

/** Parse Hysteria2 URI */
function parseHysteria2(uri) {
  const url = new URL(uri);
  const params = url.searchParams;

  const node = {
    type: 'hysteria2',
    name: decodeName(url.hash.slice(1)),
    server: url.hostname,
    port: parseInt(url.port, 10),
    auth: decodeURIComponent(url.username) || '',
    password: decodeURIComponent(url.username) || '', // alias
    tls: 'tls',
  };

  if (params.get('sni')) node.sni = params.get('sni');
  if (params.get('alpn')) node.alpn = params.get('alpn').split(',');
  if (params.get('insecure') === '1') node.skipCertVerify = true;
  if (params.get('up')) node.up = params.get('up');
  if (params.get('down')) node.down = params.get('down');
  if (params.get('obfs')) node.obfs = params.get('obfs');
  if (params.get('obfs-password')) node.obfsPassword = params.get('obfs-password');

  if (!node.name) node.name = `${node.server}:${node.port}`;
  return node;
}

/** Parse TUIC URI */
function parseTUIC(uri) {
  const url = new URL(uri);
  const params = url.searchParams;

  const node = {
    type: 'tuic',
    name: decodeName(url.hash.slice(1)),
    server: url.hostname,
    port: parseInt(url.port, 10),
    uuid: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    tls: 'tls',
  };

  if (params.get('sni')) node.sni = params.get('sni');
  if (params.get('alpn')) node.alpn = params.get('alpn').split(',');
  if (params.get('congestion_control')) node.congestionControl = params.get('congestion_control');
  if (params.get('udp_relay_mode')) node.udpRelayMode = params.get('udp_relay_mode');
  if (params.get('allowInsecure') === '1') node.skipCertVerify = true;

  if (!node.name) node.name = `${node.server}:${node.port}`;
  return node;
}
