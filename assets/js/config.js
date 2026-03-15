// ─── Configuração da API ──────────────────────────────────────────────────────
// Troque pela URL do seu backend no Render após o deploy
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : 'https://enem-speedrun-backend.onrender.com'; // ← Altere após deploy no Render

// ─── Helper para requisições autenticadas ────────────────────────────────────
async function apiRequest(path, options = {}, _isRetry = false) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  // Token expirado: tenta renovar automaticamente (uma única vez)
  if (res.status === 401 && !_isRetry) {
    const isGuest = localStorage.getItem('isGuest') === 'true';
    const refreshed = await refreshSession();
    
    if (refreshed) return apiRequest(path, options, true); // retry com novo token
    
    // Se não for visitante e não conseguiu renovar, redireciona para login
    if (!isGuest) {
      logout();
    }
    return;
  }

  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ─── Renova o token usando o refresh token ────────────────────────────────────
async function refreshSession() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function getToken() {
  return localStorage.getItem('token');
}

function isLoggedIn() {
  return !!getToken() && !!getUser();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('isGuest');
  window.location.href = '/index.html';
}

// ─── Formata tempo (segundos → mm:ss) ────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Categorias ───────────────────────────────────────────────────────────────
const CATEGORY_LABELS = {
  humanas: 'Humanas', exatas: 'Exatas', completa: 'Prova Completa',
};
