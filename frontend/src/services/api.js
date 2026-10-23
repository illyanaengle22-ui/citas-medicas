const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class ApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  // Si no se pasa token explícito se usa el de la sesión. Así las páginas
  // nuevas no tienen que recordar adjuntarlo en cada llamada.
  const jwt = token ?? obtenerToken();
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Solo redirigir cuando falla una petición autenticada. Un 401 en el
  // login es "credenciales inválidas" y debe mostrarse en el formulario,
  // no recargar la página como si la sesión hubiera expirado.
  const esRutaAuth = path === '/api/auth/login' || path === '/api/auth/registrar';
  if (res.status === 401 && token && !esRutaAuth) {
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

// Construye una query string ignorando valores vacíos/undefined/null.
// Uso: const qs = construirQuery({ estado, page });  →  "estado=pendiente&page=2"
export function construirQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    search.set(clave, String(valor));
  });
  const texto = search.toString();
  return texto ? `?${texto}` : '';
}

export { apiFetch, ApiError };
