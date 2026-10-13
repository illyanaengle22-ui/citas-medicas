const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class ApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new ApiError('Sesión expirada', 401);
  }

  const json = await res.json();

  if (!json.ok) {
    throw new ApiError(json.mensaje || 'Error desconocido', res.status);
  }

  return json.data;
}

export function obtenerToken() {
  return localStorage.getItem('token');
}

export function obtenerUsuario() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function guardarSesion(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function limpiarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function login(email, password, captchaId, captchaTexto) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password, captchaId, captchaTexto },
  });
  guardarSesion(data.token, data.usuario);
  return data.usuario;
}

export async function registrar(nombre, email, password, captchaId, captchaTexto) {
  const data = await apiFetch('/api/auth/registrar', {
    method: 'POST',
    body: { nombre, email, password, captchaId, captchaTexto },
  });
  guardarSesion(data.token, data.usuario);
  return data.usuario;
}

export async function obtenerCaptcha() {
  return apiFetch('/api/captcha');
}

export { apiFetch, ApiError };
