'use strict';

const {
  PostgresMedicoRepository,
  DuplicadoEmailError,
  DuplicadoCedulaError,
  CitasPendientesError,
  EspecialidadInvalidaError,
  ConsultorioInvalidoError,
} = require('../../../infrastructure/adapters/PostgresMedicoRepository');

const RegistrarMedico = require('../../../application/use-cases/RegistrarMedico');
const {
  ListarMedicos,
  ObtenerMedicoPorId,
  ActualizarMedico,
  CambiarEstadoMedico,
  ReemplazarEspecialidadesMedico,
  ReemplazarConsultoriosMedico,
  EliminarMedico,
} = require('../../../application/use-cases/MedicoUseCases');

const validarId = require('../utils/validarId');

const repo = new PostgresMedicoRepository();

// ── Helpers de rol ─────────────────────────────────────────────────────────
const rolesValidos = { 1: 'admin', 2: 'medico', 3: 'paciente' };
function rolClave(usuario) { return rolesValidos[usuario?.rol_id] || null; }
function esAdmin(usuario)  { return rolClave(usuario) === 'admin'; }

// ── Validaciones de input ──────────────────────────────────────────────────
// Teléfono: quita guiones, espacios y paréntesis; 7-15 dígitos; vacío → null
function validarTelefono(telefono) {
  if (telefono === undefined || telefono === null || telefono === '') return null;
  const soloDigitos = String(telefono).replace(/[\s\-()]/g, '');
  if (soloDigitos === '') return null;
  if (!/^[0-9]{7,15}$/.test(soloDigitos)) {
    return 'El teléfono debe tener entre 7 y 15 dígitos numéricos';
  }
  return null; // válido
}

// Nombre: requerido, string no vacío
function validarNombre(nombre, campo = 'nombre') {
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return `El campo "${campo}" es requerido`;
  }
  return null;
}

// Array de IDs de una relación: debe ser array de enteros positivos
function validarArrayIds(arr, tipo, campo) {
  if (!Array.isArray(arr)) return `"${campo}" debe ser un arreglo`;
  for (const id of arr) {
    const n = validarId(id, tipo);
    if (!n) return `ID inválido en "${campo}": ${id}`;
  }
  return null;
}

// Errores PG que son de datos (400)
function esErrorDeDatos(error) {
  return error.code === '22003' || error.code === '22P02';
}

function respuestaError500(res, mensaje, error) {
  if (esErrorDeDatos(error)) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }
  console.error('[Medicos] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

// ── Serialización según rol (RN-046) ──────────────────────────────────────
function serializar(medico, admin) {
  return admin ? medico.toPublicDTO() : medico.toPublicDTOReducido();
}

// ── listar ─────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const admin = esAdmin(req.usuario);

    // ?todos=true solo para admin
    const incluirInactivos = req.query.todos === 'true' && admin;

    // RN-044: no-admin solo ve médicos con ≥1 especialidad activa
    const soloConEspecialidad = !admin;

    // Filtros
    // Las tools de n8n envían el literal 'null'/'undefined' cuando $fromAI
    // no recibió el parámetro: se trata como "sin filtro", no como ID
    // inválido (RN de chatbot; evita 400 espurios).
    const esSinFiltro = (valor) => {
      const texto = String(valor ?? '').trim().toLowerCase();
      return texto === '' || texto === 'null' || texto === 'undefined';
    };

    let especialidadId = null;
    if (req.query.especialidad && !esSinFiltro(req.query.especialidad)) {
      especialidadId = validarId(req.query.especialidad, 'smallint');
      if (!especialidadId) return res.status(400).json({ ok: false, mensaje: 'ID de especialidad inválido' });
    }

    let consultorioId = null;
    if (req.query.consultorio && !esSinFiltro(req.query.consultorio)) {
      consultorioId = validarId(req.query.consultorio, 'bigint');
      if (!consultorioId) return res.status(400).json({ ok: false, mensaje: 'ID de consultorio inválido' });
    }

    const caso = new ListarMedicos(repo);
    const medicos = await caso.execute({
      incluirInactivos, soloConEspecialidad,
      especialidadId, consultorioId,
      q: req.query.q || null,
    });

    return res.json({
      ok: true,
      mensaje: 'Lista de médicos',
      data: medicos.map(m => serializar(m, admin)),
    });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener médicos', error);
  }
}

// ── obtenerPorId ───────────────────────────────────────────────────────────
async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const admin = esAdmin(req.usuario);
    const caso = new ObtenerMedicoPorId(repo);
    const medico = await caso.execute(id);

    if (!medico) return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });

    return res.json({ ok: true, mensaje: 'Médico encontrado', data: serializar(medico, admin) });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener médico', error);
  }
}

// ── crear (admin) — RN-042 ─────────────────────────────────────────────────
async function crear(req, res) {
  try {
    const { nombre, email, password, cedula_profesional, telefono,
            especialidades = [], consultorios = [] } = req.body || {};

    // Validaciones obligatorias
    const errNombre = validarNombre(nombre);
    if (errNombre) return res.status(400).json({ ok: false, mensaje: errNombre });

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'El campo "email" es requerido' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!cedula_profesional || typeof cedula_profesional !== 'string' || !cedula_profesional.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'El campo "cedula_profesional" es requerido' });
    }

    const errTel = validarTelefono(telefono);
    if (errTel) return res.status(400).json({ ok: false, mensaje: errTel });

    // Validar arrays de ids
    const errEsp = validarArrayIds(especialidades, 'smallint', 'especialidades');
    if (errEsp) return res.status(400).json({ ok: false, mensaje: errEsp });

    const errCon = validarArrayIds(consultorios, 'bigint', 'consultorios');
    if (errCon) return res.status(400).json({ ok: false, mensaje: errCon });

    const caso = new RegistrarMedico(repo);
    const medico = await caso.execute({
      nombre, email, password, cedula_profesional, telefono,
      especialidades, consultorios,
    });

    return res.status(201).json({ ok: true, mensaje: 'Médico creado correctamente', data: medico.toPublicDTO() });
  } catch (error) {
    if (error instanceof DuplicadoEmailError)  return res.status(409).json({ ok: false, mensaje: error.message });
    if (error instanceof DuplicadoCedulaError) return res.status(409).json({ ok: false, mensaje: error.message });
    if (error instanceof EspecialidadInvalidaError) return res.status(400).json({ ok: false, mensaje: error.message });
    if (error instanceof ConsultorioInvalidoError)  return res.status(400).json({ ok: false, mensaje: error.message });
    return respuestaError500(res, 'Error al crear médico', error);
  }
}

// ── actualizar (admin) ─────────────────────────────────────────────────────
async function actualizar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const { nombre, email, cedula_profesional, telefono, password } = req.body || {};

    // Al menos un campo debe venir
    if (nombre === undefined && email === undefined && cedula_profesional === undefined &&
        telefono === undefined && password === undefined) {
      return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar' });
    }

    if (nombre !== undefined) {
      const err = validarNombre(nombre);
      if (err) return res.status(400).json({ ok: false, mensaje: err });
    }

    if (password !== undefined && password !== '' && password.length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (telefono !== undefined) {
      const errTel = validarTelefono(telefono);
      if (errTel) return res.status(400).json({ ok: false, mensaje: errTel });
    }

    const caso = new ActualizarMedico(repo);
    const medico = await caso.execute(id, { nombre, email, cedula_profesional, telefono, password });

    if (!medico) return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });

    return res.json({ ok: true, mensaje: 'Médico actualizado correctamente', data: medico.toPublicDTO() });
  } catch (error) {
    if (error instanceof DuplicadoEmailError)  return res.status(409).json({ ok: false, mensaje: error.message });
    if (error instanceof DuplicadoCedulaError) return res.status(409).json({ ok: false, mensaje: error.message });
    return respuestaError500(res, 'Error al actualizar médico', error);
  }
}

// ── cambiarEstado (admin) ─────────────────────────────────────────────────
async function cambiarEstado(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const { activo } = req.body || {};
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
    }

    const caso = new CambiarEstadoMedico(repo);
    const medico = await caso.execute(id, activo);

    if (!medico) return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });

    return res.json({
      ok: true,
      mensaje: activo ? 'Médico activado' : 'Médico desactivado',
      data: medico.toPublicDTO(),
    });
  } catch (error) {
    return respuestaError500(res, 'Error al cambiar estado del médico', error);
  }
}

// ── reemplazarEspecialidades (admin) ──────────────────────────────────────
async function reemplazarEspecialidades(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const { especialidades } = req.body || {};
    const err = validarArrayIds(especialidades ?? [], 'smallint', 'especialidades');
    if (err) return res.status(400).json({ ok: false, mensaje: err });

    const caso = new ReemplazarEspecialidadesMedico(repo);
    const medico = await caso.execute(id, especialidades ?? []);

    if (!medico) return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });

    return res.json({ ok: true, mensaje: 'Especialidades actualizadas', data: medico.toPublicDTO() });
  } catch (error) {
    if (error instanceof EspecialidadInvalidaError) return res.status(400).json({ ok: false, mensaje: error.message });
    return respuestaError500(res, 'Error al actualizar especialidades', error);
  }
}

// ── reemplazarConsultorios (admin) ────────────────────────────────────────
async function reemplazarConsultorios(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const { consultorios } = req.body || {};
    const err = validarArrayIds(consultorios ?? [], 'bigint', 'consultorios');
    if (err) return res.status(400).json({ ok: false, mensaje: err });

    const caso = new ReemplazarConsultoriosMedico(repo);
    const medico = await caso.execute(id, consultorios ?? []);

    if (!medico) return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });

    return res.json({ ok: true, mensaje: 'Consultorios actualizados', data: medico.toPublicDTO() });
  } catch (error) {
    if (error instanceof ConsultorioInvalidoError) return res.status(400).json({ ok: false, mensaje: error.message });
    return respuestaError500(res, 'Error al actualizar consultorios', error);
  }
}

// ── eliminar (admin) — RN-045 ──────────────────────────────────────────────
async function eliminar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const caso = new EliminarMedico(repo);
    const resultado = await caso.execute(id);

    if (!resultado) return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });

    return res.json({ ok: true, mensaje: 'Médico eliminado correctamente', data: resultado });
  } catch (error) {
    if (error instanceof CitasPendientesError) return res.status(409).json({ ok: false, mensaje: error.message });
    return respuestaError500(res, 'Error al eliminar médico', error);
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  reemplazarEspecialidades,
  reemplazarConsultorios,
  eliminar,
};
