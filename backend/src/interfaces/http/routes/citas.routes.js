'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/CitasController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { validarCreacionCita, validarReagendamiento, validarCambioEstado } = require('../middlewares/validarCita');

// RN-025: todas las rutas requieren token. La visibilidad por rol se aplica
// dentro del controlador (admin ve todas; médico y paciente solo las suyas).
router.use(authMiddleware);

// Rutas literales antes de '/:id'.
router.get('/mis-pacientes', roleMiddleware('medico'), ctrl.misPacientes);

router.get('/', ctrl.listar);
router.post('/', roleMiddleware('paciente', 'admin'), validarCreacionCita, ctrl.crear);

router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/historial', ctrl.historial);
router.get('/:id/propuestas', ctrl.propuestasReagendamiento);

// RN-080: confirmar solo desde pendiente/reagendada.
router.put('/:id/confirmar', ctrl.confirmar);
// Cambio de estado: cancelar (dueño/médico/admin) o asistencia (médico/admin).
router.put('/:id/estado', validarCambioEstado, ctrl.cambiarEstado);
// Reagendar con una fecha nueva (RN-084).
router.put('/:id', validarReagendamiento, ctrl.reagendar);
// RN-087: DELETE nunca borra; cancela la cita.
router.delete('/:id', ctrl.eliminar);

module.exports = router;
