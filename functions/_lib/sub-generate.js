/**
 * Generate subscription content in various formats from unified node arrays.
 *
 * Supported output formats:
 * - base64: Base64-encoded list of proxy URIs (v2ray format)
 * - clash: Clash/Mihomo YAML config
 * - singbox: Sing-box JSON config
 * - plain: Plain text list of proxy URIs
 */

import yaml from './vendor/js-yaml.mjs';
import { generateURI } from './uri-generate.js';
import { b64Encode } from './utils.js';

/** Supported output format identifiers */
export const FORMATS = {
  CLASH: 'clash',
  SINGBOX: 'singbox',
  BASE64: 'base64',
  PLAIN: 'plain',
};

/** Format display names */
export const FORMAT_NAMES = {
  clash: 'Clash / Mihomo',
  singbox: 'Sing-Box',
  base64: 'V2Ray (Base64)',
  plain: 'Plain Text',
};

/**
 * Generate subscription content in the specified format.
 * @param {Array} nodes - Array of unified node objects
 * @param {string} format - Output format
 * @param {object} options - Additional options (name, etc.)
 * @returns {{content: string, contentType: string}}
 */
export function generateSubscription(nodes, format, options = {}) {
  const validNodes = (nodes || []).filter(n => n && n.type);

  switch (format) {
    case 'clash':
      return { content: genClash(validNodes, options), contentType: 'text/yaml; charset=utf-8' };
    case 'singbox':
      return { content: genSingbox(validNodes, options), contentType: 'application/json; charset=utf-8' };
    case 'base64':
      return { content: genBase64(validNodes), contentType: 'text/plain; charset=utf-8' };
    case 'plain':
      return { content: genPlain(validNodes), contentType: 'text/plain; charset=utf-8' };
    default:
      return { content: genBase64(validNodes), contentType: 'text/plain; charset=utf-8' };
  }
}

/** Generate base64-encoded subscription (v2ray format) */
function genBase64(nodes) {
  const uris = genPlain(nodes);
  return b64Encode(uris);
}

/** Generate plain text URI list */
function genPlain(nodes) {
  return nodes.map(n => generateURI(n)).filter(Boolean).join('\n');
}

/** Generate Clash/Mihomo YAML config */
function genClash(nodes, options = {}) {
  const proxies = nodes.map(nodeToClashProxy).filter(Boolean);
  const proxyNames = proxies.map(p => p.name);

  const config = {
    'proxies': proxies,
    'proxy-groups': [
      {
        name: '🚀 节点选择',
        type: 'select',
        proxies: ['♻️ 自动选择', ...proxyNames],
      },
      {
        name: '♻️ 自动选择',
        type: 'url-test',
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50,
        proxies: proxyNames,
      },
      {
        name: '🐟 漏网之鱼',
        type: 'select',
        proxies: ['🚀 节点选择', 'DIRECT', ...proxyNames],
      },
    ],
    'rules': [
      'GEOIP,PRIVATE,DIRECT,no-resolve',
      'GEOIP,CN,DIRECT',
      'MATCH,🐟 漏网之鱼',
    ],
  };

  // Add rule-providers and other common config
  const header = {
    'port': 7890,
    'socks-port': 7891,
    'allow-lan': false,
    'mode': 'rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    'dns': {
      'enable': true,
      'ipv6': false,
      'enhanced-mode': 'fake-ip',
      'nameserver': ['223.5.5.5', '119.29.29.29'],
      'fallback': ['8.8.8.8', '1.1.1.1'],
    },
  };

  const fullConfig = { ...header, ...config };
  return yaml.dump(fullConfig, { lineWidth: -1, quotingType: '"' });
}

/** Convert a unified node to Clash proxy format */
function nodeToClashProxy(n) {
  if (!n || !n.type) return null;

  const base = {
    name: n.name,
    type: n.type,
    server: n.server,
    port: n.port,
    udp: true,
  };

  const addTLS = (obj) => {
    if (n.tls === 'tls') {
      obj.tls = true;
      if (n.sni) obj.servername = n.sni;
      if (n.skipCertVerify) obj['skip-cert-verify'] = true;
      if (n.alpn) obj.alpn = n.alpn;
      if (n.fingerprint) obj['client-fingerprint'] = n.fingerprint;
    } else if (n.tls === 'reality') {
      obj.tls = true;
      if (n.sni) obj.servername = n.sni;
      if (n.fingerprint) obj['client-fingerprint'] = n.fingerprint;
      obj['reality-opts'] = {};
      if (n.realityPublicKey) obj['reality-opts']['public-key'] = n.realityPublicKey;
      if (n.realityShortId) obj['reality-opts']['short-id'] = n.realityShortId;
    }
  };

  const addTransport = (obj) => {
    if (n.network && n.network !== 'tcp') {
      obj.network = n.network;
      if (n.network === 'ws') {
        obj['ws-opts'] = {};
        if (n.wsPath) obj['ws-opts'].path = n.wsPath;
        if (n.wsHost) obj['ws-opts'].headers = { Host: n.wsHost };
      } else if (n.network === 'grpc') {
        obj['grpc-opts'] = {};
        if (n.grpcServiceName) obj['grpc-opts']['grpc-service-name'] = n.grpcServiceName;
        if (n.grpcMode) obj['grpc-opts']['grpc-mode'] = n.grpcMode;
      } else if (n.network === 'h2') {
        obj['h2-opts'] = {};
        if (n.h2Host) obj['h2-opts'].host = n.h2Host;
        if (n.h2Path) obj['h2-opts'].path = n.h2Path;
      }
    }
  };

  switch (n.type) {
    case 'ss':
      return {
        ...base,
        cipher: n.cipher,
        password: n.password,
      };

    case 'vmess':
      addTLS(base);
      addTransport(base);
      return {
        ...base,
        uuid: n.uuid,
        alterId: n.alterId || 0,
        cipher: n.cipher || 'auto',
      };

    case 'vless':
      addTLS(base);
      addTransport(base);
      const vless = {
        ...base,
        uuid: n.uuid,
      };
      if (n.flow) vless.flow = n.flow;
      return vless;

    case 'trojan':
      addTLS(base);
      addTransport(base);
      return {
        ...base,
        password: n.password,
        sni: n.sni,
      };

    case 'hysteria2':
      return {
        ...base,
        password: n.auth || n.password,
        sni: n.sni,
        'skip-cert-verify': n.skipCertVerify || false,
        up: n.up || '50 Mbps',
        down: n.down || '200 Mbps',
        ...(n.obfs ? { obfs: n.obfs } : {}),
        ...(n.obfsPassword ? { 'obfs-password': n.obfsPassword } : {}),
      };

    case 'tuic':
      return {
        ...base,
        uuid: n.uuid,
        password: n.password,
        sni: n.sni,
        'skip-cert-verify': n.skipCertVerify || false,
        'congestion-controller': n.congestionControl || 'bbr',
        'udp-relay-mode': n.udpRelayMode || 'native',
        ...(n.alpn ? { alpn: n.alpn } : {}),
      };

    default:
      return null;
  }
}

/** Generate Sing-box JSON config */
function genSingbox(nodes, options = {}) {
  const outbounds = nodes.map(nodeToSingboxOutbound).filter(Boolean);
  const tags = outbounds.map(o => o.tag);

  const config = {
    log: { level: 'info' },
    dns: {
      servers: [
        { tag: 'google', address: 'tls://8.8.8.8' },
        { tag: 'local', address: '223.5.5.5', detour: 'direct' },
      ],
      rules: [
        { outbound: 'any', server: 'local' },
        { clash_mode: 'global', server: 'google' },
        { clash_mode: 'direct', server: 'local' },
      ],
    },
    inbounds: [
      {
        type: 'mixed',
        tag: 'mixed-in',
        listen: '127.0.0.1',
        listen_port: 7890,
      },
    ],
    outbounds: [
      ...outbounds,
      {
        type: 'selector',
        tag: '🚀 节点选择',
        outbounds: ['♻️ 自动选择', ...tags],
        default: tags[0] || 'direct',
      },
      {
        type: 'urltest',
        tag: '♻️ 自动选择',
        outbounds: tags,
        url: 'https://www.gstatic.com/generate_204',
        interval: '5m',
      },
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
    ],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { ip_is_private: true, outbound: 'direct' },
        { clash_mode: 'direct', outbound: 'direct' },
        { clash_mode: 'global', outbound: '🚀 节点选择' },
      ],
      final: '🚀 节点选择',
      auto_detect_interface: true,
    },
  };

  return JSON.stringify(config, null, 2);
}

/** Convert a unified node to Sing-box outbound format */
function nodeToSingboxOutbound(n) {
  if (!n || !n.type) return null;

  const base = {
    type: n.type === 'ss' ? 'shadowsocks' : n.type,
    tag: n.name,
    server: n.server,
    server_port: n.port,
  };

  const addTLS = (obj) => {
    if (n.tls === 'tls' || n.tls === 'reality') {
      obj.tls = { enabled: true };
      if (n.sni) obj.tls.server_name = n.sni;
      if (n.skipCertVerify) obj.tls.insecure = true;
      if (n.alpn) obj.tls.alpn = n.alpn;
      if (n.fingerprint) {
        obj.tls.utls = { enabled: true, fingerprint: n.fingerprint };
      }
      if (n.tls === 'reality') {
        obj.tls.reality = { enabled: true };
        if (n.realityPublicKey) obj.tls.reality.public_key = n.realityPublicKey;
        if (n.realityShortId) obj.tls.reality.short_id = n.realityShortId;
      }
    }
  };

  const addTransport = (obj) => {
    if (n.network && n.network !== 'tcp') {
      obj.transport = { type: n.network };
      if (n.network === 'ws') {
        if (n.wsPath) obj.transport.path = n.wsPath;
        if (n.wsHost) obj.transport.headers = { Host: n.wsHost };
      } else if (n.network === 'grpc') {
        if (n.grpcServiceName) obj.transport.service_name = n.grpcServiceName;
        if (n.grpcMode) obj.transport.mode = n.grpcMode || 'gun';
      } else if (n.network === 'h2') {
        if (n.h2Host) obj.transport.host = n.h2Host;
        if (n.h2Path) obj.transport.path = n.h2Path;
      }
    }
  };

  switch (n.type) {
    case 'ss':
      return {
        type: 'shadowsocks',
        tag: n.name,
        server: n.server,
        server_port: n.port,
        method: n.cipher,
        password: n.password,
      };

    case 'vmess':
      addTLS(base);
      addTransport(base);
      return {
        ...base,
        uuid: n.uuid,
        alter_id: n.alterId || 0,
        security: n.cipher || 'auto',
      };

    case 'vless':
      addTLS(base);
      addTransport(base);
      const vless = {
        ...base,
        uuid: n.uuid,
      };
      if (n.flow) vless.flow = n.flow;
      return vless;

    case 'trojan':
      addTLS(base);
      addTransport(base);
      return {
        ...base,
        password: n.password,
      };

    case 'hysteria2':
      addTLS(base);
      const hy2 = {
        ...base,
        password: n.auth || n.password,
      };
      if (n.up_mbps) hy2.up_mbps = n.up_mbps;
      if (n.down_mbps) hy2.down_mbps = n.down_mbps;
      return hy2;

    case 'tuic':
      addTLS(base);
      const tuic = {
        ...base,
        uuid: n.uuid,
        password: n.password,
      };
      if (n.congestionControl) tuic.congestion_control = n.congestionControl;
      if (n.udpRelayMode) tuic.udp_relay_mode = n.udpRelayMode;
      return tuic;

    default:
      return null;
  }
}
