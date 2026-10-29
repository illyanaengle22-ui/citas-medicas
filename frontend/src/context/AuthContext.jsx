import { createContext, useContext, useState, useCallback } from 'react';
import { login as loginService, registrar as registrarService, limpiarSesion, obtenerToken, obtenerUsuario } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(obtenerToken());
  const [user, setUser] = useState(obtenerUsuario());

  const login = useCallback(async (email, password, captchaId, captchaTexto) => {
    const usuario = await loginService(email, password, captchaId, captchaTexto);
    setToken(obtenerToken());
    setUser(usuario);
    return usuario;
  }, []);

  const registrar = useCallback(async (nombre, email, password, captchaId, captchaTexto) => {
    const usuario = await registrarService(nombre, email, password, captchaId, captchaTexto);
    // Registro no genera token ni sesión (cuenta queda pendiente de aprobación).
    setToken(null);
    setUser(null);
    return usuario;
  }, []);

  const logout = useCallback(() => {
    limpiarSesion();
    setToken(null);
    setUser(null);
  }, []);

  const actualizarUsuario = useCallback((cambios) => {
    setUser((prev) => {
      const actualizado = { ...prev, ...cambios };
      localStorage.setItem('user', JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  const redirectPorRol = useCallback((usuario) => {
    if (!usuario) return '/login';
    switch (usuario.rol_id) {
      case 1: return '/admin';
      case 2: return '/medico';
      case 3: return '/paciente';
      default: return '/login';
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, registrar, logout, actualizarUsuario, redirectPorRol }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
