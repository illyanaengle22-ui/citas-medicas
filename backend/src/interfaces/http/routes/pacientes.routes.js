'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/PacientesController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/', roleMiddleware('admin'), ctrl.listar);
// RN-053: admin o el propio paciente. El acceso de médicos a "sus pacientes"
// se definirá cuando exista la relación mediante citas.
router.get('/:id', roleMiddleware('admin', 'paciente'), ctrl.obtenerPorId);
router.post('/', roleMiddleware('admin'), ctrl.crear);
router.put('/:id', roleMiddleware('admin'), ctrl.actualizar);
router.delete('/:id', roleMiddleware('admin'), ctrl.eliminar);

module.exports = router;
