/**
 * SubConvert Frontend
 * Handles form submission, link management, and UI interactions.
 */

const API = {
  convert: '/api/convert',
  links: '/api/links',
};

const FORMAT_LABELS = {
  clash: 'Clash',
  singbox: 'Sing-Box',
  base64: 'Base64',
  plain: 'Plain',
};

// ─── DOM Helpers ──────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Toast Notifications ──────────────────────────────────

function toast(message, type = 'info', title = '') {
  const container = $('#toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const titles = { success: '成功', error: '错误', warning: '警告', info: '提示' };

  el.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <strong>${title || titles[type] || titles.info}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(el);

  const remove = () => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 200);
  };

  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 4000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── API Calls ────────────────────────────────────────────

async function apiCreateLink(data) {
  const resp = await fetch(API.convert, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function apiListLinks() {
  const resp = await fetch(API.links);
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || 'Failed to load links');
  return json.links || [];
}

async function apiDeleteLink(path) {
  const resp = await fetch(`${API.links}?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || 'Delete failed');
  return json;
}

// ─── UI Actions ───────────────────────────────────────────

function setLoading(loading) {
  const btn = $('#btnSubmit');
  btn.disabled = loading;
  btn.querySelector('.btn-text').hidden = loading;
  btn.querySelector('.btn-loading').hidden = !loading;
}

async function handleSubmit(e) {
  e.preventDefault();

  const sourceUrl = $('#sourceUrl').value.trim();
  const targetFormat = $('#targetFormat').value;
  const customPath = $('#customPath').value.trim();
  const name = $('#name').value.trim();

  if (!sourceUrl) {
    toast('请输入源订阅 URL', 'error');
    return;
  }

  setLoading(true);
  try {
    const result = await apiCreateLink({ sourceUrl, targetFormat, customPath, name });
    toast(`转换链接已创建：${result.subscriptionUrl}`, 'success');

    // Reset form
    $('#convertForm').reset();

    // Refresh links
    await loadLinks();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadLinks() {
  try {
    const links = await apiListLinks();
    renderLinks(links);
  } catch (err) {
    toast('加载链接列表失败：' + err.message, 'error');
  }
}

function renderLinks(links) {
  const tbody = $('#linksBody');
  const table = $('#linksTable');
  const empty = $('#emptyState');
  const countEl = $('#linkCount');

  countEl.textContent = `共 ${links.length} 条链接`;

  if (links.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }

  table.hidden = false;
  empty.hidden = true;
  tbody.innerHTML = '';

  for (const link of links) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="cell-name">${escapeHtml(link.name || '未命名')}</div>
        <div class="cell-path">/sub/${escapeHtml(link.customPath)}</div>
      </td>
      <td class="cell-url" title="${escapeHtml(link.sourceUrl)}">${escapeHtml(link.sourceUrl)}</td>
      <td><span class="cell-format">${FORMAT_LABELS[link.targetFormat] || link.targetFormat}</span></td>
      <td>
        <div class="cell-sub-url">
          <code title="${escapeHtml(link.subscriptionUrl)}">${escapeHtml(link.subscriptionUrl)}</code>
        </div>
      </td>
      <td>${link.accessCount || 0}</td>
      <td>${formatDate(link.createdAt)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn-icon" data-action="copy" data-url="${escapeHtml(link.subscriptionUrl)}" title="复制订阅链接">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="btn-icon" data-action="open" data-url="${escapeHtml(link.subscriptionUrl)}" title="在新标签页打开">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button class="btn-icon btn-danger" data-action="delete" data-path="${escapeHtml(link.customPath)}" data-name="${escapeHtml(link.name || link.customPath)}" title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Bind action buttons
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });
}

async function handleAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;

  if (action === 'copy') {
    const url = btn.dataset.url;
    try {
      await navigator.clipboard.writeText(url);
      toast('订阅链接已复制到剪贴板', 'success');
    } catch {
      // Fallback for non-HTTPS
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      toast('订阅链接已复制', 'success');
    }
  } else if (action === 'open') {
    window.open(btn.dataset.url, '_blank');
  } else if (action === 'delete') {
    const path = btn.dataset.path;
    const name = btn.dataset.name;

    if (!confirm(`确定删除链接「${name}」吗？此操作不可恢复。`)) return;

    btn.disabled = true;
    try {
      await apiDeleteLink(path);
      toast('链接已删除', 'success');
      await loadLinks();
    } catch (err) {
      toast('删除失败：' + err.message, 'error');
      btn.disabled = false;
    }
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now - d;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

// ─── Init ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  $('#convertForm').addEventListener('submit', handleSubmit);
  $('#btnRefresh').addEventListener('click', loadLinks);
  loadLinks();
});
