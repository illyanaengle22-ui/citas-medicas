"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/infrastructure/db.js
var require_db = __commonJS({
  "src/infrastructure/db.js"(exports2, module2) {
    "use strict";
    var path2 = require("path");
    var fs2 = require("fs");
    require("dotenv").config({ path: path2.join(__dirname, "..", ".env") });
    var { Pool } = require("pg");
    var instance = null;
    function resolverHost() {
      const host = process.env.DB_HOST;
      if (host !== "windows") return host || "localhost";
      try {
        const { execSync } = require("child_process");
        const route = execSync("ip route | grep default | awk '{print $3}'").toString().trim();
        if (route) {
          console.log("[DB] Host Windows resuelto (ip route):", route);
          return route;
        }
      } catch (err) {
        console.warn("[DB] ip route fall\xF3:", err.message);
      }
      try {
        const resolv = fs2.readFileSync("/etc/resolv.conf", "utf8");
        const match = resolv.match(/nameserver\s+([\d.]+)/);
        if (match) {
          console.log("[DB] Host Windows resuelto (resolv.conf):", match[1]);
          return match[1];
        }
      } catch (err) {
        console.warn("[DB] resolv.conf fall\xF3:", err.message);
      }
      return "localhost";
    }
    var Database = class {
      constructor() {
        if (instance) return instance;
        this.pool = new Pool({
          host: resolverHost(),
          port: parseInt(process.env.DB_PORT, 10) || 5432,
          user: process.env.DB_USER || "postgres",
          password: process.env.DB_PASSWORD || "postgres",
          database: process.env.DB_NAME || "nomina5M",
          max: 10,
          idleTimeoutMillis: 3e4,
          connectionTimeoutMillis: 5e3
        });
        this.pool.on("error", (err) => console.error("[DB] Error:", err.message));
        instance = this;
      }
      async query(text, params) {
        const res = await this.pool.query(text, params);
        return res;
      }
      async getClient() {
        return this.pool.connect();
      }
      async ping() {
        const { rows } = await this.query("SELECT NOW() AS now");
        return rows[0].now;
      }
      async close() {
        await this.pool.end();
        instance = null;
      }
    };
    module2.exports = new Database();
    if (require.main === module2 && process.argv.includes("--test")) {
      (async () => {
        const db = module2.exports;
        try {
          console.log("[TEST] Conectando a PostgreSQL...");
          const now = await db.ping();
          console.log("[TEST] \u2705 Conexi\xF3n OK. Hora:", now);
          await db.close();
          process.exit(0);
        } catch (err) {
          console.error("[TEST] \u274C Fall\xF3:", err.message);
          process.exit(1);
        }
      })();
    }
  }
});

// src/interfaces/http/controllers/CaptchaController.js
var require_CaptchaController = __commonJS({
  "src/interfaces/http/controllers/CaptchaController.js"(exports2, module2) {
    "use strict";
    var svgCaptcha = require("svg-captcha");
    var crypto = require("crypto");
    var CAPTCHA_EXPIRATION_MS = 2 * 60 * 1e3;
    var captchas = /* @__PURE__ */ new Map();
    setInterval(() => {
      const ahora = Date.now();
      for (const [id, data] of captchas.entries()) {
        if (data.expiraEn < ahora) {
          captchas.delete(id);
        }
      }
    }, 60 * 1e3).unref();
    function generarCaptcha(req, res) {
      const captcha = svgCaptcha.create({
        size: 5,
        noise: 2,
        color: true,
        background: "#f0f0f0"
      });
      const captchaId = crypto.randomUUID();
      captchas.set(captchaId, {
        texto: captcha.text.toLowerCase(),
        expiraEn: Date.now() + CAPTCHA_EXPIRATION_MS
      });
      res.json({
        ok: true,
        mensaje: "Captcha generado",
        data: {
          captchaId,
          svg: captcha.data
        }
      });
    }
    function validarCaptcha(captchaId, texto) {
      if (!captchaId || !texto) {
        return { valido: false, mensaje: "captchaId y texto son requeridos" };
      }
      const data = captchas.get(captchaId);
      if (!data) {
        return { valido: false, mensaje: "Captcha no encontrado o expirado" };
      }
      captchas.delete(captchaId);
      if (data.expiraEn < Date.now()) {
        return { valido: false, mensaje: "Captcha expirado" };
      }
      const normalizar = (valor) => String(valor ?? "").toLowerCase().replace(/\s+/g, "");
      if (normalizar(data.texto) !== normalizar(texto)) {
        return { valido: false, mensaje: "Texto del captcha incorrecto" };
      }
      return { valido: true };
    }
    module2.exports = { generarCaptcha, validarCaptcha };
  }
});

// src/infrastructure/config/secrets.js
var require_secrets = __commonJS({
  "src/infrastructure/config/secrets.js"(exports2, module2) {
    "use strict";
    function requerido(nombre) {
      const valor = process.env[nombre];
      if (!valor || !String(valor).trim()) {
        throw new Error(`[Config] Falta la variable de entorno obligatoria ${nombre}`);
      }
      return valor;
    }
    var JWT_SECRET = requerido("JWT_SECRET");
    module2.exports = { JWT_SECRET };
  }
});

// src/interfaces/http/controllers/AuthController.js
var require_AuthController = __commonJS({
  "src/interfaces/http/controllers/AuthController.js"(exports2, module2) {
    "use strict";
    var bcrypt = require("bcryptjs");
    var jwt = require("jsonwebtoken");
    var db = require_db();
    var { validarCaptcha } = require_CaptchaController();
    var { JWT_SECRET } = require_secrets();
    var PERMITIR_CAPTCHA_TEST = process.env.NODE_ENV !== "production" && process.env.ALLOW_TEST_CAPTCHA === "true";
    function validarCaptchaDePeticion(captchaId, captchaTexto) {
      if (PERMITIR_CAPTCHA_TEST && captchaId === "test") return { valido: true };
      return validarCaptcha(captchaId, captchaTexto);
    }
    async function registrar(req, res) {
      const body = req.body || {};
      const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const { captchaId, captchaTexto } = body;
      if (!nombre || !email) {
        return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios (nombre, email, password)" });
      }
      if (password.length < 8) {
        return res.status(400).json({ ok: false, mensaje: "La contrase\xF1a debe tener al menos 8 caracteres" });
      }
      const captchaValidacion = validarCaptchaDePeticion(captchaId, captchaTexto);
      if (!captchaValidacion.valido) {
        return res.status(400).json({ ok: false, mensaje: captchaValidacion.mensaje });
      }
      const client = await db.getClient();
      try {
        await client.query("BEGIN");
        const existe = await client.query(
          "SELECT 1 FROM usuarios WHERE LOWER(TRIM(email)) = $1 AND deleted_at IS NULL",
          [email]
        );
        if (existe.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({ ok: false, mensaje: "El email ya est\xE1 registrado" });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await client.query(
          `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
       VALUES (
         $1, $2, $3,
         (SELECT id FROM roles         WHERE clave = 'paciente'),
         (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')
       )
       RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, created_at`,
          [nombre, email, passwordHash]
        );
        await client.query("COMMIT");
        return res.status(201).json({
          ok: true,
          mensaje: "Registro exitoso. Tu cuenta est\xE1 pendiente de aprobaci\xF3n por un administrador.",
          data: result.rows[0]
        });
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {
        }
        if (error.code === "23505") {
          return res.status(409).json({ ok: false, mensaje: "El email ya est\xE1 registrado" });
        }
        console.error("[Auth] Error en registro:", error.message);
        return res.status(500).json({ ok: false, mensaje: "Error al procesar el registro" });
      } finally {
        client.release();
      }
    }
    async function login(req, res) {
      const body = req.body || {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const { captchaId, captchaTexto } = body;
      if (!email || !password) {
        return res.status(400).json({ ok: false, mensaje: "Faltan email o contrase\xF1a" });
      }
      const captchaValidacion = validarCaptchaDePeticion(captchaId, captchaTexto);
      if (!captchaValidacion.valido) {
        return res.status(400).json({ ok: false, mensaje: captchaValidacion.mensaje });
      }
      try {
        const result = await db.query(
          `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.foto_url,
              u.password_hash, u.rol_id, u.estado_id, u.ultimo_login,
              ec.clave AS estado_clave
       FROM usuarios u
       JOIN estados_cuenta ec ON ec.id = u.estado_id
       WHERE LOWER(TRIM(u.email)) = $1
         AND u.deleted_at IS NULL`,
          [email]
        );
        if (result.rows.length === 0) {
          return res.status(401).json({ ok: false, mensaje: "Credenciales inv\xE1lidas" });
        }
        const user = result.rows[0];
        const passwordValida = await bcrypt.compare(password, user.password_hash);
        if (!passwordValida) {
          return res.status(401).json({ ok: false, mensaje: "Credenciales inv\xE1lidas" });
        }
        if (user.estado_clave !== "activo") {
          const mensajeEstado = user.estado_clave === "pendiente" ? "Tu cuenta est\xE1 pendiente de aprobaci\xF3n" : "Tu cuenta fue rechazada";
          return res.status(403).json({ ok: false, mensaje: mensajeEstado });
        }
        await db.query("UPDATE usuarios SET ultimo_login = now() WHERE id = $1", [user.id]);
        const token = jwt.sign(
          { id: user.id, uuid_publico: user.uuid_publico, email: user.email, rol_id: user.rol_id },
          JWT_SECRET,
          { expiresIn: "2h" }
        );
        return res.json({
          ok: true,
          mensaje: "Login exitoso",
          data: {
            token,
            usuario: {
              id: user.id,
              uuid_publico: user.uuid_publico,
              nombre: user.nombre,
              email: user.email,
              foto_url: user.foto_url,
              rol_id: user.rol_id,
              estado_id: user.estado_id
            }
          }
        });
      } catch (error) {
        console.error("[Auth] Error en login:", error.message);
        return res.status(500).json({ ok: false, mensaje: "Error al procesar el login" });
      }
    }
    module2.exports = { registrar, login };
  }
});

// src/interfaces/http/routes/auth.routes.js
var require_auth_routes = __commonJS({
  "src/interfaces/http/routes/auth.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var { registrar, login } = require_AuthController();
    router.post("/registrar", registrar);
    router.post("/login", login);
    module2.exports = router;
  }
});

// src/interfaces/http/routes/captcha.routes.js
var require_captcha_routes = __commonJS({
  "src/interfaces/http/routes/captcha.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var { generarCaptcha } = require_CaptchaController();
    router.get("/", generarCaptcha);
    module2.exports = router;
  }
});

// src/domain/ports/DashboardRepository.js
var require_DashboardRepository = __commonJS({
  "src/domain/ports/DashboardRepository.js"(exports2, module2) {
    "use strict";
    var DashboardRepository = class {
      async obtenerTotales() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerUsuariosPorRol() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerUsuariosPorEstado() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerRegistrosPorMes() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerMedicosPorEspecialidad() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerMedicosPorConsultorio() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerCitasPorEstado() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerCitasPorDia() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerPorcentajes() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerDuracionPromedio() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerTotalesMedico() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerProximasCitasMedico() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerAgendaHoyMedico() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerCitasSemanaMedico() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerTotalesPaciente() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerProximasCitasPaciente() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerMedicoPrincipalPaciente() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerHistorialCitasPaciente() {
        throw new Error("M\xE9todo no implementado");
      }
    };
    module2.exports = DashboardRepository;
  }
});

// src/infrastructure/adapters/PostgresDashboardRepository.js
var require_PostgresDashboardRepository = __commonJS({
  "src/infrastructure/adapters/PostgresDashboardRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var DashboardRepository = require_DashboardRepository();
    var PostgresDashboardRepository = class extends DashboardRepository {
      async obtenerTotales(fechaInicio, fechaFin) {
        const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM usuarios
          WHERE deleted_at IS NULL) AS usuarios,
        (SELECT COUNT(*)::int
           FROM usuarios u
           JOIN estados_cuenta ec ON ec.id = u.estado_id
          WHERE u.deleted_at IS NULL
            AND ec.clave = 'pendiente') AS pendientes,
        (SELECT COUNT(*)::int
           FROM medicos m
           JOIN usuarios u ON u.id = m.usuario_id
          WHERE m.deleted_at IS NULL
            AND m.activo = TRUE
            AND u.deleted_at IS NULL) AS "medicosActivos",
        (SELECT COUNT(*)::int
           FROM pacientes p
           JOIN usuarios u ON u.id = p.usuario_id
          WHERE p.deleted_at IS NULL
            AND u.deleted_at IS NULL) AS pacientes,
        (SELECT COUNT(*)::int
           FROM consultorios
          WHERE deleted_at IS NULL
            AND activo = TRUE) AS "consultoriosActivos",
        (SELECT COUNT(*)::int
           FROM especialidades
          WHERE activo = TRUE) AS "especialidadesActivas",
        (SELECT COUNT(*)::int
           FROM citas
          WHERE fecha_hora >= CURRENT_DATE
            AND fecha_hora < CURRENT_DATE + INTERVAL '1 day'
            AND fecha_hora >= $1::date
            AND fecha_hora < $2::date + INTERVAL '1 day') AS "citasHoy",
        (SELECT COUNT(*)::int
           FROM citas
          WHERE fecha_hora >= date_trunc('month', now())
            AND fecha_hora < date_trunc('month', now()) + INTERVAL '1 month'
            AND fecha_hora >= $1::date
            AND fecha_hora < $2::date + INTERVAL '1 day') AS "citasMes",
        (SELECT COUNT(*)::int
           FROM citas
          WHERE fecha_hora >= $1::date
            AND fecha_hora < $2::date + INTERVAL '1 day') AS "citasRango"
    `, [fechaInicio, fechaFin]);
        return result.rows[0];
      }
      async obtenerUsuariosPorRol() {
        const result = await db.query(`
      SELECT r.clave AS rol, COUNT(u.id)::int AS total
        FROM roles r
        LEFT JOIN usuarios u
          ON u.rol_id = r.id
         AND u.deleted_at IS NULL
       GROUP BY r.id, r.clave
       ORDER BY r.id
    `);
        return result.rows;
      }
      async obtenerUsuariosPorEstado() {
        const result = await db.query(`
      SELECT ec.clave AS estado, COUNT(u.id)::int AS total
        FROM estados_cuenta ec
        LEFT JOIN usuarios u
          ON u.estado_id = ec.id
         AND u.deleted_at IS NULL
       GROUP BY ec.id, ec.clave
       ORDER BY ec.id
    `);
        return result.rows;
      }
      async obtenerRegistrosPorMes(fechaInicio, fechaFin, agrupacion = "mes") {
        if (agrupacion === "dia") {
          const result2 = await db.query(`
        WITH dias AS (
          SELECT generate_series(
            $1::date,
            $2::date,
            INTERVAL '1 day'
          )::date AS dia
        )
        SELECT
          to_char(d.dia, 'YYYY-MM-DD') AS fecha,
          trim(to_char(d.dia, 'TMDD "de" TMMonth')) AS etiqueta,
          COUNT(u.id)::int AS total
        FROM dias d
        LEFT JOIN usuarios u
          ON u.deleted_at IS NULL
         AND u.created_at >= d.dia
         AND u.created_at < d.dia + INTERVAL '1 day'
        GROUP BY d.dia
        ORDER BY d.dia
      `, [fechaInicio, fechaFin]);
          return result2.rows;
        }
        const result = await db.query(`
      WITH meses AS (
        SELECT generate_series(
          date_trunc('month', $1::date),
          date_trunc('month', $2::date),
          INTERVAL '1 month'
        ) AS mes
      )
      SELECT
        to_char(m.mes, 'YYYY-MM') AS mes,
        trim(to_char(m.mes, 'TMMonth YYYY')) AS etiqueta,
        COUNT(u.id)::int AS total
      FROM meses m
      LEFT JOIN usuarios u
        ON u.deleted_at IS NULL
       AND u.created_at >= GREATEST(m.mes, $1::date)
       AND u.created_at < LEAST(m.mes + INTERVAL '1 month', $2::date + INTERVAL '1 day')
      GROUP BY m.mes
      ORDER BY m.mes
    `, [fechaInicio, fechaFin]);
        return result.rows;
      }
      async obtenerMedicosPorEspecialidad() {
        const result = await db.query(`
      SELECT e.nombre AS especialidad, COUNT(DISTINCT m.id)::int AS total
        FROM medicos m
        JOIN usuarios u
          ON u.id = m.usuario_id
         AND u.deleted_at IS NULL
        JOIN medico_especialidades me ON me.medico_id = m.id
        JOIN especialidades e ON e.id = me.especialidad_id
       WHERE m.deleted_at IS NULL
         AND m.activo = TRUE
         AND e.activo = TRUE
       GROUP BY e.id, e.nombre
       ORDER BY total DESC, especialidad ASC
       LIMIT 8
    `);
        return result.rows;
      }
      async obtenerMedicosPorConsultorio() {
        const result = await db.query(`
      SELECT c.nombre AS consultorio, COUNT(DISTINCT m.id)::int AS total
        FROM medicos m
        JOIN usuarios u
          ON u.id = m.usuario_id
         AND u.deleted_at IS NULL
        JOIN medico_consultorios mc ON mc.medico_id = m.id
        JOIN consultorios c
          ON c.id = mc.consultorio_id
         AND c.deleted_at IS NULL
         AND c.activo = TRUE
       WHERE m.deleted_at IS NULL
         AND m.activo = TRUE
       GROUP BY c.id, c.nombre
       ORDER BY total DESC, consultorio ASC
    `);
        return result.rows;
      }
      async obtenerCitasPorEstado(fechaInicio, fechaFin) {
        const result = await db.query(`
      SELECT ec.clave AS estado, COUNT(c.id)::int AS total
        FROM estados_cita ec
        LEFT JOIN citas c
          ON c.estado_id = ec.id
         AND c.fecha_hora >= $1::date
         AND c.fecha_hora < $2::date + INTERVAL '1 day'
       GROUP BY ec.id, ec.clave
       ORDER BY ec.id
    `, [fechaInicio, fechaFin]);
        return result.rows;
      }
      async obtenerCitasPorDia(fechaInicio, fechaFin) {
        const result = await db.query(`
      WITH dias AS (
        SELECT generate_series(
          $1::date,
          $2::date,
          INTERVAL '1 day'
        )::date AS dia
      )
      SELECT
        to_char(d.dia, 'YYYY-MM-DD') AS fecha,
        trim(to_char(d.dia, 'TMDD "de" TMMonth')) AS etiqueta,
        COUNT(c.id)::int AS total
      FROM dias d
      LEFT JOIN citas c
        ON c.fecha_hora >= d.dia
       AND c.fecha_hora < d.dia + INTERVAL '1 day'
      GROUP BY d.dia
      ORDER BY d.dia
    `, [fechaInicio, fechaFin]);
        return result.rows;
      }
      async obtenerPorcentajes(fechaInicio, fechaFin) {
        const result = await db.query(`
      WITH usuarios AS (
        SELECT
          COUNT(*)::numeric AS total,
          COUNT(*) FILTER (WHERE ec.clave = 'pendiente')::numeric AS pendientes
        FROM usuarios u
        JOIN estados_cuenta ec ON ec.id = u.estado_id
        WHERE u.deleted_at IS NULL
      ), citas AS (
        SELECT
          COUNT(*)::numeric AS total,
          COUNT(*) FILTER (WHERE ec.clave = 'confirmada')::numeric AS confirmadas
        FROM citas c
        JOIN estados_cita ec ON ec.id = c.estado_id
        WHERE c.fecha_hora >= $1::date
          AND c.fecha_hora < $2::date + INTERVAL '1 day'
      )
      SELECT
        COALESCE(
          ROUND(100.0 * u.pendientes / NULLIF(u.total, 0), 1),
          0
        )::float8 AS "cuentasPendientes",
        COALESCE(
          ROUND(100.0 * c.confirmadas / NULLIF(c.total, 0), 1),
          0
        )::float8 AS "citasConfirmadas"
      FROM usuarios u
      CROSS JOIN citas c
    `, [fechaInicio, fechaFin]);
        return result.rows[0];
      }
      async obtenerDuracionPromedio(fechaInicio, fechaFin) {
        const result = await db.query(`
      WITH promedio AS (
        SELECT COALESCE(ROUND(AVG(duracion_minutos)), 0)::int AS minutos
        FROM citas
        WHERE fecha_hora >= $1::date
          AND fecha_hora < $2::date + INTERVAL '1 day'
      )
      SELECT
        minutos AS "duracionPromedioCitas",
        CONCAT(
          TRUNC(minutos / 60.0)::int,
          ' h ',
          MOD(minutos, 60),
          ' min'
        ) AS "duracionPromedioTexto"
      FROM promedio
    `, [fechaInicio, fechaFin]);
        return result.rows[0];
      }
      // ── Dashboard del médico ────────────────────────────────────────────────
      async obtenerTotalesMedico(usuarioId) {
        const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM citas c
           JOIN medicos m ON m.id = c.medico_id
          WHERE m.usuario_id = $1
            AND m.deleted_at IS NULL
            AND c.fecha_hora >= CURRENT_DATE
            AND c.fecha_hora < CURRENT_DATE + INTERVAL '1 day') AS "citasHoy",
        (SELECT COUNT(DISTINCT c.paciente_id)::int
           FROM citas c
           JOIN medicos m ON m.id = c.medico_id
           JOIN estados_cita ec ON ec.id = c.estado_id
          WHERE m.usuario_id = $1
            AND m.deleted_at IS NULL
            AND ec.clave = 'completada') AS "pacientesAtendidos"
    `, [usuarioId]);
        return result.rows[0];
      }
      async obtenerProximasCitasMedico(usuarioId) {
        const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        up.nombre AS paciente
      FROM citas c
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.usuario_id = $1
       AND m.deleted_at IS NULL
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN usuarios up
        ON up.id = p.usuario_id
       AND up.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.fecha_hora >= now()
        AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')
      ORDER BY c.fecha_hora ASC
      LIMIT 5
    `, [usuarioId]);
        return result.rows;
      }
      async obtenerAgendaHoyMedico(usuarioId) {
        const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        up.nombre AS paciente
      FROM citas c
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.usuario_id = $1
       AND m.deleted_at IS NULL
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN usuarios up
        ON up.id = p.usuario_id
       AND up.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.fecha_hora >= CURRENT_DATE
        AND c.fecha_hora < CURRENT_DATE + INTERVAL '1 day'
      ORDER BY c.fecha_hora ASC
    `, [usuarioId]);
        return result.rows;
      }
      async obtenerCitasSemanaMedico(usuarioId) {
        const result = await db.query(`
      WITH dias AS (
        SELECT generate_series(
          date_trunc('week', CURRENT_DATE)::date,
          (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date,
          INTERVAL '1 day'
        )::date AS dia
      )
      SELECT
        to_char(d.dia, 'YYYY-MM-DD') AS fecha,
        trim(to_char(d.dia, 'TMDy DD')) AS etiqueta,
        COUNT(c.id)::int AS total
      FROM dias d
      LEFT JOIN medicos m
        ON m.usuario_id = $1
       AND m.deleted_at IS NULL
      LEFT JOIN citas c
        ON c.medico_id = m.id
       AND c.fecha_hora >= d.dia
       AND c.fecha_hora < d.dia + INTERVAL '1 day'
       AND c.estado_id IN (1, 2, 3, 5)
      GROUP BY d.dia
      ORDER BY d.dia
    `, [usuarioId]);
        return result.rows;
      }
      // ── Dashboard del paciente ──────────────────────────────────────────────
      async obtenerTotalesPaciente(usuarioId) {
        const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM citas c
           JOIN pacientes p ON p.id = c.paciente_id
           JOIN estados_cita ec ON ec.id = c.estado_id
          WHERE p.usuario_id = $1
            AND p.deleted_at IS NULL
            AND c.fecha_hora >= now()
            AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')) AS "citasProgramadas",
        (SELECT COUNT(*)::int
           FROM citas c
           JOIN pacientes p ON p.id = c.paciente_id
           JOIN estados_cita ec ON ec.id = c.estado_id
          WHERE p.usuario_id = $1
            AND p.deleted_at IS NULL
            AND ec.clave = 'completada') AS "citasCompletadas"
    `, [usuarioId]);
        return result.rows[0];
      }
      async obtenerProximasCitasPaciente(usuarioId) {
        const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        um.nombre AS medico,
        e.nombre AS especialidad,
        co.nombre AS consultorio
      FROM citas c
      JOIN pacientes p
        ON p.id = c.paciente_id
       AND p.usuario_id = $1
       AND p.deleted_at IS NULL
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.deleted_at IS NULL
      JOIN usuarios um
        ON um.id = m.usuario_id
       AND um.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      JOIN consultorios co ON co.id = c.consultorio_id
      LEFT JOIN LATERAL (
        SELECT esp.nombre
          FROM medico_especialidades me
          JOIN especialidades esp ON esp.id = me.especialidad_id
         WHERE me.medico_id = m.id
           AND esp.activo = TRUE
         ORDER BY esp.nombre ASC
         LIMIT 1
      ) e ON TRUE
      WHERE c.fecha_hora >= now()
        AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')
      ORDER BY c.fecha_hora ASC
      LIMIT 5
    `, [usuarioId]);
        return result.rows;
      }
      async obtenerMedicoPrincipalPaciente(usuarioId) {
        const result = await db.query(`
      SELECT
        um.nombre AS medico,
        e.nombre AS especialidad,
        COUNT(*)::int AS total
      FROM citas c
      JOIN pacientes p
        ON p.id = c.paciente_id
       AND p.usuario_id = $1
       AND p.deleted_at IS NULL
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.deleted_at IS NULL
      JOIN usuarios um
        ON um.id = m.usuario_id
       AND um.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT esp.nombre
          FROM medico_especialidades me
          JOIN especialidades esp ON esp.id = me.especialidad_id
         WHERE me.medico_id = m.id
           AND esp.activo = TRUE
         ORDER BY esp.nombre ASC
         LIMIT 1
      ) e ON TRUE
      GROUP BY m.id, um.nombre, e.nombre
      ORDER BY total DESC, um.nombre ASC
      LIMIT 1
    `, [usuarioId]);
        return result.rows[0] ?? null;
      }
      async obtenerHistorialCitasPaciente(usuarioId) {
        const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        um.nombre AS medico,
        e.nombre AS especialidad,
        co.nombre AS consultorio
      FROM citas c
      JOIN pacientes p
        ON p.id = c.paciente_id
       AND p.usuario_id = $1
       AND p.deleted_at IS NULL
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.deleted_at IS NULL
      JOIN usuarios um
        ON um.id = m.usuario_id
       AND um.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      JOIN consultorios co ON co.id = c.consultorio_id
      LEFT JOIN LATERAL (
        SELECT esp.nombre
          FROM medico_especialidades me
          JOIN especialidades esp ON esp.id = me.especialidad_id
         WHERE me.medico_id = m.id
           AND esp.activo = TRUE
         ORDER BY esp.nombre ASC
         LIMIT 1
      ) e ON TRUE
      WHERE (c.fecha_hora < now()
         OR ec.clave IN ('completada', 'cancelada', 'no_asistio'))
      ORDER BY c.fecha_hora DESC
      LIMIT 20
    `, [usuarioId]);
        return result.rows;
      }
    };
    module2.exports = PostgresDashboardRepository;
  }
});

// src/application/use-cases/ObtenerResumenAdmin.js
var require_ObtenerResumenAdmin = __commonJS({
  "src/application/use-cases/ObtenerResumenAdmin.js"(exports2, module2) {
    "use strict";
    var MS_POR_DIA = 24 * 60 * 60 * 1e3;
    function contarDias(fechaInicio, fechaFin) {
      const inicio = Date.parse(`${fechaInicio}T00:00:00Z`);
      const fin = Date.parse(`${fechaFin}T00:00:00Z`);
      return Math.round((fin - inicio) / MS_POR_DIA) + 1;
    }
    var ObtenerResumenAdmin = class {
      constructor(dashboardRepository) {
        this.repo = dashboardRepository;
      }
      async execute({ fechaInicio, fechaFin } = {}) {
        const dias = contarDias(fechaInicio, fechaFin);
        const agrupacion = dias > 31 ? "mes" : "dia";
        const [
          totales,
          usuariosPorRol,
          usuariosPorEstado,
          registrosPorMes,
          medicosPorEspecialidad,
          medicosPorConsultorio,
          citasPorEstado,
          citasPorDia,
          porcentajes,
          duracionPromedio
        ] = await Promise.all([
          this.repo.obtenerTotales(fechaInicio, fechaFin),
          this.repo.obtenerUsuariosPorRol(),
          this.repo.obtenerUsuariosPorEstado(),
          this.repo.obtenerRegistrosPorMes(fechaInicio, fechaFin, agrupacion),
          this.repo.obtenerMedicosPorEspecialidad(),
          this.repo.obtenerMedicosPorConsultorio(),
          this.repo.obtenerCitasPorEstado(fechaInicio, fechaFin),
          this.repo.obtenerCitasPorDia(fechaInicio, fechaFin),
          this.repo.obtenerPorcentajes(fechaInicio, fechaFin),
          this.repo.obtenerDuracionPromedio(fechaInicio, fechaFin)
        ]);
        return {
          rango: {
            fechaInicio,
            fechaFin,
            dias,
            agrupacionRegistros: agrupacion
          },
          totales,
          usuariosPorRol,
          usuariosPorEstado,
          registrosPorMes,
          medicosPorEspecialidad,
          medicosPorConsultorio,
          citasPorEstado,
          citasPorDia,
          porcentajes,
          duracionPromedioCitas: duracionPromedio.duracionPromedioCitas,
          duracionPromedioTexto: duracionPromedio.duracionPromedioTexto
        };
      }
    };
    module2.exports = ObtenerResumenAdmin;
  }
});

// src/application/use-cases/ObtenerResumenMedico.js
var require_ObtenerResumenMedico = __commonJS({
  "src/application/use-cases/ObtenerResumenMedico.js"(exports2, module2) {
    "use strict";
    var ObtenerResumenMedico = class {
      constructor(dashboardRepository) {
        this.repo = dashboardRepository;
      }
      async execute(usuarioId) {
        const [
          totales,
          proximasCitas,
          agendaHoy,
          citasSemana
        ] = await Promise.all([
          this.repo.obtenerTotalesMedico(usuarioId),
          this.repo.obtenerProximasCitasMedico(usuarioId),
          this.repo.obtenerAgendaHoyMedico(usuarioId),
          this.repo.obtenerCitasSemanaMedico(usuarioId)
        ]);
        return {
          totales,
          proximaCita: proximasCitas[0] ?? null,
          proximasCitas,
          agendaHoy,
          citasSemana
        };
      }
    };
    module2.exports = ObtenerResumenMedico;
  }
});

// src/application/use-cases/ObtenerResumenPaciente.js
var require_ObtenerResumenPaciente = __commonJS({
  "src/application/use-cases/ObtenerResumenPaciente.js"(exports2, module2) {
    "use strict";
    var ObtenerResumenPaciente = class {
      constructor(dashboardRepository) {
        this.repo = dashboardRepository;
      }
      async execute(usuarioId) {
        const [
          totales,
          proximasCitas,
          doctorPrincipal,
          historialCitas
        ] = await Promise.all([
          this.repo.obtenerTotalesPaciente(usuarioId),
          this.repo.obtenerProximasCitasPaciente(usuarioId),
          this.repo.obtenerMedicoPrincipalPaciente(usuarioId),
          this.repo.obtenerHistorialCitasPaciente(usuarioId)
        ]);
        return {
          citasProgramadas: totales.citasProgramadas,
          citasCompletadas: totales.citasCompletadas,
          doctorPrincipal,
          proximaCita: proximasCitas[0] ?? null,
          proximasCitas,
          historialCitas,
          // Se conserva `totales` para clientes que ya consumían este contrato.
          totales
        };
      }
    };
    module2.exports = ObtenerResumenPaciente;
  }
});

// src/interfaces/http/utils/rangoFechas.js
var require_rangoFechas = __commonJS({
  "src/interfaces/http/utils/rangoFechas.js"(exports2, module2) {
    "use strict";
    var RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
    var DIAS_POR_DEFECTO = 30;
    var MAX_DIAS = 366;
    var MS_POR_DIA = 24 * 60 * 60 * 1e3;
    function fechaLocalISO(fecha = /* @__PURE__ */ new Date()) {
      const anio = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, "0");
      const dia = String(fecha.getDate()).padStart(2, "0");
      return `${anio}-${mes}-${dia}`;
    }
    function esFechaISO(texto) {
      if (typeof texto !== "string" || !RE_FECHA.test(texto)) return false;
      const [anio, mes, dia] = texto.split("-").map(Number);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
    }
    function sumarDias(fechaISO, dias) {
      const fecha = /* @__PURE__ */ new Date(`${fechaISO}T00:00:00Z`);
      fecha.setUTCDate(fecha.getUTCDate() + dias);
      return fecha.toISOString().slice(0, 10);
    }
    function contarDias(fechaInicio, fechaFin) {
      const inicio = Date.parse(`${fechaInicio}T00:00:00Z`);
      const fin = Date.parse(`${fechaFin}T00:00:00Z`);
      return Math.round((fin - inicio) / MS_POR_DIA) + 1;
    }
    function resolverRango(query = {}) {
      const inicioCrudo = query.fecha_inicio;
      const finCrudo = query.fecha_fin;
      if (inicioCrudo !== void 0 && !esFechaISO(inicioCrudo)) {
        return { error: "fecha_inicio debe tener el formato YYYY-MM-DD y ser una fecha v\xE1lida" };
      }
      if (finCrudo !== void 0 && !esFechaISO(finCrudo)) {
        return { error: "fecha_fin debe tener el formato YYYY-MM-DD y ser una fecha v\xE1lida" };
      }
      const fechaFin = finCrudo ?? fechaLocalISO();
      const fechaInicio = inicioCrudo ?? sumarDias(fechaFin, -(DIAS_POR_DEFECTO - 1));
      if (fechaInicio > fechaFin) {
        return { error: "fecha_inicio no puede ser posterior a fecha_fin" };
      }
      const dias = contarDias(fechaInicio, fechaFin);
      if (dias > MAX_DIAS) {
        return { error: `El rango no puede superar ${MAX_DIAS} d\xEDas` };
      }
      return { fechaInicio, fechaFin, dias };
    }
    module2.exports = {
      DIAS_POR_DEFECTO,
      MAX_DIAS,
      resolverRango,
      esFechaISO,
      sumarDias,
      contarDias
    };
  }
});

// src/interfaces/http/controllers/DashboardController.js
var require_DashboardController = __commonJS({
  "src/interfaces/http/controllers/DashboardController.js"(exports2, module2) {
    "use strict";
    var PostgresDashboardRepository = require_PostgresDashboardRepository();
    var ObtenerResumenAdmin = require_ObtenerResumenAdmin();
    var ObtenerResumenMedico = require_ObtenerResumenMedico();
    var ObtenerResumenPaciente = require_ObtenerResumenPaciente();
    var { resolverRango } = require_rangoFechas();
    var repo = new PostgresDashboardRepository();
    async function obtenerResumenAdmin(req, res) {
      const rango = resolverRango(req.query);
      if (rango.error) {
        return res.status(400).json({ ok: false, mensaje: rango.error });
      }
      try {
        const caso = new ObtenerResumenAdmin(repo);
        const data = await caso.execute(rango);
        return res.json({
          ok: true,
          mensaje: "Resumen del dashboard administrativo",
          data
        });
      } catch (error) {
        console.error("[Dashboard] Error al obtener resumen admin:", error.message);
        return res.status(500).json({
          ok: false,
          mensaje: "Error al obtener el resumen del dashboard"
        });
      }
    }
    async function obtenerResumenMedico(req, res) {
      try {
        const caso = new ObtenerResumenMedico(repo);
        const data = await caso.execute(req.usuario.id);
        return res.json({
          ok: true,
          mensaje: "Resumen del dashboard m\xE9dico",
          data
        });
      } catch (error) {
        console.error("[Dashboard] Error al obtener resumen m\xE9dico:", error.message);
        return res.status(500).json({
          ok: false,
          mensaje: "Error al obtener el resumen del dashboard"
        });
      }
    }
    async function obtenerResumenPaciente(req, res) {
      try {
        const caso = new ObtenerResumenPaciente(repo);
        const data = await caso.execute(req.usuario.id);
        return res.json({
          ok: true,
          mensaje: "Resumen del dashboard paciente",
          data
        });
      } catch (error) {
        console.error("[Dashboard] Error al obtener resumen paciente:", error.message);
        return res.status(500).json({
          ok: false,
          mensaje: "Error al obtener el resumen del dashboard"
        });
      }
    }
    module2.exports = { obtenerResumenAdmin, obtenerResumenMedico, obtenerResumenPaciente };
  }
});

// src/interfaces/http/middlewares/authMiddleware.js
var require_authMiddleware = __commonJS({
  "src/interfaces/http/middlewares/authMiddleware.js"(exports2, module2) {
    "use strict";
    var jwt = require("jsonwebtoken");
    var { JWT_SECRET } = require_secrets();
    function authMiddleware(req, res, next) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, mensaje: "Token no proporcionado" });
      }
      const token = authHeader.split(" ")[1];
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuario = payload;
        next();
      } catch (error) {
        return res.status(401).json({ ok: false, mensaje: "Token inv\xE1lido o expirado" });
      }
    }
    module2.exports = authMiddleware;
  }
});

// src/interfaces/http/middlewares/roleMiddleware.js
var require_roleMiddleware = __commonJS({
  "src/interfaces/http/middlewares/roleMiddleware.js"(exports2, module2) {
    "use strict";
    var rolesValidos = { 1: "admin", 2: "medico", 3: "paciente" };
    function roleMiddleware(...rolesPermitidos) {
      return (req, res, next) => {
        if (!req.usuario) {
          return res.status(401).json({ ok: false, mensaje: "No autenticado" });
        }
        const claveRol = rolesValidos[req.usuario.rol_id];
        if (!rolesPermitidos.includes(claveRol)) {
          return res.status(403).json({ ok: false, mensaje: "No tienes permiso para acceder a este recurso" });
        }
        next();
      };
    }
    module2.exports = roleMiddleware;
  }
});

// src/interfaces/http/routes/dashboard.routes.js
var require_dashboard_routes = __commonJS({
  "src/interfaces/http/routes/dashboard.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var { obtenerResumenAdmin, obtenerResumenMedico, obtenerResumenPaciente } = require_DashboardController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.get("/admin", authMiddleware, roleMiddleware("admin"), obtenerResumenAdmin);
    router.get("/medico", authMiddleware, roleMiddleware("medico"), obtenerResumenMedico);
    router.get("/paciente", authMiddleware, roleMiddleware("paciente"), obtenerResumenPaciente);
    module2.exports = router;
  }
});

// src/domain/ports/UsuarioRepository.js
var require_UsuarioRepository = __commonJS({
  "src/domain/ports/UsuarioRepository.js"(exports2, module2) {
    "use strict";
    var UsuarioRepository = class {
      async listar({ rol, estado, page = 1, limit = 10 } = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      async listarPendientes() {
        throw new Error("M\xE9todo no implementado");
      }
      async aprobar(id) {
        throw new Error("M\xE9todo no implementado");
      }
      async rechazar(id) {
        throw new Error("M\xE9todo no implementado");
      }
      async asignarRol(id, rol_id) {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerEstadisticas() {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerPorId(id) {
        throw new Error("M\xE9todo no implementado");
      }
    };
    module2.exports = UsuarioRepository;
  }
});

// src/domain/entities/Usuario.js
var require_Usuario = __commonJS({
  "src/domain/entities/Usuario.js"(exports2, module2) {
    "use strict";
    var Usuario = class _Usuario {
      constructor({ id, uuid_publico, nombre, email, rol_id, estado_id, created_at }) {
        this.id = id;
        this.uuid_publico = uuid_publico;
        this.nombre = nombre;
        this.email = email;
        this.rol_id = rol_id;
        this.estado_id = estado_id;
        this.created_at = created_at;
      }
      static fromRow(row) {
        return new _Usuario(row);
      }
      esPendiente() {
        return this.estado_id === 1;
      }
      esActivo() {
        return this.estado_id === 2;
      }
      esPaciente() {
        return this.rol_id === 3;
      }
    };
    module2.exports = Usuario;
  }
});

// src/infrastructure/adapters/PostgresUsuarioRepository.js
var require_PostgresUsuarioRepository = __commonJS({
  "src/infrastructure/adapters/PostgresUsuarioRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var UsuarioRepository = require_UsuarioRepository();
    var Usuario = require_Usuario();
    var PostgresUsuarioRepository = class extends UsuarioRepository {
      async listar({ rol, estado, q, page = 1, limit = 10 } = {}) {
        const condiciones = ["deleted_at IS NULL"];
        const parametros = [];
        if (rol) {
          parametros.push(rol);
          condiciones.push(`rol_id = (SELECT id FROM roles WHERE clave = $${parametros.length})`);
        }
        if (estado) {
          parametros.push(estado);
          condiciones.push(`estado_id = (SELECT id FROM estados_cuenta WHERE clave = $${parametros.length})`);
        }
        if (q) {
          parametros.push(`%${q}%`);
          condiciones.push(`(u.nombre ILIKE $${parametros.length} OR u.email ILIKE $${parametros.length})`);
        }
        const where = condiciones.join(" AND ");
        const offset = (page - 1) * limit;
        const countSql = `SELECT COUNT(*) FROM usuarios u WHERE ${where}`;
        const totalResult = await db.query(countSql, parametros);
        const total = parseInt(totalResult.rows[0].count, 10);
        const sql = `
      SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.ultimo_login,
             r.clave AS rol, e.clave AS estado
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      JOIN estados_cuenta e ON e.id = u.estado_id
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}
    `;
        const result = await db.query(sql, [...parametros, limit, offset]);
        return {
          data: result.rows.map((row) => ({
            id: row.id,
            uuid_publico: row.uuid_publico,
            nombre: row.nombre,
            email: row.email,
            rol: row.rol,
            estado: row.estado,
            created_at: row.created_at,
            ultimo_login: row.ultimo_login
          })),
          total,
          page,
          limit
        };
      }
      async listarPendientes() {
        const result = await db.query(
          `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.ultimo_login,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')
         AND u.deleted_at IS NULL
       ORDER BY u.created_at ASC`
        );
        return result.rows;
      }
      async aprobar(id) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const usuarioResult = await client.query(
            `SELECT id, rol_id, estado_id FROM usuarios WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
            [id]
          );
          if (usuarioResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { success: false, mensaje: "Usuario no encontrado" };
          }
          const usuario = usuarioResult.rows[0];
          if (usuario.estado_id !== 1) {
            await client.query("ROLLBACK");
            return { success: false, mensaje: "El usuario no est\xE1 pendiente" };
          }
          await client.query(
            `UPDATE usuarios SET estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo') WHERE id = $1`,
            [id]
          );
          if (usuario.rol_id === 3) {
            await client.query(
              `INSERT INTO pacientes (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
              [id]
            );
          }
          await client.query("COMMIT");
          return { success: true, mensaje: "Usuario aprobado correctamente" };
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
      async rechazar(id) {
        const result = await db.query(
          `UPDATE usuarios SET estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'rechazado')
       WHERE id = $1 AND estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')
         AND deleted_at IS NULL
       RETURNING id`,
          [id]
        );
        if (result.rows.length === 0) {
          return { success: false, mensaje: "Usuario no encontrado o no est\xE1 pendiente" };
        }
        return { success: true, mensaje: "Cuenta rechazada correctamente" };
      }
      async cambiarRol(id, nuevoRolId, actorId) {
        if (parseInt(id) === parseInt(actorId)) {
          return { success: false, mensaje: "No puedes cambiar tu propio rol" };
        }
        const rolExiste = await db.query("SELECT id, clave FROM roles WHERE id = $1", [nuevoRolId]);
        if (rolExiste.rows.length === 0) {
          return { success: false, mensaje: "Rol no encontrado" };
        }
        const nuevaRolClave = rolExiste.rows[0].clave;
        const usuarioActual = await db.query("SELECT rol_id FROM usuarios WHERE id = $1 AND deleted_at IS NULL", [id]);
        if (usuarioActual.rows.length === 0) {
          return { success: false, mensaje: "Usuario no encontrado" };
        }
        const rolActualId = usuarioActual.rows[0].rol_id;
        const rolActual = await db.query("SELECT clave FROM roles WHERE id = $1", [rolActualId]);
        const rolActualClave = rolActual.rows[0]?.clave;
        if (nuevaRolClave === "medico" || rolActualClave === "medico") {
          return { success: false, mensaje: "No se puede cambiar el rol hacia o desde m\xE9dico. Use el m\xF3dulo de M\xE9dicos." };
        }
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE usuarios SET rol_id = $1 WHERE id = $2 AND deleted_at IS NULL`,
            [nuevoRolId, id]
          );
          if (nuevaRolClave === "paciente") {
            await client.query(
              `INSERT INTO pacientes (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
              [id]
            );
          }
          await client.query("COMMIT");
          return { success: true, mensaje: "Rol actualizado correctamente" };
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
      async obtenerEstadisticas() {
        const result = await db.query(`
      SELECT
        COUNT(*) AS totales,
        COUNT(*) FILTER (WHERE estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')) AS pendientes,
        COUNT(*) FILTER (WHERE estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo')) AS activos,
        COUNT(*) FILTER (WHERE rol_id = (SELECT id FROM roles WHERE clave = 'admin')) AS admins,
        COUNT(*) FILTER (WHERE rol_id = (SELECT id FROM roles WHERE clave = 'medico')) AS medicos,
        COUNT(*) FILTER (WHERE rol_id = (SELECT id FROM roles WHERE clave = 'paciente')) AS pacientes
      FROM usuarios
      WHERE deleted_at IS NULL
    `);
        const row = result.rows[0];
        return {
          totales: parseInt(row.totales, 10),
          pendientes: parseInt(row.pendientes, 10),
          activos: parseInt(row.activos, 10),
          admins: parseInt(row.admins, 10),
          medicos: parseInt(row.medicos, 10),
          pacientes: parseInt(row.pacientes, 10)
        };
      }
      async obtenerPorId(id) {
        const result = await db.query(
          `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.ultimo_login,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
          [id]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
          id: row.id,
          uuid_publico: row.uuid_publico,
          nombre: row.nombre,
          email: row.email,
          rol: row.rol,
          estado: row.estado,
          created_at: row.created_at,
          ultimo_login: row.ultimo_login
        };
      }
      async crear({ nombre, email, password_hash, rol_id }) {
        const rolValido = await db.query("SELECT id, clave FROM roles WHERE id = $1", [rol_id]);
        if (rolValido.rows.length === 0) {
          return { success: false, mensaje: "Rol no encontrado" };
        }
        if (!["admin", "paciente"].includes(rolValido.rows[0].clave)) {
          return { success: false, mensaje: "Los m\xE9dicos se crean desde el m\xF3dulo M\xE9dicos" };
        }
        const emailNormalizado = email.trim().toLowerCase();
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const result = await client.query(
            `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
         VALUES ($1, $2, $3, $4, (SELECT id FROM estados_cuenta WHERE clave = 'activo'))
         RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, created_at`,
            [nombre, emailNormalizado, password_hash, rol_id]
          );
          const usuario = result.rows[0];
          if (rolValido.rows[0].clave === "paciente") {
            await client.query(
              `INSERT INTO pacientes (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
              [usuario.id]
            );
          }
          await client.query("COMMIT");
          return { success: true, data: usuario, mensaje: "Usuario creado correctamente" };
        } catch (error) {
          await client.query("ROLLBACK");
          if (error.code === "23505") {
            return { success: false, mensaje: "El email ya est\xE1 registrado" };
          }
          throw error;
        } finally {
          client.release();
        }
      }
      async actualizar(id, { nombre, email, password_hash, rol_id }) {
        const campos = [];
        const valores = [];
        let indice = 1;
        if (nombre !== void 0) {
          campos.push(`nombre = $${indice++}`);
          valores.push(nombre);
        }
        if (email !== void 0) {
          campos.push(`email = $${indice++}`);
          valores.push(email.trim().toLowerCase());
        }
        if (password_hash !== void 0) {
          campos.push(`password_hash = $${indice++}`);
          valores.push(password_hash);
        }
        if (campos.length === 0) {
          return { success: false, mensaje: "No hay campos para actualizar" };
        }
        valores.push(id);
        try {
          const result = await db.query(
            `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${indice} AND deleted_at IS NULL
         RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, updated_at`,
            valores
          );
          if (result.rows.length === 0) {
            return { success: false, mensaje: "Usuario no encontrado" };
          }
          return { success: true, data: result.rows[0], mensaje: "Usuario actualizado correctamente" };
        } catch (error) {
          if (error.code === "23505") {
            return { success: false, mensaje: "El email ya est\xE1 registrado" };
          }
          throw error;
        }
      }
      async eliminar(id, actorId) {
        if (parseInt(id) === parseInt(actorId)) {
          return { success: false, mensaje: "No puedes eliminar tu propia cuenta" };
        }
        const result = await db.query(
          `UPDATE usuarios SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
          [id]
        );
        if (result.rows.length === 0) {
          return { success: false, mensaje: "Usuario no encontrado" };
        }
        return { success: true, mensaje: "Usuario eliminado correctamente" };
      }
    };
    module2.exports = PostgresUsuarioRepository;
  }
});

// src/application/use-cases/ListarUsuarios.js
var require_ListarUsuarios = __commonJS({
  "src/application/use-cases/ListarUsuarios.js"(exports2, module2) {
    "use strict";
    var ListarUsuarios = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(filtros = {}) {
        return this.repo.listar(filtros);
      }
    };
    module2.exports = ListarUsuarios;
  }
});

// src/application/use-cases/AprobarUsuario.js
var require_AprobarUsuario = __commonJS({
  "src/application/use-cases/AprobarUsuario.js"(exports2, module2) {
    "use strict";
    var AprobarUsuario = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(id) {
        return this.repo.aprobar(id);
      }
    };
    module2.exports = AprobarUsuario;
  }
});

// src/application/use-cases/RechazarUsuario.js
var require_RechazarUsuario = __commonJS({
  "src/application/use-cases/RechazarUsuario.js"(exports2, module2) {
    "use strict";
    var RechazarUsuario = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(id) {
        return this.repo.rechazar(id);
      }
    };
    module2.exports = RechazarUsuario;
  }
});

// src/application/use-cases/CambiarRol.js
var require_CambiarRol = __commonJS({
  "src/application/use-cases/CambiarRol.js"(exports2, module2) {
    "use strict";
    var CambiarRol = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(id, rol_id, actorId) {
        return this.repo.cambiarRol(id, rol_id, actorId);
      }
    };
    module2.exports = CambiarRol;
  }
});

// src/application/use-cases/ObtenerEstadisticasUsuarios.js
var require_ObtenerEstadisticasUsuarios = __commonJS({
  "src/application/use-cases/ObtenerEstadisticasUsuarios.js"(exports2, module2) {
    "use strict";
    var ObtenerEstadisticasUsuarios = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute() {
        return this.repo.obtenerEstadisticas();
      }
    };
    module2.exports = ObtenerEstadisticasUsuarios;
  }
});

// src/application/use-cases/CrearUsuarioAdmin.js
var require_CrearUsuarioAdmin = __commonJS({
  "src/application/use-cases/CrearUsuarioAdmin.js"(exports2, module2) {
    "use strict";
    var CrearUsuarioAdmin = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(datos) {
        return this.repo.crear(datos);
      }
    };
    module2.exports = CrearUsuarioAdmin;
  }
});

// src/application/use-cases/ActualizarUsuario.js
var require_ActualizarUsuario = __commonJS({
  "src/application/use-cases/ActualizarUsuario.js"(exports2, module2) {
    "use strict";
    var bcrypt = require("bcryptjs");
    var ActualizarUsuario = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(id, { nombre, email, password, rol_id }) {
        const datos = { nombre, email };
        if (password !== void 0 && password !== "") {
          if (password.length < 8) {
            return { success: false, mensaje: "La contrase\xF1a debe tener al menos 8 caracteres" };
          }
          datos.password_hash = await bcrypt.hash(password, 10);
        }
        return this.repo.actualizar(id, datos);
      }
    };
    module2.exports = ActualizarUsuario;
  }
});

// src/application/use-cases/EliminarUsuario.js
var require_EliminarUsuario = __commonJS({
  "src/application/use-cases/EliminarUsuario.js"(exports2, module2) {
    "use strict";
    var EliminarUsuario = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(id, actorId) {
        if (parseInt(id) === parseInt(actorId)) {
          return { success: false, mensaje: "No puedes eliminar tu propia cuenta" };
        }
        return this.repo.eliminar(id);
      }
    };
    module2.exports = EliminarUsuario;
  }
});

// src/application/use-cases/ObtenerUsuarioPorId.js
var require_ObtenerUsuarioPorId = __commonJS({
  "src/application/use-cases/ObtenerUsuarioPorId.js"(exports2, module2) {
    "use strict";
    var ObtenerUsuarioPorId = class {
      constructor(usuarioRepository) {
        this.repo = usuarioRepository;
      }
      async execute(id) {
        return this.repo.obtenerPorId(id);
      }
    };
    module2.exports = ObtenerUsuarioPorId;
  }
});

// src/interfaces/http/utils/validarId.js
var require_validarId = __commonJS({
  "src/interfaces/http/utils/validarId.js"(exports2, module2) {
    "use strict";
    var MAXIMOS = {
      smallint: 32767,
      integer: 2147483647,
      // BIGINT llega a 9223372036854775807, pero JS no puede representarlo con
      // seguridad: se limita a Number.MAX_SAFE_INTEGER (9007199254740991).
      bigint: Number.MAX_SAFE_INTEGER
    };
    function validarId(id, tipoColumna = "smallint") {
      const max = MAXIMOS[tipoColumna] ?? MAXIMOS.smallint;
      const num = Number(id);
      if (!Number.isSafeInteger(num) || num <= 0 || num > max) return null;
      return num;
    }
    module2.exports = validarId;
  }
});

// src/interfaces/http/controllers/UsuariosController.js
var require_UsuariosController = __commonJS({
  "src/interfaces/http/controllers/UsuariosController.js"(exports2, module2) {
    "use strict";
    var bcrypt = require("bcryptjs");
    var PostgresUsuarioRepository = require_PostgresUsuarioRepository();
    var ListarUsuarios = require_ListarUsuarios();
    var AprobarUsuario = require_AprobarUsuario();
    var RechazarUsuario = require_RechazarUsuario();
    var CambiarRol = require_CambiarRol();
    var ObtenerEstadisticasUsuarios = require_ObtenerEstadisticasUsuarios();
    var CrearUsuarioAdmin = require_CrearUsuarioAdmin();
    var ActualizarUsuario = require_ActualizarUsuario();
    var EliminarUsuario = require_EliminarUsuario();
    var ObtenerUsuarioPorId = require_ObtenerUsuarioPorId();
    var validarId = require_validarId();
    var repo = new PostgresUsuarioRepository();
    function respuestaError500(res, mensaje, error) {
      console.error("[Usuarios] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    async function listar(req, res) {
      try {
        const { rol, estado, q, page = 1, limit = 10 } = req.query;
        const caso = new ListarUsuarios(repo);
        const data = await caso.execute({ rol, estado, q, page: parseInt(page), limit: parseInt(limit) });
        return res.json({ ok: true, mensaje: "Lista de usuarios", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener usuarios", error);
      }
    }
    async function listarPendientes(req, res) {
      try {
        const result = await repo.listarPendientes();
        return res.json({ ok: true, mensaje: "Usuarios pendientes", data: result });
      } catch (error) {
        return respuestaError500(res, "Error al obtener pendientes", error);
      }
    }
    async function obtenerPorId(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const caso = new ObtenerUsuarioPorId(repo);
        const data = await caso.execute(id);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Usuario encontrado", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener usuario", error);
      }
    }
    async function aprobar(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const caso = new AprobarUsuario(repo);
        const resultado = await caso.execute(id);
        if (!resultado.success) {
          return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje });
      } catch (error) {
        return respuestaError500(res, "Error al aprobar usuario", error);
      }
    }
    async function rechazar(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const caso = new RechazarUsuario(repo);
        const resultado = await caso.execute(id);
        if (!resultado.success) {
          return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje });
      } catch (error) {
        return respuestaError500(res, "Error al rechazar usuario", error);
      }
    }
    async function estadisticas(req, res) {
      try {
        const caso = new ObtenerEstadisticasUsuarios(repo);
        const data = await caso.execute();
        return res.json({ ok: true, mensaje: "Estad\xEDsticas de usuarios", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener estad\xEDsticas", error);
      }
    }
    async function crear(req, res) {
      try {
        const { nombre, email, password, rol_id } = req.body;
        if (!nombre || !email || !password || !rol_id) {
          return res.status(400).json({ ok: false, mensaje: "nombre, email, password y rol_id son requeridos" });
        }
        const rolIdNum = parseInt(rol_id, 10);
        if (isNaN(rolIdNum) || ![1, 3].includes(rolIdNum)) {
          return res.status(400).json({ ok: false, mensaje: "Los m\xE9dicos se crean desde el m\xF3dulo M\xE9dicos" });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const caso = new CrearUsuarioAdmin(repo);
        const resultado = await caso.execute({ nombre, email, password_hash: passwordHash, rol_id: rolIdNum });
        if (!resultado.success) {
          return res.status(409).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.status(201).json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
      } catch (error) {
        return respuestaError500(res, "Error al crear usuario", error);
      }
    }
    async function actualizar(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const { nombre, email, password, rol_id } = req.body;
        if (!nombre && !email && !password) {
          return res.status(400).json({ ok: false, mensaje: "No hay campos para actualizar" });
        }
        const caso = new ActualizarUsuario(repo);
        const resultado = await caso.execute(id, { nombre, email, password, rol_id });
        if (!resultado.success) {
          let status = 400;
          if (resultado.mensaje.includes("ya est\xE1 registrado")) status = 409;
          else if (resultado.mensaje.includes("no encontrado") || resultado.mensaje.includes("no existe")) status = 404;
          return res.status(status).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
      } catch (error) {
        return respuestaError500(res, "Error al actualizar usuario", error);
      }
    }
    async function asignarRol(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const { rol_id } = req.body;
        if (!rol_id) {
          return res.status(400).json({ ok: false, mensaje: "rol_id es requerido" });
        }
        const caso = new CambiarRol(repo);
        const resultado = await caso.execute(id, parseInt(rol_id, 10), req.usuario.id);
        if (!resultado.success) {
          let status = 400;
          if (resultado.mensaje.includes("ya est\xE1 registrado") || resultado.mensaje.includes("m\xE9dico") || resultado.mensaje.includes("m\xE9dico")) status = 409;
          else if (resultado.mensaje.includes("no encontrado") || resultado.mensaje.includes("no existe") || resultado.mensaje.includes("propio rol")) status = 400;
          return res.status(status).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje });
      } catch (error) {
        return respuestaError500(res, "Error al cambiar rol", error);
      }
    }
    async function eliminar(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const caso = new EliminarUsuario(repo);
        const resultado = await caso.execute(id, req.usuario.id);
        if (!resultado.success) {
          let status = 400;
          if (resultado.mensaje.includes("no encontrado") || resultado.mensaje.includes("no existe")) status = 404;
          return res.status(status).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje });
      } catch (error) {
        return respuestaError500(res, "Error al eliminar usuario", error);
      }
    }
    async function obtenerDetalle(req, res) {
      try {
        const id = validarId(req.params.id, "integer");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const caso = new ObtenerUsuarioPorId(repo);
        const data = await caso.execute(id);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Usuario encontrado", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener usuario", error);
      }
    }
    module2.exports = {
      listar,
      listarPendientes,
      obtenerPorId,
      aprobar,
      rechazar,
      asignarRol,
      estadisticas,
      crear,
      actualizar,
      eliminar,
      obtenerDetalle
    };
  }
});

// src/interfaces/http/routes/usuarios.routes.js
var require_usuarios_routes = __commonJS({
  "src/interfaces/http/routes/usuarios.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_UsuariosController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.use(authMiddleware, roleMiddleware("admin"));
    router.get("/", ctrl.listar);
    router.get("/pendientes", ctrl.listarPendientes);
    router.get("/stats", ctrl.estadisticas);
    router.get("/:id", ctrl.obtenerDetalle);
    router.post("/", ctrl.crear);
    router.put("/:id/aprobar", ctrl.aprobar);
    router.delete("/:id/negar", ctrl.rechazar);
    router.put("/:id/rol", ctrl.asignarRol);
    router.put("/:id", ctrl.actualizar);
    router.delete("/:id", ctrl.eliminar);
    module2.exports = router;
  }
});

// src/interfaces/http/controllers/PacientesController.js
var require_PacientesController = __commonJS({
  "src/interfaces/http/controllers/PacientesController.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var validarId = require_validarId();
    function esAdmin(usuario) {
      return Number(usuario?.rol_id) === 1;
    }
    function esErrorDeDatos(error) {
      return error?.code === "22003" || error?.code === "22P02";
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      console.error(`[Pacientes] ${mensaje}:`, error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    async function listar(req, res) {
      try {
        const result = await db.query(
          `SELECT p.id, p.usuario_id, p.telefono, p.telegram_chat_id, p.fecha_nacimiento,
              u.nombre, u.email, p.created_at
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.deleted_at IS NULL
         AND u.deleted_at IS NULL
       ORDER BY p.created_at DESC`
        );
        return res.json({ ok: true, mensaje: "Lista de pacientes", data: result.rows });
      } catch (error) {
        return respuestaError500(res, "Error al obtener pacientes", error);
      }
    }
    async function obtenerPorId(req, res) {
      const id = validarId(req.params.id, "bigint");
      if (!id) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      try {
        const result = await db.query(
          `SELECT p.id, p.usuario_id, p.telefono, p.telegram_chat_id, p.fecha_nacimiento,
              u.nombre, u.email, p.created_at
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL`,
          [id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ ok: false, mensaje: "Paciente no encontrado" });
        }
        const paciente = result.rows[0];
        if (!esAdmin(req.usuario) && String(req.usuario.id) !== String(paciente.usuario_id)) {
          return res.status(403).json({ ok: false, mensaje: "No tienes permiso para acceder a este recurso" });
        }
        return res.json({ ok: true, mensaje: "Paciente encontrado", data: paciente });
      } catch (error) {
        return respuestaError500(res, "Error al obtener paciente", error);
      }
    }
    async function crear(req, res) {
      const { usuario_id, telefono, telegram_chat_id, fecha_nacimiento } = req.body || {};
      if (!usuario_id) {
        return res.status(400).json({ ok: false, mensaje: "usuario_id es requerido" });
      }
      const usuarioId = validarId(usuario_id, "bigint");
      if (!usuarioId) {
        return res.status(400).json({ ok: false, mensaje: "usuario_id inv\xE1lido" });
      }
      try {
        const usuario = await db.query(
          "SELECT id FROM usuarios WHERE id = $1 AND deleted_at IS NULL",
          [usuarioId]
        );
        if (usuario.rows.length === 0) {
          return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
        }
        const result = await db.query(
          `INSERT INTO pacientes (usuario_id, telefono, telegram_chat_id, fecha_nacimiento)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario_id, telefono, telegram_chat_id, fecha_nacimiento, created_at`,
          [usuarioId, telefono || null, telegram_chat_id || null, fecha_nacimiento || null]
        );
        return res.status(201).json({ ok: true, mensaje: "Paciente creado correctamente", data: result.rows[0] });
      } catch (error) {
        if (error.code === "23505") {
          return res.status(409).json({ ok: false, mensaje: "El usuario ya tiene un registro de paciente" });
        }
        return respuestaError500(res, "Error al crear paciente", error);
      }
    }
    async function actualizar(req, res) {
      const id = validarId(req.params.id, "bigint");
      if (!id) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      const { telefono, telegram_chat_id, fecha_nacimiento } = req.body || {};
      try {
        const result = await db.query(
          `UPDATE pacientes
       SET telefono = COALESCE($1, telefono),
           telegram_chat_id = COALESCE($2, telegram_chat_id),
           fecha_nacimiento = COALESCE($3, fecha_nacimiento)
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, usuario_id, telefono, telegram_chat_id, fecha_nacimiento, updated_at`,
          [telefono, telegram_chat_id, fecha_nacimiento, id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ ok: false, mensaje: "Paciente no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Paciente actualizado correctamente", data: result.rows[0] });
      } catch (error) {
        return respuestaError500(res, "Error al actualizar paciente", error);
      }
    }
    async function eliminar(req, res) {
      const id = validarId(req.params.id, "bigint");
      if (!id) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      const client = await db.getClient();
      try {
        await client.query("BEGIN");
        const existe = await client.query(
          "SELECT usuario_id FROM pacientes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [id]
        );
        if (existe.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ ok: false, mensaje: "Paciente no encontrado" });
        }
        const { usuario_id: usuarioId } = existe.rows[0];
        const citas = await client.query(
          `SELECT 1
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       WHERE c.paciente_id = $1
         AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')
         AND c.fecha_hora > now()
       LIMIT 1`,
          [id]
        );
        if (citas.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            ok: false,
            mensaje: "No se puede eliminar el paciente porque tiene citas futuras vigentes"
          });
        }
        await client.query("UPDATE pacientes SET deleted_at = now() WHERE id = $1", [id]);
        await client.query(
          "UPDATE usuarios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
          [usuarioId]
        );
        await client.query("COMMIT");
        return res.json({ ok: true, mensaje: "Paciente eliminado correctamente" });
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("[Pacientes] Error en ROLLBACK de eliminar:", rollbackError.message);
        }
        return respuestaError500(res, "Error al eliminar paciente", error);
      } finally {
        client.release();
      }
    }
    module2.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
  }
});

// src/interfaces/http/routes/pacientes.routes.js
var require_pacientes_routes = __commonJS({
  "src/interfaces/http/routes/pacientes.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_PacientesController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.use(authMiddleware);
    router.get("/", roleMiddleware("admin"), ctrl.listar);
    router.get("/:id", roleMiddleware("admin", "paciente"), ctrl.obtenerPorId);
    router.post("/", roleMiddleware("admin"), ctrl.crear);
    router.put("/:id", roleMiddleware("admin"), ctrl.actualizar);
    router.delete("/:id", roleMiddleware("admin"), ctrl.eliminar);
    module2.exports = router;
  }
});

// src/domain/ports/MedicoRepository.js
var require_MedicoRepository = __commonJS({
  "src/domain/ports/MedicoRepository.js"(exports2, module2) {
    "use strict";
    var MedicoRepository = class {
      async listar(_opciones) {
        throw new Error("No implementado");
      }
      async obtenerPorId(_id, _opts) {
        throw new Error("No implementado");
      }
      async crear(_datos) {
        throw new Error("No implementado");
      }
      async actualizar(_id, _datos) {
        throw new Error("No implementado");
      }
      async cambiarEstado(_id, _activo) {
        throw new Error("No implementado");
      }
      async reemplazarEspecialidades(_id, _ids) {
        throw new Error("No implementado");
      }
      async reemplazarConsultorios(_id, _ids) {
        throw new Error("No implementado");
      }
      async eliminar(_id) {
        throw new Error("No implementado");
      }
    };
    module2.exports = MedicoRepository;
  }
});

// src/domain/entities/Medico.js
var require_Medico = __commonJS({
  "src/domain/entities/Medico.js"(exports2, module2) {
    "use strict";
    var Medico = class {
      constructor({
        id,
        usuario_id,
        nombre,
        email,
        cedula_profesional,
        telefono,
        foto_url,
        costo_consulta,
        activo,
        especialidades = [],
        consultorios = []
      }) {
        this.id = id;
        this.usuario_id = usuario_id;
        this.nombre = nombre;
        this.email = email;
        this.cedula_profesional = cedula_profesional;
        this.telefono = telefono;
        this.foto_url = foto_url;
        this.costo_consulta = costo_consulta;
        this.activo = activo;
        this.especialidades = especialidades;
        this.consultorios = consultorios;
      }
      /** RN-047: formato estable que consume el flujo de agendamiento (admin ve email) */
      toPublicDTO() {
        return {
          id: this.id,
          usuario_id: this.usuario_id,
          nombre: this.nombre,
          email: this.email,
          medico_mostrar: `Dr. ${this.nombre}`,
          cedula_profesional: this.cedula_profesional,
          telefono: this.telefono,
          foto_url: this.foto_url,
          costo_consulta: this.costo_consulta,
          activo: this.activo,
          especialidades: this.especialidades,
          consultorios: this.consultorios
        };
      }
      /** Vista reducida para no-admin: sin email ni cédula (RN-046) */
      toPublicDTOReducido() {
        return {
          id: this.id,
          usuario_id: this.usuario_id,
          nombre: this.nombre,
          medico_mostrar: `Dr. ${this.nombre}`,
          telefono: this.telefono,
          foto_url: this.foto_url,
          costo_consulta: this.costo_consulta,
          activo: this.activo,
          especialidades: this.especialidades,
          consultorios: this.consultorios
        };
      }
    };
    module2.exports = Medico;
  }
});

// src/infrastructure/adapters/PostgresMedicoRepository.js
var require_PostgresMedicoRepository = __commonJS({
  "src/infrastructure/adapters/PostgresMedicoRepository.js"(exports2, module2) {
    "use strict";
    var bcrypt = require("bcryptjs");
    var db = require_db();
    var MedicoRepository = require_MedicoRepository();
    var Medico = require_Medico();
    var DuplicadoEmailError = class extends Error {
      constructor() {
        super("El email ya est\xE1 registrado");
        this.name = "DuplicadoEmailError";
      }
    };
    var DuplicadoCedulaError = class extends Error {
      constructor() {
        super("La c\xE9dula profesional ya est\xE1 registrada");
        this.name = "DuplicadoCedulaError";
      }
    };
    var CitasPendientesError = class extends Error {
      constructor() {
        super("El m\xE9dico tiene citas pendientes");
        this.name = "CitasPendientesError";
      }
    };
    var EspecialidadInvalidaError = class extends Error {
      constructor(id) {
        super(`La especialidad con id ${id} no existe o est\xE1 inactiva`);
        this.name = "EspecialidadInvalidaError";
      }
    };
    var ConsultorioInvalidoError = class extends Error {
      constructor(id) {
        super(`El consultorio con id ${id} no existe o est\xE1 inactivo`);
        this.name = "ConsultorioInvalidoError";
      }
    };
    var SQL_MEDICO_COMPLETO = `
  SELECT
    m.id,
    m.usuario_id,
    u.nombre,
    u.email,
    CONCAT('Dr. ', u.nombre)                            AS medico_mostrar,
    m.cedula_profesional,
    m.telefono,
    m.foto_url,
    m.costo_consulta,
    m.activo,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', me.especialidad_id, 'nombre', e.nombre))
        FILTER (WHERE me.especialidad_id IS NOT NULL),
      '[]'
    )                                                   AS especialidades,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', mc.consultorio_id::text, 'nombre', c.nombre))
        FILTER (WHERE mc.consultorio_id IS NOT NULL),
      '[]'
    )                                                   AS consultorios
  FROM medicos m
  JOIN usuarios u ON u.id = m.usuario_id AND u.deleted_at IS NULL
  LEFT JOIN medico_especialidades me ON me.medico_id = m.id
  LEFT JOIN especialidades e ON e.id = me.especialidad_id
  LEFT JOIN medico_consultorios mc ON mc.medico_id = m.id
  LEFT JOIN consultorios c ON c.id = mc.consultorio_id AND c.deleted_at IS NULL
`;
    var PostgresMedicoRepository = class extends MedicoRepository {
      // ── Normalización ─────────────────────────────────────────────────────────
      _normalizarNombre(nombre) {
        return String(nombre).trim().replace(/\s+/g, " ");
      }
      _normalizarTelefono(telefono) {
        if (telefono === void 0 || telefono === null) return null;
        const soloDigitos = String(telefono).replace(/[\s\-()]/g, "");
        return soloDigitos === "" ? null : soloDigitos;
      }
      _normalizarEmail(email) {
        return String(email).trim().toLowerCase();
      }
      _normalizarCosto(costo) {
        if (costo === void 0 || costo === null || costo === "") return null;
        const numero = Number(costo);
        if (!Number.isFinite(numero)) return null;
        return Number(numero.toFixed(2));
      }
      // ── Validación de relaciones ───────────────────────────────────────────────
      async _validarEspecialidadesActivas(ids, client) {
        for (const id of ids) {
          const r = await client.query(
            "SELECT 1 FROM especialidades WHERE id = $1 AND activo = true",
            [id]
          );
          if (r.rows.length === 0) throw new EspecialidadInvalidaError(id);
        }
      }
      async _validarConsultoriosActivos(ids, client) {
        for (const id of ids) {
          const r = await client.query(
            "SELECT 1 FROM consultorios WHERE id = $1 AND activo = true AND deleted_at IS NULL",
            [id]
          );
          if (r.rows.length === 0) throw new ConsultorioInvalidoError(id);
        }
      }
      // ── Mapeo de fila a entidad ────────────────────────────────────────────────
      _filaAEntidad(row) {
        return new Medico({
          id: row.id,
          usuario_id: row.usuario_id,
          nombre: row.nombre,
          email: row.email,
          medico_mostrar: row.medico_mostrar,
          cedula_profesional: row.cedula_profesional,
          telefono: row.telefono,
          foto_url: row.foto_url,
          costo_consulta: row.costo_consulta === null ? null : Number(row.costo_consulta),
          activo: row.activo,
          especialidades: row.especialidades,
          consultorios: row.consultorios
        });
      }
      // ── listar ────────────────────────────────────────────────────────────────
      // RN-044: no-admin solo ve médicos activos con ≥1 especialidad activa.
      // RN-047: formato estable.
      async listar({
        incluirInactivos = false,
        soloConEspecialidad = false,
        especialidadId = null,
        consultorioId = null,
        q = null
      } = {}) {
        const condiciones = ["m.deleted_at IS NULL"];
        const valores = [];
        if (!incluirInactivos) {
          condiciones.push("m.activo = true");
        }
        if (especialidadId !== null) {
          valores.push(especialidadId);
          condiciones.push(`EXISTS (
        SELECT 1 FROM medico_especialidades me2
        WHERE me2.medico_id = m.id AND me2.especialidad_id = $${valores.length}
      )`);
        }
        if (consultorioId !== null) {
          valores.push(consultorioId);
          condiciones.push(`EXISTS (
        SELECT 1 FROM medico_consultorios mc2
        WHERE mc2.medico_id = m.id AND mc2.consultorio_id = $${valores.length}
      )`);
        }
        if (q && String(q).trim() !== "") {
          valores.push(`%${String(q).trim()}%`);
          condiciones.push(`(u.nombre ILIKE $${valores.length} OR m.cedula_profesional ILIKE $${valores.length})`);
        }
        if (soloConEspecialidad) {
          condiciones.push(`EXISTS (
        SELECT 1 FROM medico_especialidades me3
        JOIN especialidades e3 ON e3.id = me3.especialidad_id
        WHERE me3.medico_id = m.id AND e3.activo = true
      )`);
        }
        const sql = `
      ${SQL_MEDICO_COMPLETO}
      WHERE ${condiciones.join(" AND ")}
      GROUP BY m.id, u.nombre, u.email, m.cedula_profesional, m.telefono, m.foto_url, m.costo_consulta, m.activo, m.usuario_id
      ORDER BY u.nombre ASC
    `;
        const result = await db.query(sql, valores);
        return result.rows.map((r) => this._filaAEntidad(r));
      }
      // ── obtenerPorId ──────────────────────────────────────────────────────────
      async obtenerPorId(id, { soloActivo = false } = {}) {
        const condiciones = ["m.id = $1", "m.deleted_at IS NULL", "u.deleted_at IS NULL"];
        if (soloActivo) condiciones.push("m.activo = true");
        const sql = `
      ${SQL_MEDICO_COMPLETO}
      WHERE ${condiciones.join(" AND ")}
      GROUP BY m.id, u.nombre, u.email, m.cedula_profesional, m.telefono, m.foto_url, m.costo_consulta, m.activo, m.usuario_id
    `;
        const result = await db.query(sql, [id]);
        if (result.rows.length === 0) return null;
        return this._filaAEntidad(result.rows[0]);
      }
      // ── crear (RN-042: todo en una transacción) ───────────────────────────────
      async crear({
        nombre,
        email,
        password,
        cedula_profesional,
        telefono,
        foto_url = null,
        costo_consulta = null,
        especialidades = [],
        consultorios = []
      }) {
        const nombreNorm = this._normalizarNombre(nombre);
        const emailNorm = this._normalizarEmail(email);
        const telNorm = this._normalizarTelefono(telefono);
        const costoNorm = this._normalizarCosto(costo_consulta);
        const hash = await bcrypt.hash(password, 10);
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          if (especialidades.length > 0) await this._validarEspecialidadesActivas(especialidades, client);
          if (consultorios.length > 0) await this._validarConsultoriosActivos(consultorios, client);
          let usuarioResult;
          try {
            usuarioResult = await client.query(`
          INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
          VALUES (
            $1, $2, $3,
            (SELECT id FROM roles WHERE clave = 'medico'),
            (SELECT id FROM estados_cuenta WHERE clave = 'activo')
          )
          RETURNING id
        `, [nombreNorm, emailNorm, hash]);
          } catch (err) {
            if (err.code === "23505") throw new DuplicadoEmailError();
            throw err;
          }
          const usuario_id = usuarioResult.rows[0].id;
          let medicoResult;
          try {
            medicoResult = await client.query(`
          INSERT INTO medicos (usuario_id, cedula_profesional, telefono, foto_url, costo_consulta)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [usuario_id, cedula_profesional, telNorm, foto_url, costoNorm]);
          } catch (err) {
            if (err.code === "23505") throw new DuplicadoCedulaError();
            throw err;
          }
          const medico_id = medicoResult.rows[0].id;
          for (const espId of especialidades) {
            await client.query(
              "INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [medico_id, espId]
            );
          }
          for (const conId of consultorios) {
            await client.query(
              "INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [medico_id, conId]
            );
          }
          await client.query("COMMIT");
          return await this.obtenerPorId(medico_id);
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch (re) {
            console.error("[Medicos] Error en ROLLBACK de crear:", re.message);
          }
          throw err;
        } finally {
          client.release();
        }
      }
      // ── actualizar (nombre y email viven en usuarios) ─────────────────────────
      async actualizar(id, {
        nombre,
        email,
        cedula_profesional,
        telefono,
        password,
        foto_url,
        costo_consulta
      }) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const existe = await client.query(
            "SELECT usuario_id FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
            [id]
          );
          if (existe.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
          }
          const { usuario_id } = existe.rows[0];
          const camposU = [];
          const valsU = [];
          if (nombre !== void 0) {
            camposU.push(`nombre = $${valsU.length + 1}`);
            valsU.push(this._normalizarNombre(nombre));
          }
          if (email !== void 0) {
            camposU.push(`email = $${valsU.length + 1}`);
            valsU.push(this._normalizarEmail(email));
          }
          if (password && password.trim() !== "") {
            camposU.push(`password_hash = $${valsU.length + 1}`);
            valsU.push(await bcrypt.hash(password, 10));
          }
          if (camposU.length > 0) {
            valsU.push(usuario_id);
            try {
              await client.query(
                `UPDATE usuarios SET ${camposU.join(", ")} WHERE id = $${valsU.length} AND deleted_at IS NULL`,
                valsU
              );
            } catch (err) {
              if (err.code === "23505") throw new DuplicadoEmailError();
              throw err;
            }
          }
          const camposM = [];
          const valsM = [];
          if (cedula_profesional !== void 0) {
            camposM.push(`cedula_profesional = $${valsM.length + 1}`);
            valsM.push(cedula_profesional);
          }
          if (telefono !== void 0) {
            camposM.push(`telefono = $${valsM.length + 1}`);
            valsM.push(this._normalizarTelefono(telefono));
          }
          if (foto_url !== void 0) {
            camposM.push(`foto_url = $${valsM.length + 1}`);
            valsM.push(foto_url);
          }
          if (costo_consulta !== void 0) {
            camposM.push(`costo_consulta = $${valsM.length + 1}`);
            valsM.push(this._normalizarCosto(costo_consulta));
          }
          if (camposM.length > 0) {
            valsM.push(id);
            try {
              await client.query(
                `UPDATE medicos SET ${camposM.join(", ")} WHERE id = $${valsM.length} AND deleted_at IS NULL`,
                valsM
              );
            } catch (err) {
              if (err.code === "23505") throw new DuplicadoCedulaError();
              throw err;
            }
          }
          await client.query("COMMIT");
          return await this.obtenerPorId(id);
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch (re) {
            console.error("[Medicos] Error en ROLLBACK de actualizar:", re.message);
          }
          throw err;
        } finally {
          client.release();
        }
      }
      // ── cambiarEstado ──────────────────────────────────────────────────────────
      async cambiarEstado(id, activo) {
        const result = await db.query(
          `UPDATE medicos SET activo = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
          [activo, id]
        );
        if (result.rows.length === 0) return null;
        return await this.obtenerPorId(id);
      }
      // ── reemplazarEspecialidades (transacción: borra + inserta) ───────────────
      async reemplazarEspecialidades(id, especialidadIds) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const existe = await client.query(
            "SELECT 1 FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
            [id]
          );
          if (existe.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
          }
          if (especialidadIds.length > 0) await this._validarEspecialidadesActivas(especialidadIds, client);
          if (especialidadIds.length > 0) {
            await client.query(
              `DELETE FROM medico_especialidades
           WHERE medico_id = $1 AND especialidad_id <> ALL($2::smallint[])`,
              [id, especialidadIds]
            );
          } else {
            await client.query("DELETE FROM medico_especialidades WHERE medico_id = $1", [id]);
          }
          for (const espId of especialidadIds) {
            await client.query(
              "INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [id, espId]
            );
          }
          await client.query("COMMIT");
          return await this.obtenerPorId(id);
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch (re) {
            console.error("[Medicos] Error en ROLLBACK de reemplazarEspecialidades:", re.message);
          }
          throw err;
        } finally {
          client.release();
        }
      }
      // ── reemplazarConsultorios ────────────────────────────────────────────────
      async reemplazarConsultorios(id, consultorioIds) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const existe = await client.query(
            "SELECT 1 FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
            [id]
          );
          if (existe.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
          }
          if (consultorioIds.length > 0) await this._validarConsultoriosActivos(consultorioIds, client);
          if (consultorioIds.length > 0) {
            await client.query(
              `DELETE FROM medico_consultorios
           WHERE medico_id = $1 AND consultorio_id <> ALL($2::bigint[])`,
              [id, consultorioIds]
            );
          } else {
            await client.query("DELETE FROM medico_consultorios WHERE medico_id = $1", [id]);
          }
          for (const conId of consultorioIds) {
            await client.query(
              "INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [id, conId]
            );
          }
          await client.query("COMMIT");
          return await this.obtenerPorId(id);
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch (re) {
            console.error("[Medicos] Error en ROLLBACK de reemplazarConsultorios:", re.message);
          }
          throw err;
        } finally {
          client.release();
        }
      }
      // ── eliminar (RN-045: soft delete en medicos + usuario, con check de citas) ─
      async eliminar(id) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const existe = await client.query(
            "SELECT usuario_id FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
            [id]
          );
          if (existe.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
          }
          const { usuario_id } = existe.rows[0];
          const citas = await client.query(`
        SELECT 1 FROM citas
        WHERE medico_id = $1
          AND estado_id IN (
            SELECT id FROM estados_cita WHERE clave IN ('pendiente','confirmada','reagendada')
          )
          AND fecha_hora > now()
        LIMIT 1
      `, [id]);
          if (citas.rows.length > 0) {
            await client.query("ROLLBACK");
            throw new CitasPendientesError();
          }
          await client.query(
            "UPDATE medicos  SET deleted_at = now() WHERE id = $1",
            [id]
          );
          await client.query(
            "UPDATE usuarios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
            [usuario_id]
          );
          await client.query("COMMIT");
          return { id };
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch (re) {
            console.error("[Medicos] Error en ROLLBACK de eliminar:", re.message);
          }
          throw err;
        } finally {
          client.release();
        }
      }
    };
    module2.exports = {
      PostgresMedicoRepository,
      DuplicadoEmailError,
      DuplicadoCedulaError,
      CitasPendientesError,
      EspecialidadInvalidaError,
      ConsultorioInvalidoError
    };
  }
});

// src/application/use-cases/RegistrarMedico.js
var require_RegistrarMedico = __commonJS({
  "src/application/use-cases/RegistrarMedico.js"(exports2, module2) {
    "use strict";
    var RegistrarMedico = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(datos) {
        return this.repo.crear(datos);
      }
    };
    module2.exports = RegistrarMedico;
  }
});

// src/application/use-cases/MedicoUseCases.js
var require_MedicoUseCases = __commonJS({
  "src/application/use-cases/MedicoUseCases.js"(exports2, module2) {
    "use strict";
    var ListarMedicos = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(opciones) {
        return this.repo.listar(opciones);
      }
    };
    var ObtenerMedicoPorId = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(id, opts) {
        return this.repo.obtenerPorId(id, opts);
      }
    };
    var ActualizarMedico = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(id, datos) {
        return this.repo.actualizar(id, datos);
      }
    };
    var CambiarEstadoMedico = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(id, activo) {
        return this.repo.cambiarEstado(id, activo);
      }
    };
    var ReemplazarEspecialidadesMedico = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(id, ids) {
        return this.repo.reemplazarEspecialidades(id, ids);
      }
    };
    var ReemplazarConsultoriosMedico = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(id, ids) {
        return this.repo.reemplazarConsultorios(id, ids);
      }
    };
    var EliminarMedico = class {
      constructor(repo) {
        this.repo = repo;
      }
      async execute(id) {
        return this.repo.eliminar(id);
      }
    };
    module2.exports = {
      ListarMedicos,
      ObtenerMedicoPorId,
      ActualizarMedico,
      CambiarEstadoMedico,
      ReemplazarEspecialidadesMedico,
      ReemplazarConsultoriosMedico,
      EliminarMedico
    };
  }
});

// src/interfaces/http/controllers/MedicosController.js
var require_MedicosController = __commonJS({
  "src/interfaces/http/controllers/MedicosController.js"(exports2, module2) {
    "use strict";
    var {
      PostgresMedicoRepository,
      DuplicadoEmailError,
      DuplicadoCedulaError,
      CitasPendientesError,
      EspecialidadInvalidaError,
      ConsultorioInvalidoError
    } = require_PostgresMedicoRepository();
    var RegistrarMedico = require_RegistrarMedico();
    var {
      ListarMedicos,
      ObtenerMedicoPorId,
      ActualizarMedico,
      CambiarEstadoMedico,
      ReemplazarEspecialidadesMedico,
      ReemplazarConsultoriosMedico,
      EliminarMedico
    } = require_MedicoUseCases();
    var validarId = require_validarId();
    var repo = new PostgresMedicoRepository();
    var rolesValidos = { 1: "admin", 2: "medico", 3: "paciente" };
    function rolClave(usuario) {
      return rolesValidos[usuario?.rol_id] || null;
    }
    function esAdmin(usuario) {
      return rolClave(usuario) === "admin";
    }
    function validarTelefono(telefono) {
      if (telefono === void 0 || telefono === null || telefono === "") return null;
      const soloDigitos = String(telefono).replace(/[\s\-()]/g, "");
      if (soloDigitos === "") return null;
      if (!/^[0-9]{7,15}$/.test(soloDigitos)) {
        return "El tel\xE9fono debe tener entre 7 y 15 d\xEDgitos num\xE9ricos";
      }
      return null;
    }
    function validarNombre(nombre, campo = "nombre") {
      if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
        return `El campo "${campo}" es requerido`;
      }
      return null;
    }
    function validarArrayIds(arr, tipo, campo) {
      if (!Array.isArray(arr)) return `"${campo}" debe ser un arreglo`;
      for (const id of arr) {
        const n = validarId(id, tipo);
        if (!n) return `ID inv\xE1lido en "${campo}": ${id}`;
      }
      return null;
    }
    function normalizarArrayIds(valor) {
      if (Array.isArray(valor)) return valor;
      if (valor === void 0 || valor === null || valor === "") return [];
      if (typeof valor !== "string") return valor;
      const texto = valor.trim();
      if (!texto) return [];
      try {
        const parsed = JSON.parse(texto);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
      }
      return texto.split(",").map((s) => s.trim()).filter(Boolean);
    }
    function validarCostoConsulta(valor) {
      if (valor === void 0) return { ok: true, valor: void 0 };
      if (valor === null || String(valor).trim() === "") return { ok: true, valor: null };
      const numero = Number(String(valor).trim());
      if (!Number.isFinite(numero) || numero < 0) {
        return { ok: false, mensaje: "El costo de consulta debe ser un n\xFAmero mayor o igual a 0" };
      }
      if (numero > 9999999999e-2) {
        return { ok: false, mensaje: "El costo de consulta excede el m\xE1ximo permitido" };
      }
      return { ok: true, valor: Number(numero.toFixed(2)) };
    }
    function esErrorDeDatos(error) {
      return error.code === "22003" || error.code === "22P02";
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      console.error("[Medicos] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    function serializar(medico, admin) {
      return admin ? medico.toPublicDTO() : medico.toPublicDTOReducido();
    }
    async function listar(req, res) {
      try {
        const admin = esAdmin(req.usuario);
        const incluirInactivos = req.query.todos === "true" && admin;
        const soloConEspecialidad = !admin;
        const esSinFiltro = (valor) => {
          const texto = String(valor ?? "").trim().toLowerCase();
          return texto === "" || texto === "null" || texto === "undefined";
        };
        let especialidadId = null;
        if (req.query.especialidad && !esSinFiltro(req.query.especialidad)) {
          especialidadId = validarId(req.query.especialidad, "smallint");
          if (!especialidadId) return res.status(400).json({ ok: false, mensaje: "ID de especialidad inv\xE1lido" });
        }
        let consultorioId = null;
        if (req.query.consultorio && !esSinFiltro(req.query.consultorio)) {
          consultorioId = validarId(req.query.consultorio, "bigint");
          if (!consultorioId) return res.status(400).json({ ok: false, mensaje: "ID de consultorio inv\xE1lido" });
        }
        const caso = new ListarMedicos(repo);
        const medicos = await caso.execute({
          incluirInactivos,
          soloConEspecialidad,
          especialidadId,
          consultorioId,
          q: req.query.q || null
        });
        return res.json({
          ok: true,
          mensaje: "Lista de m\xE9dicos",
          data: medicos.map((m) => serializar(m, admin))
        });
      } catch (error) {
        return respuestaError500(res, "Error al obtener m\xE9dicos", error);
      }
    }
    async function obtenerPorId(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const admin = esAdmin(req.usuario);
        const caso = new ObtenerMedicoPorId(repo);
        const medico = await caso.execute(id);
        if (!medico) return res.status(404).json({ ok: false, mensaje: "M\xE9dico no encontrado" });
        return res.json({ ok: true, mensaje: "M\xE9dico encontrado", data: serializar(medico, admin) });
      } catch (error) {
        return respuestaError500(res, "Error al obtener m\xE9dico", error);
      }
    }
    async function crear(req, res) {
      try {
        const {
          nombre,
          email,
          password,
          cedula_profesional,
          telefono,
          costo_consulta,
          especialidades = [],
          consultorios = []
        } = req.body || {};
        const errNombre = validarNombre(nombre);
        if (errNombre) return res.status(400).json({ ok: false, mensaje: errNombre });
        if (!email || typeof email !== "string" || !email.trim()) {
          return res.status(400).json({ ok: false, mensaje: 'El campo "email" es requerido' });
        }
        if (!password || typeof password !== "string" || password.length < 8) {
          return res.status(400).json({ ok: false, mensaje: "La contrase\xF1a debe tener al menos 8 caracteres" });
        }
        if (!cedula_profesional || typeof cedula_profesional !== "string" || !cedula_profesional.trim()) {
          return res.status(400).json({ ok: false, mensaje: 'El campo "cedula_profesional" es requerido' });
        }
        const errTel = validarTelefono(telefono);
        if (errTel) return res.status(400).json({ ok: false, mensaje: errTel });
        const costo = validarCostoConsulta(costo_consulta);
        if (!costo.ok) return res.status(400).json({ ok: false, mensaje: costo.mensaje });
        const especialidadesNorm = normalizarArrayIds(especialidades);
        const consultoriosNorm = normalizarArrayIds(consultorios);
        const errEsp = validarArrayIds(especialidadesNorm, "smallint", "especialidades");
        if (errEsp) return res.status(400).json({ ok: false, mensaje: errEsp });
        const errCon = validarArrayIds(consultoriosNorm, "bigint", "consultorios");
        if (errCon) return res.status(400).json({ ok: false, mensaje: errCon });
        const fotoUrl = req.file ? `/uploads/medicos/${req.file.filename}` : null;
        const caso = new RegistrarMedico(repo);
        const medico = await caso.execute({
          nombre,
          email,
          password,
          cedula_profesional,
          telefono,
          foto_url: fotoUrl,
          costo_consulta: costo.valor ?? null,
          especialidades: especialidadesNorm,
          consultorios: consultoriosNorm
        });
        return res.status(201).json({ ok: true, mensaje: "M\xE9dico creado correctamente", data: medico.toPublicDTO() });
      } catch (error) {
        if (error instanceof DuplicadoEmailError) return res.status(409).json({ ok: false, mensaje: error.message });
        if (error instanceof DuplicadoCedulaError) return res.status(409).json({ ok: false, mensaje: error.message });
        if (error instanceof EspecialidadInvalidaError) return res.status(400).json({ ok: false, mensaje: error.message });
        if (error instanceof ConsultorioInvalidoError) return res.status(400).json({ ok: false, mensaje: error.message });
        return respuestaError500(res, "Error al crear m\xE9dico", error);
      }
    }
    async function actualizar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const {
          nombre,
          email,
          cedula_profesional,
          telefono,
          password,
          costo_consulta
        } = req.body || {};
        if (nombre === void 0 && email === void 0 && cedula_profesional === void 0 && telefono === void 0 && password === void 0 && costo_consulta === void 0 && !req.file) {
          return res.status(400).json({ ok: false, mensaje: "No hay campos para actualizar" });
        }
        if (nombre !== void 0) {
          const err = validarNombre(nombre);
          if (err) return res.status(400).json({ ok: false, mensaje: err });
        }
        if (password !== void 0 && password !== "" && password.length < 8) {
          return res.status(400).json({ ok: false, mensaje: "La contrase\xF1a debe tener al menos 8 caracteres" });
        }
        if (telefono !== void 0) {
          const errTel = validarTelefono(telefono);
          if (errTel) return res.status(400).json({ ok: false, mensaje: errTel });
        }
        const costo = validarCostoConsulta(costo_consulta);
        if (!costo.ok) return res.status(400).json({ ok: false, mensaje: costo.mensaje });
        const fotoUrl = req.file ? `/uploads/medicos/${req.file.filename}` : void 0;
        const caso = new ActualizarMedico(repo);
        const medico = await caso.execute(id, {
          nombre,
          email,
          cedula_profesional,
          telefono,
          password,
          foto_url: fotoUrl,
          costo_consulta: costo.valor
        });
        if (!medico) return res.status(404).json({ ok: false, mensaje: "M\xE9dico no encontrado" });
        return res.json({ ok: true, mensaje: "M\xE9dico actualizado correctamente", data: medico.toPublicDTO() });
      } catch (error) {
        if (error instanceof DuplicadoEmailError) return res.status(409).json({ ok: false, mensaje: error.message });
        if (error instanceof DuplicadoCedulaError) return res.status(409).json({ ok: false, mensaje: error.message });
        return respuestaError500(res, "Error al actualizar m\xE9dico", error);
      }
    }
    async function cambiarEstado(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const { activo } = req.body || {};
        if (typeof activo !== "boolean") {
          return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
        }
        const caso = new CambiarEstadoMedico(repo);
        const medico = await caso.execute(id, activo);
        if (!medico) return res.status(404).json({ ok: false, mensaje: "M\xE9dico no encontrado" });
        return res.json({
          ok: true,
          mensaje: activo ? "M\xE9dico activado" : "M\xE9dico desactivado",
          data: medico.toPublicDTO()
        });
      } catch (error) {
        return respuestaError500(res, "Error al cambiar estado del m\xE9dico", error);
      }
    }
    async function reemplazarEspecialidades(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const { especialidades } = req.body || {};
        const err = validarArrayIds(especialidades ?? [], "smallint", "especialidades");
        if (err) return res.status(400).json({ ok: false, mensaje: err });
        const caso = new ReemplazarEspecialidadesMedico(repo);
        const medico = await caso.execute(id, especialidades ?? []);
        if (!medico) return res.status(404).json({ ok: false, mensaje: "M\xE9dico no encontrado" });
        return res.json({ ok: true, mensaje: "Especialidades actualizadas", data: medico.toPublicDTO() });
      } catch (error) {
        if (error instanceof EspecialidadInvalidaError) return res.status(400).json({ ok: false, mensaje: error.message });
        return respuestaError500(res, "Error al actualizar especialidades", error);
      }
    }
    async function reemplazarConsultorios(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const { consultorios } = req.body || {};
        const err = validarArrayIds(consultorios ?? [], "bigint", "consultorios");
        if (err) return res.status(400).json({ ok: false, mensaje: err });
        const caso = new ReemplazarConsultoriosMedico(repo);
        const medico = await caso.execute(id, consultorios ?? []);
        if (!medico) return res.status(404).json({ ok: false, mensaje: "M\xE9dico no encontrado" });
        return res.json({ ok: true, mensaje: "Consultorios actualizados", data: medico.toPublicDTO() });
      } catch (error) {
        if (error instanceof ConsultorioInvalidoError) return res.status(400).json({ ok: false, mensaje: error.message });
        return respuestaError500(res, "Error al actualizar consultorios", error);
      }
    }
    async function eliminar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const caso = new EliminarMedico(repo);
        const resultado = await caso.execute(id);
        if (!resultado) return res.status(404).json({ ok: false, mensaje: "M\xE9dico no encontrado" });
        return res.json({ ok: true, mensaje: "M\xE9dico eliminado correctamente", data: resultado });
      } catch (error) {
        if (error instanceof CitasPendientesError) return res.status(409).json({ ok: false, mensaje: error.message });
        return respuestaError500(res, "Error al eliminar m\xE9dico", error);
      }
    }
    module2.exports = {
      listar,
      obtenerPorId,
      crear,
      actualizar,
      cambiarEstado,
      reemplazarEspecialidades,
      reemplazarConsultorios,
      eliminar
    };
  }
});

// src/interfaces/http/middlewares/uploadMiddleware.js
var require_uploadMiddleware = __commonJS({
  "src/interfaces/http/middlewares/uploadMiddleware.js"(exports2, module2) {
    "use strict";
    var multer = require("multer");
    var path2 = require("path");
    var fs2 = require("fs");
    var { randomUUID } = require("crypto");
    var UPLOADS_ROOT = process.env.UPLOADS_DIR || path2.join(__dirname, "..", "..", "..", "..", "uploads");
    var DIR_PERFILES = path2.join(UPLOADS_ROOT, "perfiles");
    var DIR_MEDICOS = path2.join(UPLOADS_ROOT, "medicos");
    for (const dir of [DIR_PERFILES, DIR_MEDICOS]) {
      if (!fs2.existsSync(dir)) {
        fs2.mkdirSync(dir, { recursive: true });
      }
    }
    var EXT_POR_MIME = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif"
    };
    function crearStorage(destino, prefijo) {
      return multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, destino),
        filename: (_req, file, cb) => {
          const ext = EXT_POR_MIME[file.mimetype] || ".img";
          cb(null, `${prefijo}-${randomUUID()}${ext}`);
        }
      });
    }
    function fileFilter(_req, file, cb) {
      if (EXT_POR_MIME[file.mimetype]) {
        cb(null, true);
      } else {
        cb(new Error("Solo se permiten im\xE1genes JPG, PNG, WEBP o GIF"), false);
      }
    }
    function crearUpload(storage) {
      return multer({
        storage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 }
        // 5 MB máximo
      });
    }
    var uploadPerfil = crearUpload(crearStorage(DIR_PERFILES, "perfil"));
    var uploadMedico = crearUpload(crearStorage(DIR_MEDICOS, "medico"));
    function crearSingle(upload, field) {
      return (req, res, next) => {
        upload.single(field)(req, res, (err) => {
          if (!err) return next();
          if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
              return res.status(400).json({ ok: false, mensaje: "La imagen no puede superar los 5 MB" });
            }
            return res.status(400).json({ ok: false, mensaje: "Error al subir la imagen" });
          }
          return res.status(400).json({ ok: false, mensaje: err.message || "Archivo no v\xE1lido" });
        });
      };
    }
    var single = (field) => crearSingle(uploadPerfil, field);
    var singleMedico = (field) => crearSingle(uploadMedico, field);
    module2.exports = { upload: uploadPerfil, single, singleMedico };
  }
});

// src/interfaces/http/routes/medicos.routes.js
var require_medicos_routes = __commonJS({
  "src/interfaces/http/routes/medicos.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_MedicosController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    var { singleMedico } = require_uploadMiddleware();
    router.get("/", authMiddleware, ctrl.listar);
    router.get("/:id", authMiddleware, ctrl.obtenerPorId);
    router.post("/", authMiddleware, roleMiddleware("admin"), singleMedico("foto"), ctrl.crear);
    router.put("/:id", authMiddleware, roleMiddleware("admin"), singleMedico("foto"), ctrl.actualizar);
    router.patch("/:id/estado", authMiddleware, roleMiddleware("admin"), ctrl.cambiarEstado);
    router.put("/:id/especialidades", authMiddleware, roleMiddleware("admin"), ctrl.reemplazarEspecialidades);
    router.put("/:id/consultorios", authMiddleware, roleMiddleware("admin"), ctrl.reemplazarConsultorios);
    router.delete("/:id", authMiddleware, roleMiddleware("admin"), ctrl.eliminar);
    module2.exports = router;
  }
});

// src/domain/ports/ConsultorioRepository.js
var require_ConsultorioRepository = __commonJS({
  "src/domain/ports/ConsultorioRepository.js"(exports2, module2) {
    "use strict";
    var ConsultorioRepository = class {
      async listar({ incluirInactivos = false, q = null } = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerPorId(id) {
        throw new Error("M\xE9todo no implementado");
      }
      async crear({ nombre, direccion, telefono }) {
        throw new Error("M\xE9todo no implementado");
      }
      async actualizar(id, { nombre, direccion, telefono }) {
        throw new Error("M\xE9todo no implementado");
      }
      async cambiarEstado(id, activo) {
        throw new Error("M\xE9todo no implementado");
      }
      async eliminar(id) {
        throw new Error("M\xE9todo no implementado");
      }
    };
    module2.exports = ConsultorioRepository;
  }
});

// src/infrastructure/adapters/PostgresConsultorioRepository.js
var require_PostgresConsultorioRepository = __commonJS({
  "src/infrastructure/adapters/PostgresConsultorioRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var ConsultorioRepository = require_ConsultorioRepository();
    var DuplicadoError = class extends Error {
      constructor(mensaje) {
        super(mensaje);
        this.name = "DuplicadoError";
      }
    };
    var CitasPendientesError = class extends Error {
      constructor(mensaje) {
        super(mensaje);
        this.name = "CitasPendientesError";
      }
    };
    var COLUMNAS = "id, nombre, direccion, telefono, activo, created_at";
    var PostgresConsultorioRepository = class extends ConsultorioRepository {
      normalizarNombre(nombre) {
        return String(nombre).trim().replace(/\s+/g, " ");
      }
      normalizarDireccion(direccion) {
        return String(direccion).trim().replace(/\s+/g, " ");
      }
      // Solo dígitos: quita guiones, espacios y paréntesis. Vacío → null.
      normalizarTelefono(telefono) {
        if (telefono === void 0 || telefono === null) return null;
        const soloDigitos = String(telefono).replace(/[\s\-()]/g, "");
        return soloDigitos === "" ? null : soloDigitos;
      }
      async _existeNombre(nombre, excluirId = null) {
        const parametros = [nombre];
        let sql = "SELECT 1 FROM consultorios WHERE lower(nombre) = lower($1) AND deleted_at IS NULL";
        if (excluirId !== null) {
          parametros.push(excluirId);
          sql += " AND id <> $2";
        }
        const result = await db.query(sql, parametros);
        return result.rows.length > 0;
      }
      // RN-034: por defecto solo activos y no eliminados; el admin puede pedir todos.
      // RN-033/RN-110: nunca se devuelven consultorios con deleted_at.
      async listar({ incluirInactivos = false, q = null } = {}) {
        const condiciones = ["deleted_at IS NULL"];
        const valores = [];
        if (!incluirInactivos) {
          condiciones.push("activo = true");
        }
        if (q && String(q).trim() !== "") {
          valores.push(`%${String(q).trim()}%`);
          condiciones.push(`(nombre ILIKE $${valores.length} OR direccion ILIKE $${valores.length})`);
        }
        const sql = `SELECT ${COLUMNAS} FROM consultorios
                 WHERE ${condiciones.join(" AND ")}
                 ORDER BY nombre ASC`;
        const result = await db.query(sql, valores);
        return result.rows;
      }
      async obtenerPorId(id) {
        const result = await db.query(
          `SELECT ${COLUMNAS} FROM consultorios WHERE id = $1 AND deleted_at IS NULL`,
          [id]
        );
        return result.rows[0] || null;
      }
      async crear({ nombre, direccion, telefono }) {
        const nombreNormalizado = this.normalizarNombre(nombre);
        const direccionNormalizada = this.normalizarDireccion(direccion);
        const telefonoNormalizado = this.normalizarTelefono(telefono);
        if (await this._existeNombre(nombreNormalizado)) {
          throw new DuplicadoError("Ya existe un consultorio con ese nombre");
        }
        try {
          const result = await db.query(
            `INSERT INTO consultorios (nombre, direccion, telefono)
         VALUES ($1, $2, $3)
         RETURNING ${COLUMNAS}`,
            [nombreNormalizado, direccionNormalizada, telefonoNormalizado]
          );
          return result.rows[0];
        } catch (error) {
          if (error.code === "23505") {
            throw new DuplicadoError("Ya existe un consultorio con ese nombre");
          }
          throw error;
        }
      }
      async actualizar(id, { nombre, direccion, telefono }) {
        const campos = [];
        const valores = [];
        if (nombre !== void 0) {
          const nombreNormalizado = this.normalizarNombre(nombre);
          if (await this._existeNombre(nombreNormalizado, id)) {
            throw new DuplicadoError("Ya existe un consultorio con ese nombre");
          }
          valores.push(nombreNormalizado);
          campos.push(`nombre = $${valores.length}`);
        }
        if (direccion !== void 0) {
          valores.push(this.normalizarDireccion(direccion));
          campos.push(`direccion = $${valores.length}`);
        }
        if (telefono !== void 0) {
          valores.push(this.normalizarTelefono(telefono));
          campos.push(`telefono = $${valores.length}`);
        }
        if (campos.length === 0) return null;
        valores.push(id);
        try {
          const result = await db.query(
            `UPDATE consultorios SET ${campos.join(", ")}
         WHERE id = $${valores.length} AND deleted_at IS NULL
         RETURNING ${COLUMNAS}`,
            valores
          );
          return result.rows[0] || null;
        } catch (error) {
          if (error.code === "23505") {
            throw new DuplicadoError("Ya existe un consultorio con ese nombre");
          }
          throw error;
        }
      }
      async cambiarEstado(id, activo) {
        const result = await db.query(
          `UPDATE consultorios SET activo = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING ${COLUMNAS}`,
          [activo, id]
        );
        return result.rows[0] || null;
      }
      // RN-033: borrado lógico. RN-112: verificación + update en transacción.
      async eliminar(id) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          const existe = await client.query(
            "SELECT 1 FROM consultorios WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
            [id]
          );
          if (existe.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
          }
          const citas = await client.query(
            `SELECT 1 FROM citas
         WHERE consultorio_id = $1
           AND estado_id IN (
             SELECT id FROM estados_cita WHERE clave IN ('pendiente','confirmada','reagendada')
           )
           AND fecha_hora > now()
         LIMIT 1`,
            [id]
          );
          if (citas.rows.length > 0) {
            await client.query("ROLLBACK");
            throw new CitasPendientesError("El consultorio tiene citas pendientes");
          }
          await client.query("UPDATE consultorios SET deleted_at = now() WHERE id = $1", [id]);
          await client.query("COMMIT");
          return { id };
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            console.error("[Consultorios] Error al revertir transacci\xF3n:", rollbackError.message);
          }
          throw error;
        } finally {
          client.release();
        }
      }
    };
    module2.exports = {
      PostgresConsultorioRepository,
      DuplicadoError,
      CitasPendientesError
    };
  }
});

// src/application/use-cases/CrearConsultorio.js
var require_CrearConsultorio = __commonJS({
  "src/application/use-cases/CrearConsultorio.js"(exports2, module2) {
    "use strict";
    var CrearConsultorio = class {
      constructor(consultorioRepository) {
        this.repo = consultorioRepository;
      }
      async execute(datos) {
        return this.repo.crear(datos);
      }
    };
    module2.exports = CrearConsultorio;
  }
});

// src/application/use-cases/ActualizarConsultorio.js
var require_ActualizarConsultorio = __commonJS({
  "src/application/use-cases/ActualizarConsultorio.js"(exports2, module2) {
    "use strict";
    var ActualizarConsultorio = class {
      constructor(consultorioRepository) {
        this.repo = consultorioRepository;
      }
      async execute(id, datos) {
        return this.repo.actualizar(id, datos);
      }
    };
    module2.exports = ActualizarConsultorio;
  }
});

// src/application/use-cases/CambiarEstadoConsultorio.js
var require_CambiarEstadoConsultorio = __commonJS({
  "src/application/use-cases/CambiarEstadoConsultorio.js"(exports2, module2) {
    "use strict";
    var CambiarEstadoConsultorio = class {
      constructor(consultorioRepository) {
        this.repo = consultorioRepository;
      }
      async execute(id, activo) {
        return this.repo.cambiarEstado(id, activo);
      }
    };
    module2.exports = CambiarEstadoConsultorio;
  }
});

// src/application/use-cases/EliminarConsultorio.js
var require_EliminarConsultorio = __commonJS({
  "src/application/use-cases/EliminarConsultorio.js"(exports2, module2) {
    "use strict";
    var EliminarConsultorio = class {
      constructor(consultorioRepository) {
        this.repo = consultorioRepository;
      }
      async execute(id) {
        return this.repo.eliminar(id);
      }
    };
    module2.exports = EliminarConsultorio;
  }
});

// src/interfaces/http/controllers/ConsultoriosController.js
var require_ConsultoriosController = __commonJS({
  "src/interfaces/http/controllers/ConsultoriosController.js"(exports2, module2) {
    "use strict";
    var {
      PostgresConsultorioRepository,
      DuplicadoError,
      CitasPendientesError
    } = require_PostgresConsultorioRepository();
    var CrearConsultorio = require_CrearConsultorio();
    var ActualizarConsultorio = require_ActualizarConsultorio();
    var CambiarEstadoConsultorio = require_CambiarEstadoConsultorio();
    var EliminarConsultorio = require_EliminarConsultorio();
    var validarId = require_validarId();
    var repo = new PostgresConsultorioRepository();
    function esAdmin(usuario) {
      return usuario?.rol_id === 1;
    }
    function validarTextoObligatorio(valor, campo) {
      if (valor === void 0 || valor === null || typeof valor !== "string" || valor.trim() === "") {
        return `El campo ${campo} es requerido`;
      }
      return null;
    }
    function validarTelefono(telefono) {
      if (telefono === void 0 || telefono === null || telefono === "") return null;
      if (typeof telefono !== "string" && typeof telefono !== "number") {
        return "El tel\xE9fono debe ser texto";
      }
      const soloDigitos = String(telefono).replace(/[\s\-()]/g, "");
      if (soloDigitos === "") return null;
      if (!/^[0-9]{7,15}$/.test(soloDigitos)) {
        return "El tel\xE9fono debe tener entre 7 y 15 d\xEDgitos";
      }
      return null;
    }
    function esErrorDeDatos(error) {
      return error.code === "22003" || error.code === "22P02";
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      console.error("[Consultorios] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    async function listar(req, res) {
      try {
        const incluirInactivos = req.query.todos === "true" && esAdmin(req.usuario);
        const data = await repo.listar({ incluirInactivos, q: req.query.q });
        return res.json({ ok: true, mensaje: "Lista de consultorios", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener consultorios", error);
      }
    }
    async function obtenerPorId(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const data = await repo.obtenerPorId(id);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Consultorio no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Consultorio encontrado", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener consultorio", error);
      }
    }
    async function crear(req, res) {
      try {
        const { nombre, direccion, telefono } = req.body || {};
        const errorNombre = validarTextoObligatorio(nombre, "nombre");
        if (errorNombre) return res.status(400).json({ ok: false, mensaje: errorNombre });
        const errorDireccion = validarTextoObligatorio(direccion, "direccion");
        if (errorDireccion) return res.status(400).json({ ok: false, mensaje: errorDireccion });
        const errorTelefono = validarTelefono(telefono);
        if (errorTelefono) return res.status(400).json({ ok: false, mensaje: errorTelefono });
        const caso = new CrearConsultorio(repo);
        const data = await caso.execute({ nombre, direccion, telefono });
        return res.status(201).json({ ok: true, mensaje: "Consultorio creado correctamente", data });
      } catch (error) {
        if (error instanceof DuplicadoError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al crear consultorio", error);
      }
    }
    async function actualizar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const { nombre, direccion, telefono } = req.body || {};
        const errorNombre = validarTextoObligatorio(nombre, "nombre");
        if (errorNombre) return res.status(400).json({ ok: false, mensaje: errorNombre });
        const errorDireccion = validarTextoObligatorio(direccion, "direccion");
        if (errorDireccion) return res.status(400).json({ ok: false, mensaje: errorDireccion });
        const errorTelefono = validarTelefono(telefono);
        if (errorTelefono) return res.status(400).json({ ok: false, mensaje: errorTelefono });
        const caso = new ActualizarConsultorio(repo);
        const data = await caso.execute(id, { nombre, direccion, telefono });
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Consultorio no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Consultorio actualizado correctamente", data });
      } catch (error) {
        if (error instanceof DuplicadoError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al actualizar consultorio", error);
      }
    }
    async function cambiarEstado(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const { activo } = req.body || {};
        if (typeof activo !== "boolean") {
          return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
        }
        const caso = new CambiarEstadoConsultorio(repo);
        const data = await caso.execute(id, activo);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Consultorio no encontrado" });
        }
        return res.json({
          ok: true,
          mensaje: activo ? "Consultorio activado" : "Consultorio desactivado",
          data
        });
      } catch (error) {
        return respuestaError500(res, "Error al cambiar el estado", error);
      }
    }
    async function eliminar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const caso = new EliminarConsultorio(repo);
        const data = await caso.execute(id);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Consultorio no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Consultorio eliminado correctamente", data });
      } catch (error) {
        if (error instanceof CitasPendientesError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al eliminar consultorio", error);
      }
    }
    module2.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };
  }
});

// src/interfaces/http/routes/consultorios.routes.js
var require_consultorios_routes = __commonJS({
  "src/interfaces/http/routes/consultorios.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_ConsultoriosController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.get("/", authMiddleware, ctrl.listar);
    router.get("/:id", authMiddleware, ctrl.obtenerPorId);
    router.post("/", authMiddleware, roleMiddleware("admin"), ctrl.crear);
    router.put("/:id", authMiddleware, roleMiddleware("admin"), ctrl.actualizar);
    router.patch("/:id/estado", authMiddleware, roleMiddleware("admin"), ctrl.cambiarEstado);
    router.delete("/:id", authMiddleware, roleMiddleware("admin"), ctrl.eliminar);
    module2.exports = router;
  }
});

// src/infrastructure/adapters/PostgresEspecialidadRepository.js
var require_PostgresEspecialidadRepository = __commonJS({
  "src/infrastructure/adapters/PostgresEspecialidadRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var DuplicadoError = class extends Error {
      constructor(mensaje) {
        super(mensaje);
        this.name = "DuplicadoError";
      }
    };
    var PostgresEspecialidadRepository = class {
      normalizarNombre(nombre) {
        return nombre.trim().replace(/\s+/g, " ");
      }
      normalizarDescripcion(descripcion) {
        if (descripcion === void 0 || descripcion === null) return null;
        const limpia = descripcion.trim().replace(/\s+/g, " ");
        return limpia === "" ? null : limpia;
      }
      async crear(nombre, descripcion) {
        const nombreNormalizado = this.normalizarNombre(nombre);
        const descripcionNormalizada = this.normalizarDescripcion(descripcion);
        const duplicado = await db.query(
          "SELECT 1 FROM especialidades WHERE lower(nombre) = lower($1)",
          [nombreNormalizado]
        );
        if (duplicado.rows.length > 0) {
          throw new DuplicadoError("Ya existe una especialidad con ese nombre");
        }
        try {
          const result = await db.query(
            "INSERT INTO especialidades (nombre, descripcion) VALUES ($1, $2) RETURNING id, nombre, descripcion, activo",
            [nombreNormalizado, descripcionNormalizada]
          );
          return result.rows[0];
        } catch (error) {
          if (error.code === "23505") {
            throw new DuplicadoError("Ya existe una especialidad con ese nombre");
          }
          throw error;
        }
      }
      async actualizar(id, { nombre, descripcion }) {
        const campos = [];
        const valores = [];
        let indice = 1;
        if (nombre !== void 0) {
          const nombreNormalizado = this.normalizarNombre(nombre);
          const duplicado = await db.query(
            "SELECT 1 FROM especialidades WHERE lower(nombre) = lower($1) AND id <> $2",
            [nombreNormalizado, id]
          );
          if (duplicado.rows.length > 0) {
            throw new DuplicadoError("Ya existe una especialidad con ese nombre");
          }
          campos.push(`nombre = $${indice++}`);
          valores.push(nombreNormalizado);
        }
        if (descripcion !== void 0) {
          const descripcionNormalizada = this.normalizarDescripcion(descripcion);
          campos.push(`descripcion = $${indice++}`);
          valores.push(descripcionNormalizada);
        }
        if (campos.length === 0) return null;
        valores.push(id);
        try {
          const result = await db.query(
            `UPDATE especialidades SET ${campos.join(", ")} WHERE id = $${indice} RETURNING id, nombre, descripcion, activo`,
            valores
          );
          if (result.rows.length === 0) return null;
          return result.rows[0];
        } catch (error) {
          if (error.code === "23505") {
            throw new DuplicadoError("Ya existe una especialidad con ese nombre");
          }
          throw error;
        }
      }
      // RN-031: por defecto solo activas; con incluirInactivas devuelve todas
      async listar({ incluirInactivas = false } = {}) {
        const sql = incluirInactivas ? "SELECT id, nombre, descripcion, activo FROM especialidades ORDER BY nombre ASC" : "SELECT id, nombre, descripcion, activo FROM especialidades WHERE activo = true ORDER BY nombre ASC";
        const result = await db.query(sql);
        return result.rows;
      }
      async cambiarEstado(id, activo) {
        const result = await db.query(
          "UPDATE especialidades SET activo = $1 WHERE id = $2 RETURNING id, nombre, descripcion, activo",
          [activo, id]
        );
        return result.rows[0] || null;
      }
      async obtenerPorId(id) {
        const result = await db.query("SELECT id, nombre, descripcion, activo FROM especialidades WHERE id = $1", [id]);
        if (result.rows.length === 0) return null;
        return result.rows[0];
      }
    };
    module2.exports = { PostgresEspecialidadRepository, DuplicadoError };
  }
});

// src/application/use-cases/CrearEspecialidad.js
var require_CrearEspecialidad = __commonJS({
  "src/application/use-cases/CrearEspecialidad.js"(exports2, module2) {
    "use strict";
    var CrearEspecialidad = class {
      constructor(especialidadRepository) {
        this.repo = especialidadRepository;
      }
      async execute(nombre, descripcion) {
        return this.repo.crear(nombre, descripcion);
      }
    };
    module2.exports = CrearEspecialidad;
  }
});

// src/application/use-cases/ActualizarEspecialidad.js
var require_ActualizarEspecialidad = __commonJS({
  "src/application/use-cases/ActualizarEspecialidad.js"(exports2, module2) {
    "use strict";
    var ActualizarEspecialidad = class {
      constructor(especialidadRepository) {
        this.repo = especialidadRepository;
      }
      async execute(id, datos) {
        return this.repo.actualizar(id, datos);
      }
    };
    module2.exports = ActualizarEspecialidad;
  }
});

// src/application/use-cases/CambiarEstadoEspecialidad.js
var require_CambiarEstadoEspecialidad = __commonJS({
  "src/application/use-cases/CambiarEstadoEspecialidad.js"(exports2, module2) {
    "use strict";
    var CambiarEstadoEspecialidad = class {
      constructor(especialidadRepository) {
        this.repo = especialidadRepository;
      }
      async execute(id, activo) {
        return this.repo.cambiarEstado(id, activo);
      }
    };
    module2.exports = CambiarEstadoEspecialidad;
  }
});

// src/interfaces/http/controllers/EspecialidadesController.js
var require_EspecialidadesController = __commonJS({
  "src/interfaces/http/controllers/EspecialidadesController.js"(exports2, module2) {
    "use strict";
    var { PostgresEspecialidadRepository, DuplicadoError } = require_PostgresEspecialidadRepository();
    var CrearEspecialidad = require_CrearEspecialidad();
    var ActualizarEspecialidad = require_ActualizarEspecialidad();
    var CambiarEstadoEspecialidad = require_CambiarEstadoEspecialidad();
    var validarId = require_validarId();
    var repo = new PostgresEspecialidadRepository();
    function esAdmin(usuario) {
      return usuario?.rol_id === 1;
    }
    function esErrorDeDatos(error) {
      return error.code === "22003" || error.code === "22P02";
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      console.error("[Especialidades] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    async function listar(req, res) {
      try {
        const incluirInactivas = req.query.todas === "true" && esAdmin(req.usuario);
        const data = await repo.listar({ incluirInactivas });
        return res.json({ ok: true, mensaje: "Lista de especialidades", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener especialidades", error);
      }
    }
    async function obtenerPorId(req, res) {
      try {
        const id = validarId(req.params.id, "smallint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const data = await repo.obtenerPorId(id);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Especialidad no encontrada" });
        }
        return res.json({ ok: true, mensaje: "Especialidad encontrada", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener especialidad", error);
      }
    }
    async function crear(req, res) {
      try {
        const { nombre, descripcion } = req.body;
        if (!nombre || !nombre.trim()) {
          return res.status(400).json({ ok: false, mensaje: "nombre es requerido" });
        }
        if (descripcion !== void 0 && descripcion !== null) {
          if (typeof descripcion !== "string") {
            return res.status(400).json({ ok: false, mensaje: "La descripci\xF3n debe ser texto" });
          }
          const limpia = descripcion.trim().replace(/\s+/g, " ");
          if (limpia.length > 500) {
            return res.status(400).json({ ok: false, mensaje: "La descripci\xF3n no puede superar los 500 caracteres" });
          }
        }
        const caso = new CrearEspecialidad(repo);
        const data = await caso.execute(nombre, descripcion);
        return res.status(201).json({ ok: true, mensaje: "Especialidad creada correctamente", data });
      } catch (error) {
        if (error instanceof DuplicadoError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al crear especialidad", error);
      }
    }
    async function actualizar(req, res) {
      try {
        const id = validarId(req.params.id, "smallint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const { nombre, descripcion } = req.body;
        if (!nombre || !nombre.trim()) {
          return res.status(400).json({ ok: false, mensaje: "nombre es requerido y no puede estar vac\xEDo" });
        }
        if (descripcion !== void 0 && descripcion !== null) {
          if (typeof descripcion !== "string") {
            return res.status(400).json({ ok: false, mensaje: "La descripci\xF3n debe ser texto" });
          }
          const limpia = descripcion.trim().replace(/\s+/g, " ");
          if (limpia.length > 500) {
            return res.status(400).json({ ok: false, mensaje: "La descripci\xF3n no puede superar los 500 caracteres" });
          }
        }
        const caso = new ActualizarEspecialidad(repo);
        const data = await caso.execute(id, { nombre, descripcion });
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Especialidad no encontrada" });
        }
        return res.json({ ok: true, mensaje: "Especialidad actualizada correctamente", data });
      } catch (error) {
        if (error instanceof DuplicadoError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al actualizar especialidad", error);
      }
    }
    async function cambiarEstado(req, res) {
      try {
        const id = validarId(req.params.id, "smallint");
        if (!id) {
          return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        }
        const { activo } = req.body;
        if (typeof activo !== "boolean") {
          return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
        }
        const caso = new CambiarEstadoEspecialidad(repo);
        const data = await caso.execute(id, activo);
        if (!data) {
          return res.status(404).json({ ok: false, mensaje: "Especialidad no encontrada" });
        }
        return res.json({
          ok: true,
          mensaje: activo ? "Especialidad activada" : "Especialidad desactivada",
          data
        });
      } catch (error) {
        return respuestaError500(res, "Error al cambiar el estado", error);
      }
    }
    module2.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };
  }
});

// src/interfaces/http/routes/especialidades.routes.js
var require_especialidades_routes = __commonJS({
  "src/interfaces/http/routes/especialidades.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_EspecialidadesController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.get("/", authMiddleware, ctrl.listar);
    router.get("/:id", authMiddleware, ctrl.obtenerPorId);
    router.post("/", authMiddleware, roleMiddleware("admin"), ctrl.crear);
    router.put("/:id", authMiddleware, roleMiddleware("admin"), ctrl.actualizar);
    router.patch("/:id/estado", authMiddleware, roleMiddleware("admin"), ctrl.cambiarEstado);
    module2.exports = router;
  }
});

// src/domain/ports/HorarioRepository.js
var require_HorarioRepository = __commonJS({
  "src/domain/ports/HorarioRepository.js"(exports2, module2) {
    "use strict";
    var HorarioRepository = class {
      async crear(horario) {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerPorId(id) {
        throw new Error("M\xE9todo no implementado");
      }
      // Listado general con nombres (admin global o filtrado por médico)
      async listar({ medico_id = null, incluirInactivos = false } = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      async listarPorMedico(medico_id, { soloActivos = true, soloDisponibles = false } = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      async actualizar(id, cambios) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-064: los horarios se desactivan sin borrarse
      async desactivar(id) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-062: pre-check de traslape (la BD lo garantiza con EXCLUDE USING gist)
      async existeTraslape({ medico_id, dia_semana, hora_inicio, hora_fin, excluirId = null }) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-065: horarios activos del médico menos el tiempo ocupado por citas vigentes
      async buscarHuecos({ medico_id, fecha, duracion_minutos, consultorio_id = null }) {
        throw new Error("M\xE9todo no implementado");
      }
    };
    module2.exports = HorarioRepository;
  }
});

// src/domain/value-objects/TraslapeError.js
var require_TraslapeError = __commonJS({
  "src/domain/value-objects/TraslapeError.js"(exports2, module2) {
    "use strict";
    var TraslapeError = class extends Error {
      constructor(mensaje = "El horario ya fue ocupado por otra cita") {
        super(mensaje);
        this.name = "TraslapeError";
        this.code = "23P01";
      }
    };
    module2.exports = TraslapeError;
  }
});

// src/domain/utils/fechaHoraLocal.js
var require_fechaHoraLocal = __commonJS({
  "src/domain/utils/fechaHoraLocal.js"(exports2, module2) {
    "use strict";
    var ZONA_HORARIA = process.env.APP_TIMEZONE || "America/Mexico_City";
    function normalizarOffset(valor) {
      const offset = String(valor || "").replace("GMT", "");
      if (/^[+-]\d{2}:\d{2}$/.test(offset)) return offset;
      const partes = offset.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
      if (!partes) return "+00:00";
      return `${partes[1]}${partes[2].padStart(2, "0")}:${partes[3] || "00"}`;
    }
    function partesFechaHoraLocal(fecha) {
      const valor = fecha instanceof Date ? fecha : new Date(fecha);
      if (Number.isNaN(valor.getTime())) return null;
      const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONA_HORARIA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).formatToParts(valor);
      const datos = Object.fromEntries(
        partes.filter((parte) => parte.type !== "literal").map((parte) => [parte.type, parte.value])
      );
      const offsetParte = new Intl.DateTimeFormat("en-US", {
        timeZone: ZONA_HORARIA,
        timeZoneName: "longOffset"
      }).formatToParts(valor).find((parte) => parte.type === "timeZoneName");
      const offset = normalizarOffset(offsetParte?.value);
      const dia = `${datos.year}-${datos.month}-${datos.day}`;
      const hora = `${datos.hour}:${datos.minute}`;
      return {
        fecha: dia,
        hora,
        iso: `${dia}T${hora}:${datos.second}${offset}`
      };
    }
    function formatearFechaHoraLocal(fecha) {
      return partesFechaHoraLocal(fecha);
    }
    function formatearFechaLocal(fecha) {
      return partesFechaHoraLocal(fecha)?.fecha ?? null;
    }
    function formatearHoraLocal(fecha) {
      return partesFechaHoraLocal(fecha)?.hora ?? null;
    }
    function formatearTextoLocal(fecha, opciones = {}) {
      const valor = fecha instanceof Date ? fecha : new Date(fecha);
      if (Number.isNaN(valor.getTime())) return null;
      return valor.toLocaleString("es-MX", {
        timeZone: ZONA_HORARIA,
        dateStyle: "medium",
        timeStyle: "short",
        ...opciones
      });
    }
    function diaSemanaLocal(fecha) {
      const partes = partesFechaHoraLocal(fecha);
      if (!partes) return null;
      const [anio, mes, dia] = partes.fecha.split("-").map(Number);
      const diaJs = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
      return diaJs === 0 ? 7 : diaJs;
    }
    function construirFechaHoraLocal(fecha, hora) {
      const [anio, mes, dia] = String(fecha).split("-").map(Number);
      const [hh, mm] = String(hora).split(":").map(Number);
      if ([anio, mes, dia, hh, mm].some((n) => !Number.isInteger(n))) return null;
      const referencia = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
      const partes = partesFechaHoraLocal(referencia);
      if (!partes) return null;
      const offset = partes.iso.slice(-6);
      return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${offset}`;
    }
    module2.exports = {
      ZONA_HORARIA,
      formatearFechaHoraLocal,
      formatearFechaLocal,
      formatearHoraLocal,
      formatearTextoLocal,
      diaSemanaLocal,
      construirFechaHoraLocal
    };
  }
});

// src/infrastructure/adapters/PostgresHorarioRepository.js
var require_PostgresHorarioRepository = __commonJS({
  "src/infrastructure/adapters/PostgresHorarioRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var HorarioRepository = require_HorarioRepository();
    var TraslapeError = require_TraslapeError();
    var { ZONA_HORARIA } = require_fechaHoraLocal();
    var COLUMNAS = "id, medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo, created_at, updated_at";
    var CODIGO_EXCLUIR = "23P01";
    function traducirError(error) {
      if (error && error.code === CODIGO_EXCLUIR) {
        return new TraslapeError("El m\xE9dico ya tiene un bloque en ese d\xEDa y horario que se traslapa");
      }
      return error;
    }
    var PostgresHorarioRepository = class extends HorarioRepository {
      async crear({ medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo = true }) {
        try {
          const result = await db.query(
            `INSERT INTO horarios (medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNAS}`,
            [medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo]
          );
          return result.rows[0];
        } catch (error) {
          throw traducirError(error);
        }
      }
      async obtenerPorId(id) {
        const result = await db.query(`SELECT ${COLUMNAS} FROM horarios WHERE id = $1`, [id]);
        return result.rows[0] || null;
      }
      // Listado general (admin global / médico filtrado) con nombres legibles.
      async listar({ medico_id = null, incluirInactivos = false } = {}) {
        const condiciones = [];
        const valores = [];
        if (medico_id !== null) {
          valores.push(medico_id);
          condiciones.push(`h.medico_id = $${valores.length}`);
        }
        if (!incluirInactivos) {
          condiciones.push("h.activo = true");
        }
        const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
        const result = await db.query(
          `SELECT h.id, h.medico_id, h.consultorio_id, h.dia_semana, h.hora_inicio, h.hora_fin,
              h.activo, h.created_at, h.updated_at,
              um.nombre AS medico_nombre, co.nombre AS consultorio_nombre
       FROM horarios h
       JOIN medicos m ON m.id = h.medico_id AND m.deleted_at IS NULL
       JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
       JOIN consultorios co ON co.id = h.consultorio_id AND co.deleted_at IS NULL
       ${where}
       ORDER BY um.nombre ASC, h.dia_semana ASC, h.hora_inicio ASC`,
          valores
        );
        return result.rows;
      }
      async listarPorMedico(medico_id, { soloActivos = true, soloDisponibles = false } = {}) {
        const condiciones = ["h.medico_id = $1"];
        const valores = [medico_id];
        if (soloActivos) {
          condiciones.push("h.activo = true");
        }
        if (soloDisponibles) {
          condiciones.push(`EXISTS (
        SELECT 1 FROM medicos m
        JOIN usuarios u ON u.id = m.usuario_id
        JOIN estados_cuenta ec ON ec.id = u.estado_id
        WHERE m.id = h.medico_id
          AND m.deleted_at IS NULL AND m.activo = true
          AND u.deleted_at IS NULL AND ec.clave = 'activo'
      )`);
          condiciones.push(`EXISTS (
        SELECT 1 FROM consultorios c
        WHERE c.id = h.consultorio_id
          AND c.deleted_at IS NULL AND c.activo = true
      )`);
          condiciones.push(`EXISTS (
        SELECT 1 FROM medico_especialidades me
        JOIN especialidades e ON e.id = me.especialidad_id
        WHERE me.medico_id = h.medico_id AND e.activo = true
      )`);
        }
        const result = await db.query(
          `SELECT ${COLUMNAS} FROM horarios h
       WHERE ${condiciones.join(" AND ")}
       ORDER BY h.dia_semana ASC, h.hora_inicio ASC`,
          valores
        );
        return result.rows;
      }
      async actualizar(id, cambios) {
        const campos = [];
        const valores = [];
        if (cambios.medico_id !== void 0) {
          valores.push(cambios.medico_id);
          campos.push(`medico_id = $${valores.length}`);
        }
        if (cambios.consultorio_id !== void 0) {
          valores.push(cambios.consultorio_id);
          campos.push(`consultorio_id = $${valores.length}`);
        }
        if (cambios.dia_semana !== void 0) {
          valores.push(cambios.dia_semana);
          campos.push(`dia_semana = $${valores.length}`);
        }
        if (cambios.hora_inicio !== void 0) {
          valores.push(cambios.hora_inicio);
          campos.push(`hora_inicio = $${valores.length}`);
        }
        if (cambios.hora_fin !== void 0) {
          valores.push(cambios.hora_fin);
          campos.push(`hora_fin = $${valores.length}`);
        }
        if (cambios.activo !== void 0) {
          valores.push(cambios.activo);
          campos.push(`activo = $${valores.length}`);
        }
        if (campos.length === 0) return null;
        valores.push(id);
        try {
          const result = await db.query(
            `UPDATE horarios SET ${campos.join(", ")} WHERE id = $${valores.length} RETURNING ${COLUMNAS}`,
            valores
          );
          return result.rows[0] || null;
        } catch (error) {
          throw traducirError(error);
        }
      }
      // RN-064: los horarios se desactivan sin borrarse; las citas agendadas no se tocan.
      async desactivar(id) {
        const result = await db.query(
          `UPDATE horarios SET activo = false WHERE id = $1 RETURNING ${COLUMNAS}`,
          [id]
        );
        return result.rows[0] || null;
      }
      // RN-062: pre-check de traslape (la BD lo garantiza igual con EXCLUDE USING gist).
      async existeTraslape({ medico_id, dia_semana, hora_inicio, hora_fin, excluirId = null }) {
        const valores = [medico_id, dia_semana, hora_inicio, hora_fin];
        let sql = `SELECT 1 FROM horarios
               WHERE medico_id = $1 AND dia_semana = $2 AND activo = true
                 AND timerange(hora_inicio, hora_fin) && timerange($3::time, $4::time)`;
        if (excluirId !== null) {
          valores.push(excluirId);
          sql += ` AND id <> $${valores.length}`;
        }
        const result = await db.query(sql, valores);
        return result.rows.length > 0;
      }
      // RN-065: huecos = horarios activos del día menos el tiempo ocupado por citas vigentes.
      async buscarHuecos({ medico_id, fecha, duracion_minutos, consultorio_id = null }) {
        const diaResult = await db.query(`SELECT EXTRACT(ISODOW FROM $1::date)::int AS dia`, [fecha]);
        const dia_semana = diaResult.rows[0].dia;
        const valoresHorario = [medico_id, dia_semana];
        let sqlHorario = `SELECT h.id, h.consultorio_id, h.hora_inicio, h.hora_fin FROM horarios h
                      WHERE h.medico_id = $1 AND h.dia_semana = $2 AND h.activo = true
                        AND EXISTS (
                          SELECT 1 FROM medicos m
                          JOIN usuarios u ON u.id = m.usuario_id
                          JOIN estados_cuenta ec ON ec.id = u.estado_id
                          WHERE m.id = h.medico_id
                            AND m.deleted_at IS NULL AND m.activo = true
                            AND u.deleted_at IS NULL AND ec.clave = 'activo'
                        )
                        AND EXISTS (
                          SELECT 1 FROM consultorios c
                          WHERE c.id = h.consultorio_id
                            AND c.deleted_at IS NULL AND c.activo = true
                        )
                        AND EXISTS (
                          SELECT 1 FROM medico_especialidades me
                          JOIN especialidades e ON e.id = me.especialidad_id
                          WHERE me.medico_id = h.medico_id AND e.activo = true
                        )`;
        if (consultorio_id !== null) {
          valoresHorario.push(consultorio_id);
          sqlHorario += ` AND h.consultorio_id = $${valoresHorario.length}`;
        }
        sqlHorario += " ORDER BY h.hora_inicio ASC";
        const bloques = await db.query(sqlHorario, valoresHorario);
        if (bloques.rows.length === 0) return [];
        const citasResult = await db.query(
          `SELECT to_char(fecha_hora AT TIME ZONE $3, 'HH24:MI:SS') AS hora_inicio,
              to_char(fecha_fin   AT TIME ZONE $3, 'HH24:MI:SS') AS hora_fin
       FROM citas
       WHERE medico_id = $1
         AND estado_id IN (SELECT id FROM estados_cita
                           WHERE clave IN ('pendiente','confirmada','reagendada'))
         AND (fecha_hora AT TIME ZONE $3)::date = $2::date
       ORDER BY fecha_hora ASC`,
          [medico_id, fecha, ZONA_HORARIA]
        );
        const enMinutos = (t) => {
          if (t instanceof Date) return t.getHours() * 60 + t.getMinutes();
          const [h, m] = String(t).split(":");
          const horas = parseInt(h, 10);
          const minutos = parseInt(m || "0", 10);
          if (Number.isNaN(horas) || Number.isNaN(minutos)) return 0;
          return horas * 60 + minutos;
        };
        const huecos = [];
        const duracion = Number(duracion_minutos);
        for (const bloque of bloques.rows) {
          const bloqueInicio = enMinutos(bloque.hora_inicio);
          const bloqueFin = enMinutos(bloque.hora_fin);
          const ocupaciones = citasResult.rows.map((c) => ({
            inicio: enMinutos(c.hora_inicio),
            fin: enMinutos(c.hora_fin)
          })).filter((c) => c.fin > bloqueInicio && c.inicio < bloqueFin).sort((a, b) => a.inicio - b.inicio);
          let cursor = bloqueInicio;
          for (const ocupacion of ocupaciones) {
            if (ocupacion.inicio - cursor >= duracion) {
              huecos.push({
                horario_id: bloque.id,
                consultorio_id: bloque.consultorio_id,
                hora_inicio: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}:00`,
                hora_fin: `${String(Math.floor(ocupacion.inicio / 60)).padStart(2, "0")}:${String(ocupacion.inicio % 60).padStart(2, "0")}:00`,
                duracion_minutos: ocupacion.inicio - cursor
              });
            }
            cursor = Math.max(cursor, ocupacion.fin);
          }
          if (bloqueFin - cursor >= duracion) {
            huecos.push({
              horario_id: bloque.id,
              consultorio_id: bloque.consultorio_id,
              hora_inicio: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}:00`,
              hora_fin: `${String(Math.floor(bloqueFin / 60)).padStart(2, "0")}:${String(bloqueFin % 60).padStart(2, "0")}:00`,
              duracion_minutos: bloqueFin - cursor
            });
          }
        }
        return huecos;
      }
    };
    module2.exports = PostgresHorarioRepository;
  }
});

// src/domain/entities/Horario.js
var require_Horario = __commonJS({
  "src/domain/entities/Horario.js"(exports2, module2) {
    "use strict";
    function aMinutos(valor) {
      if (valor === null || valor === void 0 || valor === "") return null;
      if (valor instanceof Date) {
        return valor.getHours() * 60 + valor.getMinutes();
      }
      const [h, m] = String(valor).split(":");
      return parseInt(h, 10) * 60 + parseInt(m || "0", 10);
    }
    var Horario = class _Horario {
      constructor({ id, medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo = true, created_at, updated_at }) {
        this.id = id;
        this.medico_id = medico_id;
        this.consultorio_id = consultorio_id;
        this.dia_semana = dia_semana;
        this.hora_inicio = hora_inicio;
        this.hora_fin = hora_fin;
        this.activo = activo;
        this.created_at = created_at;
        this.updated_at = updated_at;
      }
      static fromRow(row) {
        return new _Horario(row);
      }
      // RN-060: día de la semana ISO 8601 (1 = lunes ... 7 = domingo)
      validar() {
        if (!Number.isInteger(Number(this.dia_semana)) || this.dia_semana < 1 || this.dia_semana > 7) {
          throw new Error("D\xEDa de la semana inv\xE1lido, debe ser 1 (lunes) a 7 (domingo) [RN-060]");
        }
        const inicio = aMinutos(this.hora_inicio);
        const fin = aMinutos(this.hora_fin);
        if (inicio === null || fin === null) {
          throw new Error("hora_inicio y hora_fin son requeridas [RN-060]");
        }
        if (fin <= inicio) {
          throw new Error("La hora de fin debe ser posterior a la hora de inicio [RN-061]");
        }
        return true;
      }
      esActivo() {
        return this.activo === true;
      }
      duracionMinutos() {
        return aMinutos(this.hora_fin) - aMinutos(this.hora_inicio);
      }
      // RN-062: mismo médico, mismo día y rangos que se traslapan
      seSolapa(otro) {
        if (!(otro instanceof _Horario)) return false;
        if (this.medico_id !== otro.medico_id) return false;
        if (Number(this.dia_semana) !== Number(otro.dia_semana)) return false;
        const iniUno = aMinutos(this.hora_inicio);
        const finUno = aMinutos(this.hora_fin);
        const iniDos = aMinutos(otro.hora_inicio);
        const finDos = aMinutos(otro.hora_fin);
        return iniUno < finDos && iniDos < finUno;
      }
      // RN-072: la cita debe caer dentro del horario [inicio, fin)
      contieneHora(hora) {
        const minuto = aMinutos(hora);
        if (minuto === null) return false;
        return minuto >= aMinutos(this.hora_inicio) && minuto < aMinutos(this.hora_fin);
      }
    };
    module2.exports = Horario;
  }
});

// src/application/use-cases/RegistrarHorario.js
var require_RegistrarHorario = __commonJS({
  "src/application/use-cases/RegistrarHorario.js"(exports2, module2) {
    "use strict";
    var Horario = require_Horario();
    var RegistrarHorario = class {
      constructor(horarioRepository) {
        this.repo = horarioRepository;
      }
      async execute(datos) {
        const horario = Horario.fromRow(datos);
        try {
          horario.validar();
        } catch (error) {
          return { success: false, mensaje: error.message };
        }
        const existe = await this.repo.existeTraslape({
          medico_id: horario.medico_id,
          dia_semana: horario.dia_semana,
          hora_inicio: horario.hora_inicio,
          hora_fin: horario.hora_fin
        });
        if (existe) {
          return { success: false, mensaje: "El m\xE9dico ya tiene un bloque en ese d\xEDa y horario que se traslapan [RN-062]" };
        }
        const creado = await this.repo.crear(horario);
        return { success: true, data: creado, mensaje: "Horario registrado correctamente" };
      }
    };
    module2.exports = RegistrarHorario;
  }
});

// src/application/use-cases/EliminarHorario.js
var require_EliminarHorario = __commonJS({
  "src/application/use-cases/EliminarHorario.js"(exports2, module2) {
    "use strict";
    var EliminarHorario = class {
      constructor(horarioRepository) {
        this.repo = horarioRepository;
      }
      async execute(id) {
        const existe = await this.repo.obtenerPorId(id);
        if (!existe) {
          return { success: false, mensaje: "Horario no encontrado" };
        }
        const data = await this.repo.desactivar(id);
        return { success: true, data, mensaje: "Horario desactivado correctamente" };
      }
    };
    module2.exports = EliminarHorario;
  }
});

// src/application/use-cases/ListarHorariosDisponibles.js
var require_ListarHorariosDisponibles = __commonJS({
  "src/application/use-cases/ListarHorariosDisponibles.js"(exports2, module2) {
    "use strict";
    var ListarHorariosDisponibles = class {
      constructor(horarioRepository) {
        this.repo = horarioRepository;
      }
      async execute({ medico_id, fecha = null, duracion_minutos = null, consultorio_id = null, soloActivos = true } = {}) {
        if (!medico_id) {
          return { success: false, mensaje: "Se requiere el m\xE9dico" };
        }
        if (fecha && duracion_minutos) {
          const huecos = await this.repo.buscarHuecos({ medico_id, fecha, duracion_minutos, consultorio_id });
          return { success: true, data: huecos };
        }
        const bloques = await this.repo.listarPorMedico(medico_id, { soloActivos });
        return { success: true, data: bloques };
      }
    };
    module2.exports = ListarHorariosDisponibles;
  }
});

// src/interfaces/http/utils/identidad.js
var require_identidad = __commonJS({
  "src/interfaces/http/utils/identidad.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var rolesValidos = { 1: "admin", 2: "medico", 3: "paciente" };
    function rolClave(usuario) {
      return rolesValidos[usuario?.rol_id] || null;
    }
    function esAdmin(usuario) {
      return rolClave(usuario) === "admin";
    }
    async function medicoIdDeUsuario(usuarioId) {
      const result = await db.query(
        "SELECT id FROM medicos WHERE usuario_id = $1 AND deleted_at IS NULL",
        [usuarioId]
      );
      return result.rows[0]?.id ?? null;
    }
    async function pacienteIdDeUsuario(usuarioId) {
      const result = await db.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1 AND deleted_at IS NULL",
        [usuarioId]
      );
      return result.rows[0]?.id ?? null;
    }
    async function medicoTieneConsultorio(medicoId, consultorioId) {
      const result = await db.query(
        `SELECT 1 FROM medico_consultorios mc
     JOIN consultorios c ON c.id = mc.consultorio_id AND c.deleted_at IS NULL
     WHERE mc.medico_id = $1 AND mc.consultorio_id = $2`,
        [medicoId, consultorioId]
      );
      return result.rows.length > 0;
    }
    module2.exports = {
      rolClave,
      esAdmin,
      medicoIdDeUsuario,
      pacienteIdDeUsuario,
      medicoTieneConsultorio
    };
  }
});

// src/interfaces/http/controllers/HorariosController.js
var require_HorariosController = __commonJS({
  "src/interfaces/http/controllers/HorariosController.js"(exports2, module2) {
    "use strict";
    var PostgresHorarioRepository = require_PostgresHorarioRepository();
    var RegistrarHorario = require_RegistrarHorario();
    var EliminarHorario = require_EliminarHorario();
    var ListarHorariosDisponibles = require_ListarHorariosDisponibles();
    var TraslapeError = require_TraslapeError();
    var Horario = require_Horario();
    var validarId = require_validarId();
    var {
      esAdmin,
      medicoIdDeUsuario,
      medicoTieneConsultorio
    } = require_identidad();
    var repo = new PostgresHorarioRepository();
    var RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    var RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
    function esErrorDeDatos(error) {
      return error?.code === "22003" || error?.code === "22P02";
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      console.error("[Horarios] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    function normalizarHora(valor) {
      if (typeof valor !== "string") return null;
      const limpio = valor.trim();
      if (!RE_HORA.test(limpio)) return null;
      return limpio.length === 5 ? `${limpio}:00` : limpio;
    }
    function validarCuerpo(body = {}) {
      const medicoId = validarId(body.medico_id, "bigint");
      if (!medicoId) return { error: "medico_id inv\xE1lido o ausente" };
      const consultorioId = validarId(body.consultorio_id, "bigint");
      if (!consultorioId) return { error: "consultorio_id inv\xE1lido o ausente" };
      const dia = Number(body.dia_semana);
      if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
        return { error: "dia_semana debe ser 1 (lunes) a 7 (domingo) [RN-060]" };
      }
      const horaInicio = normalizarHora(body.hora_inicio);
      if (!horaInicio) return { error: "hora_inicio inv\xE1lida; use HH:MM o HH:MM:SS" };
      const horaFin = normalizarHora(body.hora_fin);
      if (!horaFin) return { error: "hora_fin inv\xE1lida; use HH:MM o HH:MM:SS" };
      if (horaFin <= horaInicio) {
        return { error: "La hora de fin debe ser posterior a la hora de inicio [RN-061]" };
      }
      return { datos: { medico_id: medicoId, consultorio_id: consultorioId, dia_semana: dia, hora_inicio: horaInicio, hora_fin: horaFin } };
    }
    async function exigirPropietario(req, res, horario) {
      if (esAdmin(req.usuario)) return true;
      const medicoId = await medicoIdDeUsuario(req.usuario.id);
      if (!medicoId || Number(medicoId) !== Number(horario.medico_id)) {
        res.status(403).json({ ok: false, mensaje: "No tienes permiso para gestionar este horario" });
        return false;
      }
      return true;
    }
    async function listar(req, res) {
      try {
        let medicoId = null;
        if (esAdmin(req.usuario)) {
          if (req.query.medico !== void 0) {
            medicoId = validarId(req.query.medico, "bigint");
            if (!medicoId) return res.status(400).json({ ok: false, mensaje: "ID de m\xE9dico inv\xE1lido" });
          }
        } else {
          medicoId = await medicoIdDeUsuario(req.usuario.id);
          if (!medicoId) return res.status(403).json({ ok: false, mensaje: "No tienes un registro de m\xE9dico" });
        }
        const incluirInactivos = req.query.todos === "true" && esAdmin(req.usuario);
        const data = await repo.listar({ medico_id: medicoId, incluirInactivos });
        return res.json({ ok: true, mensaje: "Horarios del m\xE9dico", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener horarios", error);
      }
    }
    async function listarPorMedico(req, res) {
      try {
        const medicoId = validarId(req.params.idMedico, "bigint");
        if (!medicoId) return res.status(400).json({ ok: false, mensaje: "ID de m\xE9dico inv\xE1lido" });
        const { fecha, duracion_minutos, consultorio_id } = req.query;
        if (fecha !== void 0 || duracion_minutos !== void 0) {
          if (fecha !== void 0 && !RE_FECHA.test(String(fecha))) {
            return res.status(400).json({ ok: false, mensaje: "fecha debe tener el formato YYYY-MM-DD" });
          }
          const duracion = Number(duracion_minutos);
          if (!Number.isInteger(duracion) || duracion < 10 || duracion > 240) {
            return res.status(400).json({ ok: false, mensaje: "duracion_minutos debe ser un entero entre 10 y 240 [RN-071]" });
          }
          let consultorioId = null;
          if (consultorio_id !== void 0) {
            consultorioId = validarId(consultorio_id, "bigint");
            if (!consultorioId) return res.status(400).json({ ok: false, mensaje: "consultorio_id inv\xE1lido" });
          }
          const caso = new ListarHorariosDisponibles(repo);
          const resultado = await caso.execute({
            medico_id: medicoId,
            fecha,
            duracion_minutos: duracion,
            consultorio_id: consultorioId
          });
          return res.json({ ok: true, mensaje: "Huecos disponibles", data: resultado.data });
        }
        const esPropio = !esAdmin(req.usuario) ? String(await medicoIdDeUsuario(req.usuario.id) ?? "") === String(medicoId) : true;
        const incluirInactivos = req.query.todos === "true" && (esAdmin(req.usuario) || esPropio);
        const data = await repo.listarPorMedico(medicoId, { soloActivos: !incluirInactivos });
        return res.json({ ok: true, mensaje: "Bloques del m\xE9dico", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener horarios del m\xE9dico", error);
      }
    }
    async function obtenerPorId(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const data = await repo.obtenerPorId(id);
        if (!data) return res.status(404).json({ ok: false, mensaje: "Horario no encontrado" });
        return res.json({ ok: true, mensaje: "Horario encontrado", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener horario", error);
      }
    }
    async function crear(req, res) {
      try {
        const validado = validarCuerpo(req.body);
        if (validado.error) return res.status(400).json({ ok: false, mensaje: validado.error });
        const datos = validado.datos;
        if (!esAdmin(req.usuario)) {
          const medicoId = await medicoIdDeUsuario(req.usuario.id);
          if (!medicoId) return res.status(403).json({ ok: false, mensaje: "No tienes un registro de m\xE9dico" });
          if (Number(datos.medico_id) !== Number(medicoId)) {
            return res.status(403).json({ ok: false, mensaje: "Solo puedes crear horarios para ti mismo" });
          }
        }
        const asignado = await medicoTieneConsultorio(datos.medico_id, datos.consultorio_id);
        if (!asignado) {
          return res.status(400).json({
            ok: false,
            mensaje: "El m\xE9dico no est\xE1 asignado a ese consultorio [RN-063]"
          });
        }
        const caso = new RegistrarHorario(repo);
        const resultado = await caso.execute(datos);
        if (!resultado.success) {
          return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.status(201).json({
          ok: true,
          mensaje: resultado.mensaje,
          data: resultado.data
        });
      } catch (error) {
        if (error instanceof TraslapeError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al crear horario", error);
      }
    }
    async function actualizar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const existente = await repo.obtenerPorId(id);
        if (!existente) return res.status(404).json({ ok: false, mensaje: "Horario no encontrado" });
        if (!await exigirPropietario(req, res, existente)) return;
        const validado = validarCuerpo(req.body);
        if (validado.error) return res.status(400).json({ ok: false, mensaje: validado.error });
        const datos = validado.datos;
        const asignado = await medicoTieneConsultorio(datos.medico_id, datos.consultorio_id);
        if (!asignado) {
          return res.status(400).json({
            ok: false,
            mensaje: "El m\xE9dico no est\xE1 asignado a ese consultorio [RN-063]"
          });
        }
        const traslape = await repo.existeTraslape({
          medico_id: datos.medico_id,
          dia_semana: datos.dia_semana,
          hora_inicio: datos.hora_inicio,
          hora_fin: datos.hora_fin,
          excluirId: id
        });
        if (traslape) {
          return res.status(409).json({
            ok: false,
            mensaje: "El m\xE9dico ya tiene un bloque en ese d\xEDa y horario que se traslapan [RN-062]"
          });
        }
        const resultado = Horario.fromRow({ ...existente, ...datos });
        try {
          resultado.validar();
        } catch (error) {
          return res.status(400).json({ ok: false, mensaje: error.message });
        }
        const data = await repo.actualizar(id, datos);
        return res.json({ ok: true, mensaje: "Horario actualizado correctamente", data });
      } catch (error) {
        if (error instanceof TraslapeError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al actualizar horario", error);
      }
    }
    async function cambiarEstado(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const existente = await repo.obtenerPorId(id);
        if (!existente) return res.status(404).json({ ok: false, mensaje: "Horario no encontrado" });
        if (!await exigirPropietario(req, res, existente)) return;
        const { activo } = req.body || {};
        if (typeof activo !== "boolean") {
          return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
        }
        const data = await repo.actualizar(id, { activo });
        return res.json({
          ok: true,
          mensaje: activo ? "Horario activado" : "Horario desactivado",
          data
        });
      } catch (error) {
        return respuestaError500(res, "Error al cambiar el estado", error);
      }
    }
    async function eliminar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const existente = await repo.obtenerPorId(id);
        if (!existente) return res.status(404).json({ ok: false, mensaje: "Horario no encontrado" });
        if (!await exigirPropietario(req, res, existente)) return;
        const caso = new EliminarHorario(repo);
        const resultado = await caso.execute(id);
        if (!resultado.success) {
          return res.status(404).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
      } catch (error) {
        return respuestaError500(res, "Error al desactivar horario", error);
      }
    }
    module2.exports = { listar, listarPorMedico, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };
  }
});

// src/interfaces/http/routes/horarios.routes.js
var require_horarios_routes = __commonJS({
  "src/interfaces/http/routes/horarios.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_HorariosController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.use(authMiddleware);
    router.get("/medico/:idMedico", ctrl.listarPorMedico);
    router.get("/", roleMiddleware("admin", "medico"), ctrl.listar);
    router.get("/:id", roleMiddleware("admin", "medico"), ctrl.obtenerPorId);
    router.post("/", roleMiddleware("admin", "medico"), ctrl.crear);
    router.put("/:id", roleMiddleware("admin", "medico"), ctrl.actualizar);
    router.patch("/:id/estado", roleMiddleware("admin", "medico"), ctrl.cambiarEstado);
    router.delete("/:id", roleMiddleware("admin", "medico"), ctrl.eliminar);
    module2.exports = router;
  }
});

// src/domain/ports/CitaRepository.js
var require_CitaRepository = __commonJS({
  "src/domain/ports/CitaRepository.js"(exports2, module2) {
    "use strict";
    var CitaRepository = class {
      async crear(cita) {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerPorId(id) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-009: el uuid_publico es el identificador expuesto en API y Telegram
      async obtenerPorUuid(uuid_publico) {
        throw new Error("M\xE9todo no implementado");
      }
      // Visibilidad por rol (RN-053 / matriz de permisos): admin ve todas,
      // médico y paciente solo las suyas según los filtros que se pasen
      async listar({ paciente_id = null, medico_id = null, estado = null, estados = null, fecha_desde = null, fecha_hasta = null, page = 1, limit = 10 } = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-080: la transición se valida en domain antes de llegar aquí;
      // el trigger trg_citas_historial registra el cambio en historial_estados_cita (RN-090)
      async cambiarEstado(id, estado_id, contexto = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      // Usado por reagendar (RN-083 / RN-084): mueve fecha_hora o duración
      async actualizar(id, cambios) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-112: mueve fecha_hora y estado en una sola transacción
      async reagendar(id, cambios = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-075: pre-check de traslape para responder "El horario ya fue ocupado"
      // en vez de un error técnico (la BD lo garantiza con EXCLUDE USING gist, RN-074)
      async buscarTraslape({ medico_id, fecha_hora, fecha_fin, excluirId = null }) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-078: pre-check de traslape del paciente con cualquier médico
      async buscarTraslapePaciente({ paciente_id, fecha_hora, fecha_fin, excluirId = null }) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-090: historial de estados, de solo inserción (RN-092)
      async listarHistorial(cita_id) {
        throw new Error("M\xE9todo no implementado");
      }
      // Pacientes distintos de un médico (vista "Mis pacientes")
      async pacientesDelMedico(medico_id) {
        throw new Error("M\xE9todo no implementado");
      }
    };
    module2.exports = CitaRepository;
  }
});

// src/infrastructure/adapters/PostgresCitaRepository.js
var require_PostgresCitaRepository = __commonJS({
  "src/infrastructure/adapters/PostgresCitaRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var CitaRepository = require_CitaRepository();
    var TraslapeError = require_TraslapeError();
    var CODIGO_EXCLUIR = "23P01";
    function traducirError(error) {
      if (error && error.code === CODIGO_EXCLUIR) {
        if (error.constraint === "ex_citas_sin_traslape_paciente") {
          return new TraslapeError("El paciente ya tiene una cita vigente que se traslapa en esa fecha y hora [RN-078]");
        }
        return new TraslapeError("El horario ya fue ocupado para ese m\xE9dico en esa fecha y hora [RN-074]");
      }
      return error;
    }
    var PostgresCitaRepository = class extends CitaRepository {
      // Devuelve la cita con estado y nombre del paciente/médico legibles.
      async crear({ paciente_id, medico_id, consultorio_id, fecha_hora, duracion_minutos = 30, motivo = null, notas = null, estado_id = null }) {
        try {
          const result = await db.query(
            `INSERT INTO citas (paciente_id, medico_id, consultorio_id, fecha_hora, duracion_minutos, motivo, notas, estado_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
                 COALESCE($8, (SELECT id FROM estados_cita WHERE clave = 'pendiente')))
         RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                   duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
            [paciente_id, medico_id, consultorio_id, fecha_hora, duracion_minutos, motivo, notas, estado_id]
          );
          return result.rows[0];
        } catch (error) {
          throw traducirError(error);
        }
      }
      async obtenerPorId(id) {
        const result = await db.query(
          `SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
              c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
              ec.clave AS estado,
              up.nombre AS paciente_nombre, um.nombre AS medico_nombre, co.nombre AS consultorio_nombre
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       LEFT JOIN pacientes p ON p.id = c.paciente_id AND p.deleted_at IS NULL
       LEFT JOIN usuarios up ON up.id = p.usuario_id AND up.deleted_at IS NULL
       LEFT JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
       LEFT JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
       LEFT JOIN consultorios co ON co.id = c.consultorio_id AND co.deleted_at IS NULL
       WHERE c.id = $1`,
          [id]
        );
        return result.rows[0] || null;
      }
      // RN-009: el uuid_publico es el identificador expuesto en API y Telegram.
      async obtenerPorUuid(uuid_publico) {
        const result = await db.query(
          `SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
              c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
              ec.clave AS estado,
              up.id AS paciente_usuario_id,
              up.nombre AS paciente_nombre, um.nombre AS medico_nombre, co.nombre AS consultorio_nombre
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       LEFT JOIN pacientes p ON p.id = c.paciente_id AND p.deleted_at IS NULL
       LEFT JOIN usuarios up ON up.id = p.usuario_id AND up.deleted_at IS NULL
       LEFT JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
       LEFT JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
       LEFT JOIN consultorios co ON co.id = c.consultorio_id AND co.deleted_at IS NULL
       WHERE c.uuid_publico = $1`,
          [uuid_publico]
        );
        return result.rows[0] || null;
      }
      // RN-053: visibilidad por rol. admin ve todas; médico y paciente solo las suyas.
      async listar({ paciente_id = null, medico_id = null, estado = null, estados = null, fecha_desde = null, fecha_hasta = null, page = 1, limit = 10 } = {}) {
        const condiciones = [];
        const valores = [];
        if (paciente_id !== null) {
          valores.push(paciente_id);
          condiciones.push(`c.paciente_id = $${valores.length}`);
        }
        if (medico_id !== null) {
          valores.push(medico_id);
          condiciones.push(`c.medico_id = $${valores.length}`);
        }
        if (estado !== null) {
          valores.push(estado);
          condiciones.push(`c.estado_id = (SELECT id FROM estados_cita WHERE clave = $${valores.length})`);
        }
        if (Array.isArray(estados) && estados.length > 0) {
          valores.push(estados);
          condiciones.push(`c.estado_id IN (SELECT id FROM estados_cita WHERE clave = ANY($${valores.length}::text[]))`);
        }
        if (fecha_desde !== null) {
          valores.push(fecha_desde);
          condiciones.push(`c.fecha_hora >= $${valores.length}`);
        }
        if (fecha_hasta !== null) {
          valores.push(fecha_hasta);
          condiciones.push(`c.fecha_hora <= $${valores.length}`);
        }
        const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
        const offset = (page - 1) * limit;
        const countSql = `SELECT COUNT(*) FROM citas c ${where}`;
        const totalResult = await db.query(countSql, valores);
        const total = parseInt(totalResult.rows[0].count, 10);
        const sql = `
      SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
             c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
             ec.clave AS estado,
             up.nombre AS paciente_nombre, um.nombre AS medico_nombre, co.nombre AS consultorio_nombre
      FROM citas c
      JOIN estados_cita ec ON ec.id = c.estado_id
      LEFT JOIN pacientes p ON p.id = c.paciente_id AND p.deleted_at IS NULL
      LEFT JOIN usuarios up ON up.id = p.usuario_id AND up.deleted_at IS NULL
      LEFT JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
      LEFT JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
      LEFT JOIN consultorios co ON co.id = c.consultorio_id AND co.deleted_at IS NULL
      ${where}
      ORDER BY c.fecha_hora ASC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}
    `;
        const result = await db.query(sql, [...valores, limit, offset]);
        return { data: result.rows, total, page, limit };
      }
      // "Mis pacientes" del médico: pacientes distintos con los que tiene citas,
      // con conteo y última visita (consume la página MisPacientes del frontend).
      async pacientesDelMedico(medico_id) {
        const result = await db.query(
          `SELECT p.id, p.usuario_id, p.telefono, u.nombre, u.email,
              COUNT(c.id)::int                                     AS total_citas,
              COUNT(c.id) FILTER (WHERE ec.clave = 'completada')::int AS citas_completadas,
              MAX(c.fecha_hora)                                    AS ultima_cita
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       JOIN pacientes p ON p.id = c.paciente_id AND p.deleted_at IS NULL
       JOIN usuarios u ON u.id = p.usuario_id AND u.deleted_at IS NULL
       WHERE c.medico_id = $1
       GROUP BY p.id, p.usuario_id, p.telefono, u.nombre, u.email
       ORDER BY u.nombre ASC`,
          [medico_id]
        );
        return result.rows;
      }
      // RN-080: la transición se valida en domain antes de llegar aquí.
      // RN-090 / RN-091: el trigger trg_citas_historial registra el cambio y lee
      // actor/origen/comentario desde variables locales de la transacción.
      async cambiarEstado(id, estado_id, { cambiadoPor = null, origen = "sistema", comentario = null } = {}) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          await client.query(
            `SELECT set_config('app.cambiado_por', $1, true),
                set_config('app.origen', $2, true),
                set_config('app.comentario', $3, true)`,
            [cambiadoPor == null ? "" : String(cambiadoPor), origen || "sistema", comentario || ""]
          );
          const result = await client.query(
            `UPDATE citas SET estado_id = $1 WHERE id = $2
         RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                   duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
            [estado_id, id]
          );
          await client.query("COMMIT");
          return result.rows[0] || null;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (_) {
          }
          throw traducirError(error);
        } finally {
          client.release();
        }
      }
      // RN-112: mueve la fecha y, si aplica, cambia el estado en una sola
      // transacción. El trigger de historial registra el cambio de estado.
      async reagendar(id, {
        fecha_hora,
        medico_id = null,
        consultorio_id = null,
        estado_id = null,
        cambiadoPor = null,
        origen = "web",
        comentario = null
      } = {}) {
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          await client.query(
            `SELECT set_config('app.cambiado_por', $1, true),
                set_config('app.origen', $2, true),
                set_config('app.comentario', $3, true)`,
            [cambiadoPor == null ? "" : String(cambiadoPor), origen || "web", comentario || ""]
          );
          const campos = ["fecha_hora = $1"];
          const valores = [fecha_hora];
          if (medico_id !== null && medico_id !== void 0) {
            valores.push(medico_id);
            campos.push(`medico_id = $${valores.length}`);
          }
          if (consultorio_id !== null && consultorio_id !== void 0) {
            valores.push(consultorio_id);
            campos.push(`consultorio_id = $${valores.length}`);
          }
          if (estado_id !== null && estado_id !== void 0) {
            valores.push(estado_id);
            campos.push(`estado_id = $${valores.length}`);
          }
          valores.push(id);
          const result = await client.query(
            `UPDATE citas SET ${campos.join(", ")} WHERE id = $${valores.length}
         RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                   duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
            valores
          );
          await client.query("COMMIT");
          return result.rows[0] || null;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (_) {
          }
          throw traducirError(error);
        } finally {
          client.release();
        }
      }
      // Usado por reagendar: mueve fecha_hora o duración. Dispara de nuevo el
      // trigger de fecha_fin, por lo que un solape posterior también lo detecta la BD.
      async actualizar(id, cambios) {
        const campos = [];
        const valores = [];
        if (cambios.fecha_hora !== void 0) {
          valores.push(cambios.fecha_hora);
          campos.push(`fecha_hora = $${valores.length}`);
        }
        if (cambios.duracion_minutos !== void 0) {
          valores.push(cambios.duracion_minutos);
          campos.push(`duracion_minutos = $${valores.length}`);
        }
        if (cambios.consultorio_id !== void 0) {
          valores.push(cambios.consultorio_id);
          campos.push(`consultorio_id = $${valores.length}`);
        }
        if (cambios.motivo !== void 0) {
          valores.push(cambios.motivo);
          campos.push(`motivo = $${valores.length}`);
        }
        if (cambios.notas !== void 0) {
          valores.push(cambios.notas);
          campos.push(`notas = $${valores.length}`);
        }
        if (campos.length === 0) return null;
        valores.push(id);
        try {
          const result = await db.query(
            `UPDATE citas SET ${campos.join(", ")} WHERE id = $${valores.length}
         RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                   duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
            valores
          );
          return result.rows[0] || null;
        } catch (error) {
          throw traducirError(error);
        }
      }
      // RN-075: pre-check de traslape para responder "El horario ya fue ocupado"
      // en vez de un error técnico (la BD lo garantiza con EXCLUDE USING gist, RN-074).
      async buscarTraslape({ medico_id, fecha_hora, fecha_fin, excluirId = null }) {
        const valores = [medico_id, fecha_hora, fecha_fin];
        let sql = `SELECT 1 FROM citas
               WHERE medico_id = $1
                 AND estado_id IN (SELECT id FROM estados_cita
                                   WHERE clave IN ('pendiente','confirmada','reagendada'))
                 AND tstzrange(fecha_hora, fecha_fin) && tstzrange($2::timestamptz, $3::timestamptz)`;
        if (excluirId !== null) {
          valores.push(excluirId);
          sql += ` AND id <> $${valores.length}`;
        }
        const result = await db.query(sql, valores);
        return result.rows.length > 0;
      }
      // RN-078: pre-check de traslape del paciente con cualquier médico.
      // La BD lo garantiza además con el EXCLUDE de la migración 006.
      async buscarTraslapePaciente({ paciente_id, fecha_hora, fecha_fin, excluirId = null }) {
        const valores = [paciente_id, fecha_hora, fecha_fin];
        let sql = `SELECT 1 FROM citas
               WHERE paciente_id = $1
                 AND estado_id IN (SELECT id FROM estados_cita
                                   WHERE clave IN ('pendiente','confirmada','reagendada'))
                 AND tstzrange(fecha_hora, fecha_fin) && tstzrange($2::timestamptz, $3::timestamptz)`;
        if (excluirId !== null) {
          valores.push(excluirId);
          sql += ` AND id <> $${valores.length}`;
        }
        const result = await db.query(sql, valores);
        return result.rows.length > 0;
      }
      // RN-090: historial de estados, de solo inserción (RN-092).
      async listarHistorial(cita_id) {
        const result = await db.query(
          `SELECT h.id, h.cita_id, h.estado_anterior, h.estado_nuevo, h.cambiado_por, h.origen,
              h.comentario, h.created_at,
              ea.clave AS estado_anterior_clave, en.clave AS estado_nuevo_clave
       FROM historial_estados_cita h
       LEFT JOIN estados_cita ea ON ea.id = h.estado_anterior
       JOIN estados_cita en ON en.id = h.estado_nuevo
       WHERE h.cita_id = $1
       ORDER BY h.created_at ASC`,
          [cita_id]
        );
        return result.rows;
      }
    };
    module2.exports = PostgresCitaRepository;
  }
});

// src/domain/value-objects/EstadoCita.js
var require_EstadoCita = __commonJS({
  "src/domain/value-objects/EstadoCita.js"(exports2, module2) {
    "use strict";
    var estadosValidos = {
      1: "pendiente",
      2: "confirmada",
      3: "reagendada",
      4: "cancelada",
      5: "completada",
      6: "no_asistio"
    };
    var transicionesPermitidas = {
      1: [2, 3, 4, 5, 6],
      2: [3, 4, 5, 6],
      3: [2, 4, 5, 6],
      4: [],
      5: [6],
      6: [5]
    };
    var EstadoCita = class _EstadoCita {
      constructor(id) {
        if (!estadosValidos[id]) {
          throw new Error(`Estado inv\xE1lido: ${id}`);
        }
        this.id = id;
        this.clave = estadosValidos[id];
      }
      static fromClave(clave) {
        const entrada = Object.entries(estadosValidos).find(([, v]) => v === clave);
        if (!entrada) return null;
        return new _EstadoCita(Number(entrada[0]));
      }
      esPendiente() {
        return this.id === 1;
      }
      esConfirmada() {
        return this.id === 2;
      }
      esReagendada() {
        return this.id === 3;
      }
      esCancelada() {
        return this.id === 4;
      }
      esCompletada() {
        return this.id === 5;
      }
      esNoAsistio() {
        return this.id === 6;
      }
      // RN-076: pendiente, confirmada o reagendada ocupan agenda
      esVigente() {
        return this.id === 1 || this.id === 2 || this.id === 3;
      }
      // RN-081: cancelada no se modifica. completada y no_asistio admiten corrección de asistencia
      esFinal() {
        return this.id === 4;
      }
      // RN-080: solo las transiciones de la tabla están permitidas
      puedeTransicionarA(nuevo) {
        const destino = nuevo instanceof _EstadoCita ? nuevo.id : Number(nuevo);
        if (!estadosValidos[destino]) return false;
        return transicionesPermitidas[this.id].includes(destino);
      }
    };
    module2.exports = EstadoCita;
  }
});

// src/domain/entities/Cita.js
var require_Cita = __commonJS({
  "src/domain/entities/Cita.js"(exports2, module2) {
    "use strict";
    var EstadoCita = require_EstadoCita();
    var Cita = class _Cita {
      constructor({
        id,
        uuid_publico,
        paciente_id,
        paciente_usuario_id,
        medico_id,
        consultorio_id,
        fecha_hora,
        duracion_minutos = 30,
        fecha_fin,
        estado_id = 1,
        motivo,
        notas,
        created_at,
        updated_at
      }) {
        this.id = id;
        this.uuid_publico = uuid_publico;
        this.paciente_id = paciente_id;
        this.paciente_usuario_id = paciente_usuario_id ?? null;
        this.medico_id = medico_id;
        this.consultorio_id = consultorio_id;
        this.fecha_hora = fecha_hora;
        this.duracion_minutos = duracion_minutos;
        this.fecha_fin = fecha_fin;
        this.estado_id = estado_id;
        this.motivo = motivo;
        this.notas = notas;
        this.created_at = created_at;
        this.updated_at = updated_at;
      }
      static fromRow(row) {
        return new _Cita(row);
      }
      get estado() {
        return new EstadoCita(this.estado_id);
      }
      // RN-076: pendiente, confirmada o reagendada bloquean el horario
      esVigente() {
        return this.estado.esVigente();
      }
      // RN-071: duración entre 10 y 240 minutos
      duracionValida() {
        const duracion = Number(this.duracion_minutos);
        return Number.isInteger(duracion) && duracion >= 10 && duracion <= 240;
      }
      // RN-073: no se agendan citas en el pasado 🔶
      esFutura() {
        return new Date(this.fecha_hora).getTime() > Date.now();
      }
      // Espejo del trigger trg_citas_fecha_fin: fecha_fin = fecha_hora + duración
      calcularFechaFin() {
        const inicio = new Date(this.fecha_hora);
        return new Date(inicio.getTime() + Number(this.duracion_minutos) * 6e4);
      }
      rango() {
        const fin = this.fecha_fin ? new Date(this.fecha_fin) : this.calcularFechaFin();
        return { inicio: new Date(this.fecha_hora), fin };
      }
      // RN-074 / RN-078: dos citas vigentes del mismo médico o del mismo paciente
      // no se traslapan. El traslape es relevante si comparten médico O paciente.
      seSolapa(otra) {
        if (!(otra instanceof _Cita)) return false;
        if (!this.esVigente() || !otra.esVigente()) return false;
        const mismoMedico = Number(this.medico_id) === Number(otra.medico_id);
        const mismoPaciente = Number(this.paciente_id) === Number(otra.paciente_id);
        if (!mismoMedico && !mismoPaciente) return false;
        const uno = this.rango();
        const dos = otra.rango();
        return uno.inicio < dos.fin && dos.inicio < uno.fin;
      }
      // RN-080: solo las transiciones permitidas (delega al value object)
      puedeTransicionarA(nuevo) {
        return this.estado.puedeTransicionarA(nuevo);
      }
      // RN-086: plazo mínimo de anticipación para cancelar o reagendar 🔶
      fueraDePlazoCancelacion(minimoHoras = 2) {
        const milisegundos = minimoHoras * 60 * 60 * 1e3;
        return new Date(this.fecha_hora).getTime() - Date.now() < milisegundos;
      }
    };
    module2.exports = Cita;
  }
});

// src/application/use-cases/AgendarCita.js
var require_AgendarCita = __commonJS({
  "src/application/use-cases/AgendarCita.js"(exports2, module2) {
    "use strict";
    var Cita = require_Cita();
    var Horario = require_Horario();
    var { formatearFechaHoraLocal, diaSemanaLocal } = require_fechaHoraLocal();
    var AgendarCita = class {
      constructor(citaRepository, horarioRepository) {
        this.citas = citaRepository;
        this.horarios = horarioRepository;
      }
      async execute(datos) {
        const cita = Cita.fromRow(datos);
        if (!cita.duracionValida()) {
          return { success: false, mensaje: "La duraci\xF3n debe estar entre 10 y 240 minutos [RN-071]" };
        }
        if (!cita.esFutura()) {
          return { success: false, mensaje: "No se pueden agendar citas en el pasado [RN-073]" };
        }
        cita.fecha_fin = cita.calcularFechaFin();
        const enHorario = await this._dentroDeHorario(cita);
        if (!enHorario) {
          return { success: false, mensaje: "La fecha cae fuera de un horario activo del m\xE9dico en ese consultorio [RN-072]" };
        }
        const traslapeMedico = await this.citas.buscarTraslape({
          medico_id: cita.medico_id,
          fecha_hora: cita.fecha_hora,
          fecha_fin: cita.fecha_fin
        });
        if (traslapeMedico) {
          return { success: false, mensaje: "El horario ya fue ocupado para ese m\xE9dico [RN-074]" };
        }
        const traslapePaciente = await this.citas.buscarTraslapePaciente({
          paciente_id: cita.paciente_id,
          fecha_hora: cita.fecha_hora,
          fecha_fin: cita.fecha_fin
        });
        if (traslapePaciente) {
          return { success: false, mensaje: "El paciente ya tiene una cita que se traslapa con ese horario [RN-078]" };
        }
        const creada = await this.citas.crear({
          paciente_id: cita.paciente_id,
          medico_id: cita.medico_id,
          consultorio_id: cita.consultorio_id,
          fecha_hora: cita.fecha_hora,
          duracion_minutos: cita.duracion_minutos,
          motivo: cita.motivo || null,
          notas: cita.notas || null
          // estado_id lo pone la BD en 1 (pendiente) — RN-077
        });
        return { success: true, data: creada, mensaje: "Cita agendada correctamente" };
      }
      // RN-072: existe un bloque activo de ese médico, ese día, ese consultorio
      // y con la hora dentro del rango [inicio, fin). La fecha/hora se interpreta
      // siempre en la zona de la clínica, no en la zona del proceso de Node.
      async _dentroDeHorario(cita) {
        const bloques = await this.horarios.listarPorMedico(cita.medico_id, {
          soloActivos: true,
          soloDisponibles: true
        });
        const local = formatearFechaHoraLocal(cita.fecha_hora);
        if (!local) return false;
        const diaIso = diaSemanaLocal(cita.fecha_hora);
        const hora = local.hora;
        return bloques.some((bloque) => {
          if (!bloque.activo) return false;
          if (Number(bloque.dia_semana) !== diaIso) return false;
          if (Number(bloque.consultorio_id) !== Number(cita.consultorio_id)) return false;
          return Horario.fromRow(bloque).contieneHora(hora);
        });
      }
    };
    module2.exports = AgendarCita;
  }
});

// src/application/use-cases/ConfirmarCita.js
var require_ConfirmarCita = __commonJS({
  "src/application/use-cases/ConfirmarCita.js"(exports2, module2) {
    "use strict";
    var Cita = require_Cita();
    var EstadoCita = require_EstadoCita();
    var ConfirmarCita = class {
      constructor(citaRepository) {
        this.repo = citaRepository;
      }
      async execute(id, { cambiadoPor = null, origen = "web", comentario = null } = {}) {
        const row = await this.repo.obtenerPorId(id);
        if (!row) {
          return { success: false, mensaje: "Cita no encontrada" };
        }
        const cita = Cita.fromRow(row);
        const confirmada = EstadoCita.fromClave("confirmada");
        if (!cita.puedeTransicionarA(confirmada)) {
          if (cita.estado.esFinal()) {
            return { success: false, mensaje: `La cita est\xE1 en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]` };
          }
          return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
        }
        const data = await this.repo.cambiarEstado(id, confirmada.id, { cambiadoPor, origen, comentario });
        return { success: true, data, mensaje: "Cita confirmada correctamente" };
      }
    };
    module2.exports = ConfirmarCita;
  }
});

// src/application/use-cases/CancelarCita.js
var require_CancelarCita = __commonJS({
  "src/application/use-cases/CancelarCita.js"(exports2, module2) {
    "use strict";
    var Cita = require_Cita();
    var EstadoCita = require_EstadoCita();
    var CancelarCita = class {
      constructor(citaRepository) {
        this.repo = citaRepository;
      }
      // ignorarPlazo / rolId / actor: Administrador (rol_id = 1) no tiene restricciones de tiempo (RN-086 🔶)
      async execute(id, { ignorarPlazo = false, rolId = null, actor = {}, anticipacionHoras = 2, cambiadoPor = null, origen = "web", comentario = null } = {}) {
        const row = await this.repo.obtenerPorId(id);
        if (!row) {
          return { success: false, mensaje: "Cita no encontrada" };
        }
        const esAdmin = rolId === 1 || actor?.rol_id === 1 || actor?.rol === "admin" || Boolean(ignorarPlazo);
        const cita = Cita.fromRow(row);
        const cancelada = EstadoCita.fromClave("cancelada");
        if (!cita.puedeTransicionarA(cancelada)) {
          if (cita.estado.esFinal()) {
            return { success: false, mensaje: `La cita est\xE1 en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]` };
          }
          return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "cancelada" [RN-080]` };
        }
        if (!cita.esFutura()) {
          if (!esAdmin) {
            return { success: false, mensaje: "No puedes cancelar una cita que ya pas\xF3." };
          }
        }
        if (!esAdmin && cita.fueraDePlazoCancelacion(anticipacionHoras)) {
          return { success: false, mensaje: `Faltan menos de ${anticipacionHoras} horas para la cita; no es posible cancelarla [RN-086]` };
        }
        const data = await this.repo.cambiarEstado(id, cancelada.id, { cambiadoPor, origen, comentario });
        return { success: true, data, mensaje: "Cita cancelada; el horario qued\xF3 libre [RN-085]" };
      }
    };
    module2.exports = CancelarCita;
  }
});

// src/application/use-cases/ReagendarCita.js
var require_ReagendarCita = __commonJS({
  "src/application/use-cases/ReagendarCita.js"(exports2, module2) {
    "use strict";
    var Cita = require_Cita();
    var Horario = require_Horario();
    var EstadoCita = require_EstadoCita();
    var {
      formatearFechaHoraLocal,
      formatearFechaLocal,
      construirFechaHoraLocal,
      diaSemanaLocal
    } = require_fechaHoraLocal();
    var MS_POR_DIA = 24 * 60 * 60 * 1e3;
    var ReagendarCita = class {
      constructor(citaRepository, horarioRepository, medicoRepository = null) {
        this.citas = citaRepository;
        this.horarios = horarioRepository;
        this.medicos = medicoRepository;
      }
      // Devuelve próximos huecos libres del mismo médico (o del médico elegido
      // dentro de la misma especialidad), con la misma duración, a partir de
      // ahora + anticipacionHoras.
      async proponerHorarios(id, {
        cantidad = 3,
        diasBusqueda = 14,
        anticipacionHoras = 2,
        medico_id = null,
        consultorio_id = null
      } = {}) {
        const row = await this.citas.obtenerPorId(id);
        if (!row) {
          return { success: false, mensaje: "Cita no encontrada" };
        }
        const cita = Cita.fromRow(row);
        if (!cita.estado.esVigente()) {
          return { success: false, mensaje: `Solo se reagendan citas vigentes; la cita est\xE1 "${cita.estado.clave}" [RN-076]` };
        }
        const cambio = await this._validarCambioMedico(cita, medico_id);
        if (!cambio.success) return cambio;
        const medicoObjetivo = cambio.medico_id;
        const mismoMedico = String(medicoObjetivo) === String(cita.medico_id);
        const consultorioObjetivo = consultorio_id ?? (mismoMedico ? cita.consultorio_id : null);
        const desde = Date.now() + anticipacionHoras * 60 * 60 * 1e3;
        const propuestas = [];
        const ahora = /* @__PURE__ */ new Date();
        for (let i = 1; i <= diasBusqueda && propuestas.length < cantidad; i++) {
          const fecha = formatearFechaLocal(new Date(ahora.getTime() + i * MS_POR_DIA));
          if (!fecha) continue;
          const huecos = await this.horarios.buscarHuecos({
            medico_id: medicoObjetivo,
            fecha,
            duracion_minutos: cita.duracion_minutos,
            consultorio_id: consultorioObjetivo
          });
          for (const hueco of huecos) {
            const horaInicio = hueco.hora_inicio.slice(0, 5);
            const fechaHoraLocal = construirFechaHoraLocal(fecha, horaInicio);
            if (!fechaHoraLocal) continue;
            const inicio = new Date(fechaHoraLocal);
            if (inicio.getTime() <= desde) continue;
            propuestas.push({
              fecha_hora: fechaHoraLocal,
              dia_semana: diaSemanaLocal(fechaHoraLocal),
              hora_inicio: horaInicio,
              horario_id: hueco.horario_id,
              consultorio_id: hueco.consultorio_id
            });
            if (propuestas.length >= cantidad) break;
          }
        }
        return {
          success: true,
          data: propuestas,
          mensaje: propuestas.length ? "Horarios libres m\xE1s cercanos [RN-083]" : "No se encontraron horarios libres en los pr\xF3ximos d\xEDas"
        };
      }
      // RN-084: valida de nuevo y aplica el cambio de fecha (y, opcionalmente,
      // de médico dentro de la misma especialidad y de consultorio).
      async execute(id, {
        fecha_hora,
        medico_id = null,
        consultorio_id = null,
        cambiadoPor = null,
        origen = "web",
        comentario = null
      } = {}) {
        if (!fecha_hora) {
          return { success: false, mensaje: "Se requiere la nueva fecha y hora" };
        }
        const row = await this.citas.obtenerPorId(id);
        if (!row) {
          return { success: false, mensaje: "Cita no encontrada" };
        }
        const cita = Cita.fromRow(row);
        if (!cita.estado.esVigente()) {
          return { success: false, mensaje: `Solo se reagendan citas vigentes; la cita est\xE1 "${cita.estado.clave}" [RN-076]` };
        }
        if (cita.fueraDePlazoCancelacion(2)) {
          return { success: false, mensaje: "Faltan menos de 2 horas para la cita; no es posible reagendarla [RN-086]" };
        }
        const cambio = await this._validarCambioMedico(cita, medico_id);
        if (!cambio.success) return cambio;
        const medicoObjetivo = cambio.medico_id;
        const consultorioObjetivo = consultorio_id ?? cita.consultorio_id;
        const nueva = Cita.fromRow({
          ...row,
          fecha_hora,
          medico_id: medicoObjetivo,
          consultorio_id: consultorioObjetivo,
          duracion_minutos: cita.duracion_minutos,
          estado_id: cita.estado_id
        });
        if (!nueva.esFutura()) {
          return { success: false, mensaje: "La nueva fecha debe ser futura [RN-073]" };
        }
        nueva.fecha_fin = nueva.calcularFechaFin();
        const enHorario = await this._dentroDeHorario(nueva);
        if (!enHorario) {
          return { success: false, mensaje: "La nueva fecha cae fuera de un horario activo del m\xE9dico [RN-072]" };
        }
        const traslape = await this.citas.buscarTraslape({
          medico_id: nueva.medico_id,
          fecha_hora: nueva.fecha_hora,
          fecha_fin: nueva.fecha_fin,
          excluirId: cita.id
        });
        if (traslape) {
          return { success: false, mensaje: "El horario ya fue ocupado para ese m\xE9dico [RN-074]" };
        }
        const traslapePaciente = await this.citas.buscarTraslapePaciente({
          paciente_id: cita.paciente_id,
          fecha_hora: nueva.fecha_hora,
          fecha_fin: nueva.fecha_fin,
          excluirId: cita.id
        });
        if (traslapePaciente) {
          return { success: false, mensaje: "El paciente ya tiene otra cita que se traslapa con ese horario [RN-078]" };
        }
        const confirmada = EstadoCita.fromClave("confirmada");
        const cambiaEstado = Number(cita.estado.id) !== Number(confirmada.id);
        if (cambiaEstado && !cita.puedeTransicionarA(confirmada)) {
          return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
        }
        const cambiaMedico = String(nueva.medico_id) !== String(cita.medico_id);
        const cambiaConsultorio = String(nueva.consultorio_id) !== String(cita.consultorio_id);
        const data = await this.citas.reagendar(cita.id, {
          fecha_hora: nueva.fecha_hora,
          medico_id: cambiaMedico ? nueva.medico_id : null,
          consultorio_id: cambiaConsultorio ? nueva.consultorio_id : null,
          estado_id: confirmada.id,
          cambiadoPor,
          origen,
          comentario: comentario || "RN-089: Cita confirmada t\xE1citamente al reagendar"
        });
        return {
          success: true,
          data,
          mensaje: "Cita reagendada con \xE9xito. Tu nuevo horario est\xE1 confirmado."
        };
      }
      // Cambiar de médico solo dentro de la misma especialidad: el paciente
      // conserva el tipo de atención que reservó. El médico nuevo debe estar activo.
      async _validarCambioMedico(cita, medicoId) {
        if (medicoId == null || String(medicoId) === String(cita.medico_id)) {
          return { success: true, medico_id: cita.medico_id };
        }
        if (!this.medicos) {
          return { success: false, mensaje: "No se puede cambiar de m\xE9dico en este momento" };
        }
        const nuevo = await this.medicos.obtenerPorId(medicoId, { soloActivo: true });
        if (!nuevo) {
          return { success: false, mensaje: "El m\xE9dico seleccionado no existe o no est\xE1 activo [RN-031]" };
        }
        const original = await this.medicos.obtenerPorId(cita.medico_id, { soloActivo: true });
        if (!original) {
          return { success: true, medico_id: nuevo.id };
        }
        const especialidadesOriginal = new Set(
          (original.especialidades ?? []).map((e) => String(e.id))
        );
        const comparte = (nuevo.especialidades ?? []).some(
          (e) => especialidadesOriginal.has(String(e.id))
        );
        if (!comparte) {
          return { success: false, mensaje: "Solo puedes cambiar a un m\xE9dico de la misma especialidad" };
        }
        return { success: true, medico_id: nuevo.id };
      }
      async _dentroDeHorario(cita) {
        const bloques = await this.horarios.listarPorMedico(cita.medico_id, {
          soloActivos: true,
          soloDisponibles: true
        });
        const local = formatearFechaHoraLocal(cita.fecha_hora);
        if (!local) return false;
        const diaIso = diaSemanaLocal(cita.fecha_hora);
        const hora = local.hora;
        return bloques.some((bloque) => {
          if (!bloque.activo) return false;
          if (Number(bloque.dia_semana) !== diaIso) return false;
          if (Number(bloque.consultorio_id) !== Number(cita.consultorio_id)) return false;
          return Horario.fromRow(bloque).contieneHora(hora);
        });
      }
    };
    module2.exports = ReagendarCita;
  }
});

// src/application/use-cases/MarcarAsistencia.js
var require_MarcarAsistencia = __commonJS({
  "src/application/use-cases/MarcarAsistencia.js"(exports2, module2) {
    "use strict";
    var Cita = require_Cita();
    var EstadoCita = require_EstadoCita();
    var MarcarAsistencia = class {
      constructor(citaRepository) {
        this.repo = citaRepository;
      }
      // actor: { rol, rol_id, medicoId }
      async execute(id, { asistio, actor = {}, cambiadoPor = null, origen = "web", comentario = null } = {}) {
        const row = await this.repo.obtenerPorId(id);
        if (!row) {
          return { success: false, mensaje: "Cita no encontrada" };
        }
        const esAdmin = actor.rol_id === 1 || actor.rol === "admin";
        const esMedicoAsignado = (actor.rol_id === 2 || actor.rol === "medico") && actor.medicoId != null && Number(actor.medicoId) === Number(row.medico_id);
        if (!esAdmin && !esMedicoAsignado) {
          return {
            success: false,
            mensaje: "Solo el m\xE9dico de la cita o un administrador pueden marcar o corregir la asistencia [RN-082]"
          };
        }
        const cita = Cita.fromRow(row);
        if (cita.estado.clave === "cancelada") {
          return {
            success: false,
            codigo: 400,
            mensaje: `La cita est\xE1 en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]`
          };
        }
        const esCorreccionPasada = cita.estado.clave === "no_asistio" || cita.estado.clave === "completada";
        const ahoraMs = Date.now();
        const fechaHoraMs = new Date(cita.fecha_hora).getTime();
        if (!esAdmin && !esCorreccionPasada && fechaHoraMs > ahoraMs) {
          return {
            success: false,
            codigo: 400,
            mensaje: "No puedes marcar la asistencia de una cita que a\xFAn no ha comenzado."
          };
        }
        const destino = EstadoCita.fromClave(asistio ? "completada" : "no_asistio");
        if (cita.estado.clave === destino.clave) {
          return { success: true, data: row, mensaje: `La cita ya est\xE1 marcada como "${destino.clave}"` };
        }
        if (!cita.puedeTransicionarA(destino)) {
          if (cita.estado.esFinal()) {
            return {
              success: false,
              mensaje: `La cita est\xE1 en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]`
            };
          }
          return {
            success: false,
            mensaje: `No se puede pasar de "${cita.estado.clave}" a "${destino.clave}" [RN-080]`
          };
        }
        const data = await this.repo.cambiarEstado(id, destino.id, { cambiadoPor, origen, comentario });
        return { success: true, data, mensaje: `Cita marcada como "${destino.clave}"` };
      }
    };
    module2.exports = MarcarAsistencia;
  }
});

// src/infrastructure/utils/fechaHoraLocal.js
var require_fechaHoraLocal2 = __commonJS({
  "src/infrastructure/utils/fechaHoraLocal.js"(exports2, module2) {
    "use strict";
    module2.exports = require_fechaHoraLocal();
  }
});

// src/interfaces/http/controllers/CitasController.js
var require_CitasController = __commonJS({
  "src/interfaces/http/controllers/CitasController.js"(exports2, module2) {
    "use strict";
    var PostgresCitaRepository = require_PostgresCitaRepository();
    var PostgresHorarioRepository = require_PostgresHorarioRepository();
    var { PostgresMedicoRepository } = require_PostgresMedicoRepository();
    var AgendarCita = require_AgendarCita();
    var ConfirmarCita = require_ConfirmarCita();
    var CancelarCita = require_CancelarCita();
    var ReagendarCita = require_ReagendarCita();
    var MarcarAsistencia = require_MarcarAsistencia();
    var TraslapeError = require_TraslapeError();
    var validarId = require_validarId();
    var {
      esAdmin,
      rolClave,
      medicoIdDeUsuario,
      pacienteIdDeUsuario
    } = require_identidad();
    var { esFechaISO } = require_rangoFechas();
    var {
      ZONA_HORARIA,
      formatearFechaHoraLocal
    } = require_fechaHoraLocal2();
    var citasRepo = new PostgresCitaRepository();
    var horariosRepo = new PostgresHorarioRepository();
    var medicosRepo = new PostgresMedicoRepository();
    var ESTADOS_VALIDOS = ["pendiente", "confirmada", "reagendada", "cancelada", "completada", "no_asistio"];
    function esErrorDeDatos(error) {
      return error?.code === "22003" || error?.code === "22P02";
    }
    function contextoWeb(req) {
      return {
        cambiadoPor: req.usuario?.id ?? null,
        origen: "web"
      };
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
      }
      console.error("[Citas] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    async function idsDelActor(req, res) {
      const rol = rolClave(req.usuario);
      if (rol === "medico") {
        const medicoId = await medicoIdDeUsuario(req.usuario.id);
        if (!medicoId) {
          res.status(403).json({ ok: false, mensaje: "No tienes un registro de m\xE9dico" });
          return null;
        }
        return { rol, medicoId, pacienteId: null };
      }
      if (rol === "paciente") {
        const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
        if (!pacienteId) {
          res.status(403).json({ ok: false, mensaje: "No tienes un registro de paciente" });
          return null;
        }
        return { rol, medicoId: null, pacienteId };
      }
      return { rol: "admin", medicoId: null, pacienteId: null };
    }
    async function visibilidadFiltro(req) {
      const rol = rolClave(req.usuario);
      if (rol === "paciente") {
        const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
        if (!pacienteId) return null;
        return { paciente_id: pacienteId };
      }
      if (rol === "medico") {
        const medicoId = await medicoIdDeUsuario(req.usuario.id);
        if (!medicoId) return null;
        return { medico_id: medicoId };
      }
      return {};
    }
    async function exigirAccesoCita(req, res, cita) {
      if (esAdmin(req.usuario)) return true;
      const rol = rolClave(req.usuario);
      if (rol === "paciente") {
        const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
        if (pacienteId && Number(pacienteId) === Number(cita.paciente_id)) return true;
      }
      if (rol === "medico") {
        const medicoId = await medicoIdDeUsuario(req.usuario.id);
        if (medicoId && Number(medicoId) === Number(cita.medico_id)) return true;
      }
      res.status(403).json({ ok: false, mensaje: "No tienes permiso sobre esta cita [RN-053]" });
      return false;
    }
    function formatearCita(row, formatoLocal = false) {
      const fechaLocal = formatearFechaHoraLocal(row.fecha_hora);
      const fechaFinLocal = formatearFechaHoraLocal(row.fecha_fin);
      return {
        id: row.id,
        uuid_publico: row.uuid_publico,
        paciente_id: row.paciente_id,
        medico_id: row.medico_id,
        consultorio_id: row.consultorio_id,
        // `formato=local` lo usan las herramientas de n8n: así el modelo recibe
        // directamente 08:30 en lugar del ISO UTC y no depende de interpretarlo.
        fecha_hora: formatoLocal ? fechaLocal?.iso ?? row.fecha_hora : row.fecha_hora,
        // Campos de presentación para n8n/Telegram: la API sigue exponiendo
        // `fecha_hora` en UTC por defecto, pero estos valores ya están en la zona
        // de la clínica.
        fecha_local: fechaLocal?.fecha ?? null,
        hora_local: fechaLocal?.hora ?? null,
        fecha_hora_local: fechaLocal?.iso ?? null,
        zona_horaria: ZONA_HORARIA,
        duracion_minutos: row.duracion_minutos,
        fecha_fin: formatoLocal ? fechaFinLocal?.iso ?? row.fecha_fin : row.fecha_fin,
        estado_id: row.estado_id,
        estado: row.estado,
        motivo: row.motivo,
        notas: row.notas,
        paciente_nombre: row.paciente_nombre ?? null,
        medico_nombre: row.medico_nombre ? `Dr. ${row.medico_nombre}` : null,
        consultorio_nombre: row.consultorio_nombre ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    }
    async function listar(req, res) {
      try {
        const base = await visibilidadFiltro(req);
        if (!base) return res.status(403).json({ ok: false, mensaje: "No tienes permiso para ver citas" });
        const filtros = { ...base };
        const q = Object.fromEntries(
          Object.entries(req.query).filter(([, valor]) => valor !== "")
        );
        if (q.estado !== void 0) {
          const estado = String(q.estado).trim().toLowerCase();
          if (!ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({
              ok: false,
              mensaje: `estado inv\xE1lido; use: ${ESTADOS_VALIDOS.join(", ")}`
            });
          }
          filtros.estado = estado;
        }
        if (q.estados !== void 0) {
          const estados = [...new Set(
            String(q.estados).split(",").map((estado) => estado.trim().toLowerCase()).filter(Boolean)
          )];
          if (estados.length === 0 || estados.some((estado) => !ESTADOS_VALIDOS.includes(estado))) {
            return res.status(400).json({
              ok: false,
              mensaje: `estados inv\xE1lidos; use una lista separada por comas con: ${ESTADOS_VALIDOS.join(", ")}`
            });
          }
          filtros.estados = estados;
        }
        if (q.fecha_desde !== void 0) {
          if (!esFechaISO(q.fecha_desde)) {
            return res.status(400).json({ ok: false, mensaje: "fecha_desde debe ser YYYY-MM-DD" });
          }
          filtros.fecha_desde = `${q.fecha_desde}T00:00:00`;
        }
        if (q.fecha_hasta !== void 0) {
          if (!esFechaISO(q.fecha_hasta)) {
            return res.status(400).json({ ok: false, mensaje: "fecha_hasta debe ser YYYY-MM-DD" });
          }
          filtros.fecha_hasta = `${q.fecha_hasta}T23:59:59.999`;
        }
        const page = Math.max(1, parseInt(q.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 10));
        filtros.page = page;
        filtros.limit = limit;
        const resultado = await citasRepo.listar(filtros);
        const formatoLocal = req.query.formato === "local";
        return res.json({
          ok: true,
          mensaje: "Lista de citas",
          data: {
            citas: resultado.data.map((cita) => formatearCita(cita, formatoLocal)),
            total: resultado.total,
            page: resultado.page,
            limit: resultado.limit
          }
        });
      } catch (error) {
        return respuestaError500(res, "Error al obtener citas", error);
      }
    }
    async function misPacientes(req, res) {
      try {
        const medicoId = await medicoIdDeUsuario(req.usuario.id);
        if (!medicoId) return res.status(403).json({ ok: false, mensaje: "No tienes un registro de m\xE9dico" });
        const data = await citasRepo.pacientesDelMedico(medicoId);
        return res.json({ ok: true, mensaje: "Pacientes de tu agenda", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener pacientes", error);
      }
    }
    async function obtenerPorId(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        return res.json({
          ok: true,
          mensaje: "Cita encontrada",
          data: formatearCita(cita, req.query.formato === "local")
        });
      } catch (error) {
        return respuestaError500(res, "Error al obtener cita", error);
      }
    }
    async function crear(req, res) {
      try {
        const datos = req.citaValidada;
        const actor = await idsDelActor(req, res);
        if (!actor) return;
        let pacienteId = datos.paciente_id ?? null;
        if (actor.rol === "paciente") {
          pacienteId = actor.pacienteId;
        } else if (actor.rol === "medico") {
          return res.status(403).json({ ok: false, mensaje: "Un m\xE9dico no puede agendar citas" });
        } else if (!pacienteId) {
          return res.status(400).json({ ok: false, mensaje: "paciente_id es requerido para agendar en nombre de un paciente" });
        }
        const caso = new AgendarCita(citasRepo, horariosRepo);
        const resultado = await caso.execute({
          paciente_id: pacienteId,
          medico_id: datos.medico_id,
          consultorio_id: datos.consultorio_id,
          fecha_hora: datos.fecha_hora,
          duracion_minutos: datos.duracion_minutos,
          motivo: datos.motivo,
          notas: datos.notas
        });
        if (!resultado.success) {
          const permiso = /permiso|solo el médico/i.test(resultado.mensaje);
          const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
          const codigo = permiso ? 403 : conflicto ? 409 : 400;
          return res.status(codigo).json({ ok: false, mensaje: resultado.mensaje });
        }
        const creada = await citasRepo.obtenerPorId(resultado.data.id);
        return res.status(201).json({
          ok: true,
          mensaje: resultado.mensaje,
          data: creada ? formatearCita(creada, req.query.formato === "local") : resultado.data
        });
      } catch (error) {
        if (error instanceof TraslapeError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al agendar cita", error);
      }
    }
    async function confirmar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        const caso = new ConfirmarCita(citasRepo);
        const resultado = await caso.execute(id, contextoWeb(req));
        if (!resultado.success) {
          const permiso = /permiso|solo el médico/i.test(resultado.mensaje);
          const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
          const codigo = permiso ? 403 : conflicto ? 409 : 400;
          return res.status(codigo).json({ ok: false, mensaje: resultado.mensaje });
        }
        const actualizada = await citasRepo.obtenerPorId(id);
        return res.json({
          ok: true,
          mensaje: resultado.mensaje,
          data: actualizada ? formatearCita(actualizada, req.query.formato === "local") : resultado.data
        });
      } catch (error) {
        if (error instanceof TraslapeError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al confirmar cita", error);
      }
    }
    async function cambiarEstado(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        const { estado, ignorarPlazo } = req.cambioEstado;
        const actor = {
          rol: rolClave(req.usuario),
          rol_id: req.usuario?.rol_id,
          medicoId: await medicoIdDeUsuario(req.usuario.id)
        };
        let resultado;
        if (estado === "cancelada") {
          const caso = new CancelarCita(citasRepo);
          const esAdminActor = req.usuario?.rol_id === 1 || esAdmin(req.usuario) || ignorarPlazo;
          resultado = await caso.execute(id, {
            ignorarPlazo: esAdminActor,
            rolId: req.usuario?.rol_id,
            actor,
            ...contextoWeb(req)
          });
        } else if (estado === "completada" || estado === "no_asistio") {
          const caso = new MarcarAsistencia(citasRepo);
          resultado = await caso.execute(id, { asistio: estado === "completada", actor, ...contextoWeb(req) });
        } else {
          return res.status(400).json({
            ok: false,
            mensaje: `Use PUT /citas/${id}/confirmar para confirmar; el estado "${estado}" no se aplica por aqu\xED`
          });
        }
        if (!resultado.success) {
          const permiso = /permiso|solo el médico/i.test(resultado.mensaje);
          const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
          const codigo = permiso ? 403 : conflicto ? 409 : 400;
          return res.status(codigo).json({ ok: false, mensaje: resultado.mensaje });
        }
        const actualizada = await citasRepo.obtenerPorId(id);
        return res.json({
          ok: true,
          mensaje: resultado.mensaje,
          data: actualizada ? formatearCita(actualizada, req.query.formato === "local") : resultado.data
        });
      } catch (error) {
        if (error instanceof TraslapeError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al cambiar el estado de la cita", error);
      }
    }
    async function reagendar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        let mensaje = "Cita actualizada correctamente";
        if (req.notasActualizadas !== void 0) {
          const actor = await idsDelActor(req, res);
          if (!actor) return;
          if (actor.rol === "paciente") {
            return res.status(403).json({ ok: false, mensaje: "Un paciente no puede editar las notas m\xE9dicas" });
          }
          if (actor.rol === "medico" && Number(actor.medicoId) !== Number(cita.medico_id)) {
            return res.status(403).json({ ok: false, mensaje: "Solo el m\xE9dico asignado puede editar las notas" });
          }
          await citasRepo.actualizar(id, { notas: req.notasActualizadas });
          mensaje = "Notas actualizadas con \xE9xito";
        }
        if (req.reagendamiento) {
          const caso = new ReagendarCita(citasRepo, horariosRepo, medicosRepo);
          const resultado = await caso.execute(id, {
            fecha_hora: req.reagendamiento.fecha_hora,
            medico_id: req.reagendamiento.medico_id,
            consultorio_id: req.reagendamiento.consultorio_id,
            ...contextoWeb(req)
          });
          if (!resultado.success) {
            const permiso = /permiso|solo el médico/i.test(resultado.mensaje);
            const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
            const codigo = permiso ? 403 : conflicto ? 409 : 400;
            return res.status(codigo).json({ ok: false, mensaje: resultado.mensaje });
          }
          mensaje = resultado.mensaje;
        }
        const actualizada = await citasRepo.obtenerPorId(id);
        return res.json({
          ok: true,
          mensaje,
          data: actualizada ? formatearCita(actualizada, req.query.formato === "local") : cita
        });
      } catch (error) {
        if (error instanceof TraslapeError) {
          return res.status(409).json({ ok: false, mensaje: error.message });
        }
        return respuestaError500(res, "Error al actualizar la cita", error);
      }
    }
    async function propuestasReagendamiento(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        const medicoId = req.query.medico_id === void 0 || req.query.medico_id === "" ? null : validarId(req.query.medico_id, "bigint");
        if (req.query.medico_id !== void 0 && req.query.medico_id !== "" && !medicoId) {
          return res.status(400).json({ ok: false, mensaje: "medico_id inv\xE1lido" });
        }
        const consultorioId = req.query.consultorio_id === void 0 || req.query.consultorio_id === "" ? null : validarId(req.query.consultorio_id, "bigint");
        if (req.query.consultorio_id !== void 0 && req.query.consultorio_id !== "" && !consultorioId) {
          return res.status(400).json({ ok: false, mensaje: "consultorio_id inv\xE1lido" });
        }
        const caso = new ReagendarCita(citasRepo, horariosRepo, medicosRepo);
        const resultado = await caso.proponerHorarios(id, {
          medico_id: medicoId,
          consultorio_id: consultorioId
        });
        if (!resultado.success) {
          return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
      } catch (error) {
        return respuestaError500(res, "Error al proponer horarios", error);
      }
    }
    async function eliminar(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        const caso = new CancelarCita(citasRepo);
        const esAdminActor = req.usuario?.rol_id === 1 || esAdmin(req.usuario) || req.query.ignorarPlazo === "true";
        const actor = {
          rol: rolClave(req.usuario),
          rol_id: req.usuario?.rol_id
        };
        const resultado = await caso.execute(id, {
          ignorarPlazo: esAdminActor,
          rolId: req.usuario?.rol_id,
          actor,
          ...contextoWeb(req)
        });
        if (!resultado.success) {
          const permiso = /permiso|solo el médico/i.test(resultado.mensaje);
          const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
          const codigo = permiso ? 403 : conflicto ? 409 : 400;
          return res.status(codigo).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: { id } });
      } catch (error) {
        return respuestaError500(res, "Error al cancelar cita", error);
      }
    }
    async function historial(req, res) {
      try {
        const id = validarId(req.params.id, "bigint");
        if (!id) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citasRepo.obtenerPorId(id);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!await exigirAccesoCita(req, res, cita)) return;
        const data = await citasRepo.listarHistorial(id);
        return res.json({ ok: true, mensaje: "Historial de la cita", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener historial", error);
      }
    }
    module2.exports = {
      listar,
      misPacientes,
      obtenerPorId,
      crear,
      confirmar,
      cambiarEstado,
      reagendar,
      propuestasReagendamiento,
      eliminar,
      historial
    };
  }
});

// src/interfaces/http/middlewares/validarCita.js
var require_validarCita = __commonJS({
  "src/interfaces/http/middlewares/validarCita.js"(exports2, module2) {
    "use strict";
    var validarId = require_validarId();
    var DURACION_MIN = 10;
    var DURACION_MAX = 240;
    var DURACION_DEFECTO = 30;
    var MAX_TEXTO = 1e3;
    function responder400(res, mensaje) {
      return res.status(400).json({ ok: false, mensaje });
    }
    function normalizarTexto(valor) {
      if (valor === void 0 || valor === null) return null;
      if (typeof valor !== "string") return { error: "Debe ser texto" };
      const limpio = valor.trim();
      if (limpio === "") return null;
      if (limpio.length > MAX_TEXTO) return { error: `M\xE1ximo ${MAX_TEXTO} caracteres` };
      return limpio;
    }
    function normalizarFechaHora(valor) {
      if (typeof valor !== "string" && !(valor instanceof Date)) {
        return { error: "La fecha y hora deben enviarse como texto ISO 8601 (YYYY-MM-DDTHH:mm:ss)" };
      }
      const fecha = new Date(valor);
      if (Number.isNaN(fecha.getTime())) {
        return { error: "La fecha y hora no son v\xE1lidas" };
      }
      return { fechaISO: fecha.toISOString() };
    }
    function normalizarDuracion(valor) {
      if (valor === void 0 || valor === null || valor === "") return DURACION_DEFECTO;
      const numero = Number(valor);
      if (!Number.isInteger(numero) || numero < DURACION_MIN || numero > DURACION_MAX) {
        return { error: `La duraci\xF3n debe ser un n\xFAmero entero entre ${DURACION_MIN} y ${DURACION_MAX} minutos [RN-071]` };
      }
      return { duracion: numero };
    }
    function validarCreacionCita(req, res, next) {
      const body = req.body || {};
      const medicoId = validarId(body.medico_id, "bigint");
      if (!medicoId) return responder400(res, "medico_id inv\xE1lido o ausente");
      const consultorioId = validarId(body.consultorio_id, "bigint");
      if (!consultorioId) return responder400(res, "consultorio_id inv\xE1lido o ausente");
      const fecha = normalizarFechaHora(body.fecha_hora);
      if (fecha.error) return responder400(res, fecha.error);
      const duracion = normalizarDuracion(body.duracion_minutos);
      if (duracion.error) return responder400(res, duracion.error);
      const motivo = normalizarTexto(body.motivo);
      if (motivo && motivo.error) return responder400(res, `motivo: ${motivo.error}`);
      const notas = normalizarTexto(body.notas);
      if (notas && notas.error) return responder400(res, `notas: ${notas.error}`);
      req.citaValidada = {
        medico_id: medicoId,
        consultorio_id: consultorioId,
        fecha_hora: fecha.fechaISO,
        duracion_minutos: duracion.duracion,
        motivo: motivo || null,
        notas: notas || null
      };
      if (body.paciente_id !== void 0 && body.paciente_id !== null && body.paciente_id !== "") {
        const pacienteId = validarId(body.paciente_id, "bigint");
        if (!pacienteId) return responder400(res, "paciente_id inv\xE1lido");
        req.citaValidada.paciente_id = pacienteId;
      }
      next();
    }
    function validarReagendamiento(req, res, next) {
      const body = req.body || {};
      if (body.notas !== void 0) {
        const notas = normalizarTexto(body.notas);
        if (notas && notas.error) return responder400(res, `notas: ${notas.error}`);
        req.notasActualizadas = notas || null;
      }
      if (body.fecha_hora !== void 0) {
        const fecha = normalizarFechaHora(body.fecha_hora);
        if (fecha.error) return responder400(res, fecha.error);
        const medicoId = body.medico_id === void 0 || body.medico_id === null || body.medico_id === "" ? null : validarId(body.medico_id, "bigint");
        if (body.medico_id !== void 0 && body.medico_id !== null && body.medico_id !== "" && !medicoId) {
          return responder400(res, "medico_id inv\xE1lido");
        }
        const consultorioId = body.consultorio_id === void 0 || body.consultorio_id === null || body.consultorio_id === "" ? null : validarId(body.consultorio_id, "bigint");
        if (body.consultorio_id !== void 0 && body.consultorio_id !== null && body.consultorio_id !== "" && !consultorioId) {
          return responder400(res, "consultorio_id inv\xE1lido");
        }
        req.reagendamiento = {
          fecha_hora: fecha.fechaISO,
          medico_id: medicoId,
          consultorio_id: consultorioId
        };
      }
      if (req.notasActualizadas === void 0 && !req.reagendamiento) {
        return responder400(res, "Se requiere fecha_hora para reagendar o notas para actualizar");
      }
      next();
    }
    function validarCambioEstado(req, res, next) {
      const body = req.body || {};
      const estado = typeof body.estado === "string" ? body.estado.trim().toLowerCase() : "";
      const permitidos = ["cancelada", "completada", "no_asistio", "confirmada", "reagendada"];
      if (!permitidos.includes(estado)) {
        return responder400(res, `"estado" debe ser uno de: ${permitidos.join(", ")}`);
      }
      req.cambioEstado = { estado, ignorarPlazo: body.ignorarPlazo === true };
      next();
    }
    module2.exports = {
      validarCreacionCita,
      validarReagendamiento,
      validarCambioEstado
    };
  }
});

// src/interfaces/http/routes/citas.routes.js
var require_citas_routes = __commonJS({
  "src/interfaces/http/routes/citas.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_CitasController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    var { validarCreacionCita, validarReagendamiento, validarCambioEstado } = require_validarCita();
    router.use(authMiddleware);
    router.get("/mis-pacientes", roleMiddleware("medico"), ctrl.misPacientes);
    router.get("/", ctrl.listar);
    router.post("/", roleMiddleware("paciente", "admin"), validarCreacionCita, ctrl.crear);
    router.get("/:id", ctrl.obtenerPorId);
    router.get("/:id/historial", ctrl.historial);
    router.get("/:id/propuestas", ctrl.propuestasReagendamiento);
    router.put("/:id/confirmar", ctrl.confirmar);
    router.put("/:id/estado", validarCambioEstado, ctrl.cambiarEstado);
    router.put("/:id", validarReagendamiento, ctrl.reagendar);
    router.delete("/:id", ctrl.eliminar);
    module2.exports = router;
  }
});

// src/domain/ports/RecordatorioRepository.js
var require_RecordatorioRepository = __commonJS({
  "src/domain/ports/RecordatorioRepository.js"(exports2, module2) {
    "use strict";
    var RecordatorioRepository = class {
      async crear(recordatorio) {
        throw new Error("M\xE9todo no implementado");
      }
      async obtenerPorId(id) {
        throw new Error("M\xE9todo no implementado");
      }
      async listarPorCita(cita_id) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-105: no se envía el mismo tipo de recordatorio dos veces para la misma cita
      async existeTipo(cita_id, tipo) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-102: citas vigentes, con telegram vinculado y sin recordatorio de ese tipo
      async buscarCandidatos({ tipo, ventanaHoras = 24 } = {}) {
        throw new Error("M\xE9todo no implementado");
      }
      async marcarEnviado(id) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-106: si el envío falla, el estado lo refleja y la cita no se ve afectada
      async marcarFallido(id) {
        throw new Error("M\xE9todo no implementado");
      }
      // RN-103 / RN-104: respuesta del paciente (confirmar, cancelar, reagendar)
      async registrarRespuesta(id, respuesta) {
        throw new Error("M\xE9todo no implementado");
      }
    };
    module2.exports = RecordatorioRepository;
  }
});

// src/domain/entities/Recordatorio.js
var require_Recordatorio = __commonJS({
  "src/domain/entities/Recordatorio.js"(exports2, module2) {
    "use strict";
    var estadosValidos = {
      enviado: "enviado",
      fallido: "fallido"
    };
    var Recordatorio = class _Recordatorio {
      static TIPOS = Object.freeze({ H24: "24h", H2: "2h" });
      static RESPUESTAS = Object.freeze({ CONFIRMAR: "confirmar", CANCELAR: "cancelar", REAGENDAR: "reagendar" });
      constructor({ id, cita_id, canal = "telegram", tipo, estado = "enviado", respuesta = null, enviado_at, respondido_at }) {
        this.id = id;
        this.cita_id = cita_id;
        this.canal = canal;
        this.tipo = tipo;
        this.estado = estado;
        this.respuesta = respuesta;
        this.enviado_at = enviado_at;
        this.respondido_at = respondido_at;
      }
      static fromRow(row) {
        return new _Recordatorio(row);
      }
      // RN-100: primer recordatorio 24 horas antes
      esDe24Horas() {
        return this.tipo === _Recordatorio.TIPOS.H24;
      }
      // RN-101: segundo recordatorio 2 horas antes
      esDe2Horas() {
        return this.tipo === _Recordatorio.TIPOS.H2;
      }
      // RN-103: el paciente responde confirmar, cancelar o reagendar
      tieneRespuesta() {
        return this.respuesta !== null && this.respuesta !== void 0;
      }
      // RN-106: el estado refleja si el envío falló; la cita no se ve afectada
      fueExitoso() {
        return this.estado === estadosValidos.enviado;
      }
      fallo() {
        return this.estado === estadosValidos.fallido;
      }
    };
    module2.exports = Recordatorio;
  }
});

// src/infrastructure/adapters/PostgresRecordatorioRepository.js
var require_PostgresRecordatorioRepository = __commonJS({
  "src/infrastructure/adapters/PostgresRecordatorioRepository.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    var RecordatorioRepository = require_RecordatorioRepository();
    var Recordatorio = require_Recordatorio();
    var COLUMNAS = "id, cita_id, canal, tipo, estado, respuesta, enviado_at, respondido_at";
    var PostgresRecordatorioRepository = class extends RecordatorioRepository {
      // RN-105: se crea un recordatorio de un tipo dado solo si aún no existe para
      // esa cita. ON CONFLICT hace que dos procesos concurrentes no dupliquen.
      async crear({ cita_id, canal = "telegram", tipo, estado = "enviado" }) {
        const result = await db.query(
          `INSERT INTO recordatorios (cita_id, canal, tipo, estado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cita_id, tipo) DO NOTHING
       RETURNING ${COLUMNAS}`,
          [cita_id, canal, tipo, estado]
        );
        return result.rows[0] || null;
      }
      async obtenerPorId(id) {
        const result = await db.query(`SELECT ${COLUMNAS} FROM recordatorios WHERE id = $1`, [id]);
        return result.rows[0] || null;
      }
      async listarPorCita(cita_id) {
        const result = await db.query(
          `SELECT ${COLUMNAS} FROM recordatorios WHERE cita_id = $1 ORDER BY enviado_at ASC`,
          [cita_id]
        );
        return result.rows;
      }
      // RN-105: no se envía el mismo tipo de recordatorio dos veces para la misma cita.
      async existeTipo(cita_id, tipo) {
        const result = await db.query(
          `SELECT 1 FROM recordatorios WHERE cita_id = $1 AND tipo = $2 LIMIT 1`,
          [cita_id, tipo]
        );
        return result.rows.length > 0;
      }
      // RN-102: citas vigentes, con telegram vinculado y sin recordatorio de ese tipo.
      async buscarCandidatos({ tipo, ventanaHoras = 24 } = {}) {
        const result = await db.query(
          `SELECT c.id AS cita_id, c.uuid_publico, c.fecha_hora, c.duracion_minutos,
              p.telegram_chat_id,
              um.nombre AS medico_nombre, up.nombre AS paciente_nombre,
              ec.clave AS estado
       FROM citas c
       JOIN pacientes p ON p.id = c.paciente_id AND p.deleted_at IS NULL
       JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
       JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
       JOIN usuarios up ON up.id = p.usuario_id AND up.deleted_at IS NULL
       JOIN estados_cita ec ON ec.id = c.estado_id
       WHERE c.estado_id IN (SELECT id FROM estados_cita
                                 WHERE clave IN ('pendiente','confirmada','reagendada'))
         AND p.telegram_chat_id IS NOT NULL
         AND m.activo = true
         AND up.estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo')
         AND c.fecha_hora > now()
         AND c.fecha_hora <= now() + ($1 || ' hours')::interval
         AND NOT EXISTS (
           SELECT 1 FROM recordatorios r WHERE r.cita_id = c.id AND r.tipo = $2
         )
       ORDER BY c.fecha_hora ASC`,
          [ventanaHoras, tipo]
        );
        return result.rows;
      }
      async marcarEnviado(id) {
        const result = await db.query(
          `UPDATE recordatorios SET estado = 'enviado', enviado_at = now() WHERE id = $1 RETURNING ${COLUMNAS}`,
          [id]
        );
        return result.rows[0] || null;
      }
      // RN-106: si el envío falla, el estado lo refleja y la cita no se ve afectada.
      async marcarFallido(id) {
        const result = await db.query(
          `UPDATE recordatorios SET estado = 'fallido' WHERE id = $1 RETURNING ${COLUMNAS}`,
          [id]
        );
        return result.rows[0] || null;
      }
      // RN-103 / RN-104: respuesta del paciente (confirmar, cancelar, reagendar).
      async registrarRespuesta(id, respuesta) {
        const valido = Object.values(Recordatorio.RESPUESTAS);
        if (!valido.includes(respuesta)) {
          throw new Error(`Respuesta inv\xE1lida: debe ser una de ${valido.join(", ")}`);
        }
        const result = await db.query(
          `UPDATE recordatorios SET respuesta = $1, respondido_at = now() WHERE id = $2 RETURNING ${COLUMNAS}`,
          [respuesta, id]
        );
        return result.rows[0] || null;
      }
    };
    module2.exports = PostgresRecordatorioRepository;
  }
});

// src/infrastructure/adapters/N8nNotificacionAdapter.js
var require_N8nNotificacionAdapter = __commonJS({
  "src/infrastructure/adapters/N8nNotificacionAdapter.js"(exports2, module2) {
    "use strict";
    var {
      ZONA_HORARIA,
      formatearTextoLocal,
      formatearFechaHoraLocal
    } = require_fechaHoraLocal2();
    var N8nNotificacionAdapter = class {
      constructor({ webhookUrl = process.env.N8N_WEBHOOK_URL, secret = process.env.N8N_WEBHOOK_SECRET, timeoutMs = 8e3 } = {}) {
        this.webhookUrl = webhookUrl;
        this.secret = secret;
        this.timeoutMs = timeoutMs;
      }
      _urlLista() {
        return typeof this.webhookUrl === "string" && this.webhookUrl.trim() !== "";
      }
      async _post(payload) {
        if (!this._urlLista()) {
          return { ok: false, error: "N8N_WEBHOOK_URL no est\xE1 configurado" };
        }
        const control = AbortSignal.timeout(this.timeoutMs);
        try {
          const respuesta = await fetch(this.webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...this.secret ? { "x-webhook-secret": this.secret } : {}
            },
            body: JSON.stringify(payload),
            signal: control
          });
          if (!respuesta.ok) {
            return { ok: false, error: `n8n respondi\xF3 ${respuesta.status}` };
          }
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      }
      async enviar({ chatId, mensaje, tipo = "texto", referencia = null }) {
        return this._post({ accion: "enviar", chatId, mensaje, tipo, referencia });
      }
      // RN-100 / RN-101: recordatorio de 24 h o 2 h antes de la cita.
      async enviarRecordatorio({ chatId, cita, tipo }) {
        const fechaLocal = formatearFechaHoraLocal(cita.fecha_hora);
        const cuando = formatearTextoLocal(cita.fecha_hora);
        const mensaje = tipo === "24h" ? `Te recordamos tu cita m\xE9dica ma\xF1ana (${cuando}). Responde CONFIRMAR, CANCELAR o REAGENDAR.` : `Tu cita m\xE9dica es en 2 horas (${cuando}). Responde CONFIRMAR, CANCELAR o REAGENDAR.`;
        return this._post({
          accion: "recordatorio",
          tipo,
          chatId,
          mensaje,
          cita: {
            uuid_publico: cita.uuid_publico,
            fecha_hora: cita.fecha_hora,
            fecha_local: fechaLocal?.fecha ?? null,
            hora_local: fechaLocal?.hora ?? null,
            fecha_hora_local: fechaLocal?.iso ?? null,
            zona_horaria: ZONA_HORARIA,
            duracion_minutos: cita.duracion_minutos,
            medico_nombre: cita.medico_nombre
          }
        });
      }
    };
    module2.exports = N8nNotificacionAdapter;
  }
});

// src/application/use-cases/EnviarRecordatorio.js
var require_EnviarRecordatorio = __commonJS({
  "src/application/use-cases/EnviarRecordatorio.js"(exports2, module2) {
    "use strict";
    var Recordatorio = require_Recordatorio();
    var EnviarRecordatorio = class {
      constructor(recordatorioRepository, notificacionPort) {
        this.repo = recordatorioRepository;
        this.notif = notificacionPort;
      }
      // Busca candidatos (RN-102) y envía el tipo indicado. Sin candidatos no hace nada.
      async execute({ tipo = Recordatorio.TIPOS.H24, ventanaHoras = null } = {}) {
        if (!Object.values(Recordatorio.TIPOS).includes(tipo)) {
          return { success: false, mensaje: `Tipo de recordatorio inv\xE1lido: use "${Recordatorio.TIPOS.H24}" o "${Recordatorio.TIPOS.H2}"` };
        }
        const ventana = ventanaHoras != null ? ventanaHoras : tipo === Recordatorio.TIPOS.H24 ? 24 : 2;
        const candidatos = await this.repo.buscarCandidatos({ tipo, ventanaHoras: ventana });
        let enviados = 0;
        let fallidos = 0;
        const detalles = [];
        for (const cand of candidatos) {
          if (await this.repo.existeTipo(cand.cita_id, tipo)) continue;
          const recordatorio = await this.repo.crear({ cita_id: cand.cita_id, canal: "telegram", tipo });
          if (!recordatorio) continue;
          const r = await this.notif.enviarRecordatorio({
            chatId: cand.telegram_chat_id,
            cita: cand,
            tipo
          });
          if (r.ok) {
            await this.repo.marcarEnviado(recordatorio.id);
            enviados++;
            detalles.push({ cita_id: cand.cita_id, ok: true });
          } else {
            await this.repo.marcarFallido(recordatorio.id);
            fallidos++;
            detalles.push({ cita_id: cand.cita_id, ok: false, error: r.error });
          }
        }
        return {
          success: true,
          data: { total: candidatos.length, enviados, fallidos, detalles },
          mensaje: `${enviados} recordatorio(s) enviado(s), ${fallidos} fallido(s)`
        };
      }
    };
    module2.exports = EnviarRecordatorio;
  }
});

// src/application/use-cases/ProcesarRespuestaTelegram.js
var require_ProcesarRespuestaTelegram = __commonJS({
  "src/application/use-cases/ProcesarRespuestaTelegram.js"(exports2, module2) {
    "use strict";
    var Cita = require_Cita();
    var Recordatorio = require_Recordatorio();
    var EstadoCita = require_EstadoCita();
    var ReagendarCita = require_ReagendarCita();
    var ProcesarRespuestaTelegram = class {
      constructor(citaRepository, recordatorioRepository, horarioRepository) {
        this.citas = citaRepository;
        this.recordatorios = recordatorioRepository;
        this.reagendar = new ReagendarCita(citaRepository, horarioRepository);
      }
      async execute({ chatId = null, uuidCita, respuesta, recordatorioId = null, fecha_hora = null, origen = "telegram", cambiadoPor = null } = {}) {
        if (!uuidCita) {
          return { success: false, mensaje: "Falta el identificador de la cita" };
        }
        if (!Object.values(Recordatorio.RESPUESTAS).includes(respuesta)) {
          return { success: false, mensaje: `Respuesta inv\xE1lida: use "${Recordatorio.RESPUESTAS.CONFIRMAR}", "${Recordatorio.RESPUESTAS.CANCELAR}" o "${Recordatorio.RESPUESTAS.REAGENDAR}"` };
        }
        const row = await this.citas.obtenerPorUuid(uuidCita);
        if (!row) {
          return { success: false, mensaje: "Cita no encontrada" };
        }
        const cita = Cita.fromRow(row);
        let resultado;
        switch (respuesta) {
          case Recordatorio.RESPUESTAS.CONFIRMAR:
            resultado = await this._confirmar(cita, chatId, { origen, cambiadoPor });
            break;
          case Recordatorio.RESPUESTAS.CANCELAR:
            resultado = await this._cancelar(cita, chatId, { origen, cambiadoPor });
            break;
          case Recordatorio.RESPUESTAS.REAGENDAR:
            if (fecha_hora) {
              const cambio = await this.reagendar.execute(cita.id, {
                fecha_hora,
                cambiadoPor: cambiadoPor ?? cita.paciente_usuario_id,
                origen
              });
              resultado = { ...cambio, chatId };
            } else {
              const propuestas = await this.reagendar.proponerHorarios(cita.id);
              resultado = {
                ...propuestas,
                chatId,
                mensaje: propuestas.success && propuestas.data.length ? "Elige una de estas opciones para reagendar [RN-083]" : propuestas.mensaje
              };
            }
            break;
          default:
            resultado = { success: false, mensaje: "Respuesta no procesada" };
        }
        if (resultado.success) {
          try {
            await this._registrarRespuesta(cita.id, respuesta, recordatorioId);
          } catch (error) {
            console.error("[Telegram] No se pudo registrar la respuesta:", error.message);
          }
        }
        return resultado;
      }
      async _registrarRespuesta(citaId, respuesta, recordatorioId) {
        let recordatorio = null;
        if (recordatorioId) {
          recordatorio = await this.recordatorios.obtenerPorId(recordatorioId);
          if (recordatorio && Number(recordatorio.cita_id) !== Number(citaId)) recordatorio = null;
        }
        if (!recordatorio) {
          const lista = await this.recordatorios.listarPorCita(citaId);
          recordatorio = [...lista].reverse().find((r) => r.respuesta == null) || lista[lista.length - 1] || null;
        }
        if (recordatorio) {
          await this.recordatorios.registrarRespuesta(recordatorio.id, respuesta);
        }
      }
      async _confirmar(cita, chatId, { origen = "telegram", cambiadoPor = null } = {}) {
        const confirmada = EstadoCita.fromClave("confirmada");
        if (!cita.estado.esVigente()) {
          return { success: false, chatId, mensaje: `La cita ya no est\xE1 vigente (estado "${cita.estado.clave}")` };
        }
        if (!cita.puedeTransicionarA(confirmada)) {
          return { success: false, chatId, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
        }
        const data = await this.citas.cambiarEstado(cita.id, confirmada.id, {
          cambiadoPor: cambiadoPor ?? cita.paciente_usuario_id,
          origen
        });
        return { success: true, chatId, data, mensaje: "Cita confirmada por Telegram" };
      }
      async _cancelar(cita, chatId, { origen = "telegram", cambiadoPor = null } = {}) {
        if (!cita.estado.esVigente()) {
          return { success: false, chatId, mensaje: `La cita ya no est\xE1 vigente (estado "${cita.estado.clave}")` };
        }
        const cancelada = EstadoCita.fromClave("cancelada");
        if (!cita.puedeTransicionarA(cancelada)) {
          return { success: false, chatId, mensaje: `No se puede pasar de "${cita.estado.clave}" a "cancelada" [RN-080]` };
        }
        if (!cita.esFutura()) {
          return { success: false, chatId, mensaje: "No puedes cancelar una cita que ya pas\xF3. Contacta a la cl\xEDnica para m\xE1s informaci\xF3n." };
        }
        if (cita.fueraDePlazoCancelacion(2)) {
          return { success: false, chatId, mensaje: "Faltan menos de 2 horas para la cita; no es posible cancelarla [RN-086]" };
        }
        const data = await this.citas.cambiarEstado(cita.id, cancelada.id, {
          cambiadoPor: cambiadoPor ?? cita.paciente_usuario_id,
          origen
        });
        return { success: true, chatId, data, mensaje: "Cita cancelada por Telegram; el horario qued\xF3 libre" };
      }
    };
    module2.exports = ProcesarRespuestaTelegram;
  }
});

// src/interfaces/http/controllers/RecordatoriosController.js
var require_RecordatoriosController = __commonJS({
  "src/interfaces/http/controllers/RecordatoriosController.js"(exports2, module2) {
    "use strict";
    var PostgresRecordatorioRepository = require_PostgresRecordatorioRepository();
    var PostgresCitaRepository = require_PostgresCitaRepository();
    var PostgresHorarioRepository = require_PostgresHorarioRepository();
    var N8nNotificacionAdapter = require_N8nNotificacionAdapter();
    var EnviarRecordatorio = require_EnviarRecordatorio();
    var ProcesarRespuestaTelegram = require_ProcesarRespuestaTelegram();
    var Recordatorio = require_Recordatorio();
    var validarId = require_validarId();
    var { esAdmin, rolClave, medicoIdDeUsuario, pacienteIdDeUsuario } = require_identidad();
    var recordatorioRepo = new PostgresRecordatorioRepository();
    var citaRepo = new PostgresCitaRepository();
    var horarioRepo = new PostgresHorarioRepository();
    var notificador = new N8nNotificacionAdapter();
    function respuestaError500(res, mensaje, error) {
      console.error("[Recordatorios] Error:", error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    var RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    async function enviar(req, res) {
      try {
        const body = req.body || {};
        const tipo = body.tipo ?? Recordatorio.TIPOS.H24;
        const caso = new EnviarRecordatorio(recordatorioRepo, notificador);
        const resultado = await caso.execute({ tipo });
        if (!resultado.success) {
          return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
      } catch (error) {
        return respuestaError500(res, "Error al enviar recordatorios", error);
      }
    }
    async function confirmar(req, res) {
      try {
        const { uuidCita, respuesta, recordatorioId, chatId, fecha_hora } = req.body || {};
        if (!uuidCita || typeof uuidCita !== "string") {
          return res.status(400).json({ ok: false, mensaje: "uuidCita es requerido" });
        }
        if (!RE_UUID.test(uuidCita)) {
          return res.status(400).json({ ok: false, mensaje: "uuidCita no tiene un formato de UUID v\xE1lido" });
        }
        if (!Object.values(Recordatorio.RESPUESTAS).includes(respuesta)) {
          return res.status(400).json({
            ok: false,
            mensaje: `respuesta inv\xE1lida; use: ${Object.values(Recordatorio.RESPUESTAS).join(", ")}`
          });
        }
        if (!esAdmin(req.usuario)) {
          const cita = await citaRepo.obtenerPorUuid(uuidCita);
          if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
          const rol = rolClave(req.usuario);
          if (rol === "paciente") {
            const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
            if (!pacienteId || Number(pacienteId) !== Number(cita.paciente_id)) {
              return res.status(403).json({ ok: false, mensaje: "No tienes permiso sobre esta cita [RN-053]" });
            }
          } else if (rol === "medico") {
            const medicoId = await medicoIdDeUsuario(req.usuario.id);
            if (!medicoId || Number(medicoId) !== Number(cita.medico_id)) {
              return res.status(403).json({ ok: false, mensaje: "No tienes permiso sobre esta cita [RN-053]" });
            }
          }
        }
        const caso = new ProcesarRespuestaTelegram(citaRepo, recordatorioRepo, horarioRepo);
        const resultado = await caso.execute({
          chatId: chatId ?? null,
          uuidCita,
          respuesta,
          recordatorioId: recordatorioId ?? null,
          fecha_hora: fecha_hora ?? null,
          origen: "web",
          cambiadoPor: req.usuario?.id ?? null
        });
        if (!resultado.success) {
          return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data ?? null });
      } catch (error) {
        return respuestaError500(res, "Error al procesar la respuesta", error);
      }
    }
    async function listarPorCita(req, res) {
      try {
        const idCita = validarId(req.params.idCita, "bigint");
        if (!idCita) return res.status(400).json({ ok: false, mensaje: "ID inv\xE1lido" });
        const cita = await citaRepo.obtenerPorId(idCita);
        if (!cita) return res.status(404).json({ ok: false, mensaje: "Cita no encontrada" });
        if (!esAdmin(req.usuario)) {
          const rol = rolClave(req.usuario);
          let puedeVer = false;
          if (rol === "paciente") {
            const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
            puedeVer = pacienteId && Number(pacienteId) === Number(cita.paciente_id);
          } else if (rol === "medico") {
            const medicoId = await medicoIdDeUsuario(req.usuario.id);
            puedeVer = medicoId && Number(medicoId) === Number(cita.medico_id);
          }
          if (!puedeVer) {
            return res.status(403).json({ ok: false, mensaje: "No tienes permiso sobre esta cita [RN-053]" });
          }
        }
        const data = await recordatorioRepo.listarPorCita(idCita);
        return res.json({ ok: true, mensaje: "Recordatorios de la cita", data });
      } catch (error) {
        return respuestaError500(res, "Error al obtener recordatorios", error);
      }
    }
    module2.exports = { enviar, confirmar, listarPorCita };
  }
});

// src/interfaces/http/routes/recordatorios.routes.js
var require_recordatorios_routes = __commonJS({
  "src/interfaces/http/routes/recordatorios.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_RecordatoriosController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    router.use(authMiddleware);
    router.post("/enviar", roleMiddleware("admin"), ctrl.enviar);
    router.post("/confirmar", ctrl.confirmar);
    router.get("/cita/:idCita", ctrl.listarPorCita);
    module2.exports = router;
  }
});

// src/interfaces/http/controllers/PerfilController.js
var require_PerfilController = __commonJS({
  "src/interfaces/http/controllers/PerfilController.js"(exports2, module2) {
    "use strict";
    var bcrypt = require("bcryptjs");
    var db = require_db();
    async function obtenerPerfil(req, res) {
      try {
        const usuarioId = req.usuario.id;
        const { rows } = await db.query(
          `SELECT u.id, u.nombre, u.email, u.foto_url, u.created_at, u.ultimo_login,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
          [usuarioId]
        );
        if (rows.length === 0) {
          return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
        }
        return res.json({ ok: true, mensaje: "Perfil obtenido", data: rows[0] });
      } catch (err) {
        console.error("[Perfil] Error obtenerPerfil:", err.message);
        return res.status(500).json({ ok: false, mensaje: "Error al obtener el perfil" });
      }
    }
    async function actualizarPerfil(req, res) {
      try {
        const usuarioId = req.usuario.id;
        const { nombre, email, password } = req.body;
        const archivoFoto = req.file;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
          return res.status(400).json({ ok: false, mensaje: "El email no tiene un formato v\xE1lido" });
        }
        if (password && password.trim().length > 0 && password.trim().length < 8) {
          return res.status(400).json({ ok: false, mensaje: "La contrase\xF1a debe tener al menos 8 caracteres" });
        }
        const campos = [];
        const valores = [];
        let idx = 1;
        if (nombre && nombre.trim()) {
          campos.push(`nombre = $${idx++}`);
          valores.push(nombre.trim());
        }
        if (email && email.trim()) {
          campos.push(`email = $${idx++}`);
          valores.push(email.trim().toLowerCase());
        }
        if (password && password.trim().length >= 8) {
          const hash = await bcrypt.hash(password.trim(), 10);
          campos.push(`password_hash = $${idx++}`);
          valores.push(hash);
        }
        if (archivoFoto) {
          const fotoUrl = `/uploads/perfiles/${archivoFoto.filename}`;
          campos.push(`foto_url = $${idx++}`);
          valores.push(fotoUrl);
        }
        if (campos.length === 0) {
          return res.status(400).json({ ok: false, mensaje: "No hay campos para actualizar" });
        }
        valores.push(usuarioId);
        const { rows } = await db.query(
          `UPDATE usuarios
       SET ${campos.join(", ")}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, nombre, email, foto_url`,
          valores
        );
        if (rows.length === 0) {
          return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
        }
        if (archivoFoto && Number(req.usuario.rol_id) === 2) {
          try {
            await db.query(
              `UPDATE medicos SET foto_url = $1
           WHERE usuario_id = $2 AND deleted_at IS NULL`,
              [rows[0].foto_url, usuarioId]
            );
          } catch (syncErr) {
            console.error("[Perfil] No se pudo sincronizar foto del m\xE9dico:", syncErr.message);
          }
        }
        return res.json({ ok: true, mensaje: "Perfil actualizado correctamente", data: rows[0] });
      } catch (err) {
        if (err.code === "23505") {
          return res.status(409).json({ ok: false, mensaje: "El email ya est\xE1 registrado por otro usuario" });
        }
        console.error("[Perfil] Error actualizarPerfil:", err.message);
        return res.status(500).json({ ok: false, mensaje: "Error al actualizar el perfil" });
      }
    }
    module2.exports = { obtenerPerfil, actualizarPerfil };
  }
});

// src/interfaces/http/routes/perfil.routes.js
var require_perfil_routes = __commonJS({
  "src/interfaces/http/routes/perfil.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_PerfilController();
    var authMiddleware = require_authMiddleware();
    var { single } = require_uploadMiddleware();
    router.use(authMiddleware);
    router.get("/", ctrl.obtenerPerfil);
    router.put("/", single("foto"), ctrl.actualizarPerfil);
    module2.exports = router;
  }
});

// src/interfaces/http/utils/webhookSecret.js
var require_webhookSecret = __commonJS({
  "src/interfaces/http/utils/webhookSecret.js"(exports2, module2) {
    "use strict";
    function secretValido(req) {
      const esperado = process.env.N8N_WEBHOOK_SECRET;
      if (!esperado) return false;
      return req.headers["x-webhook-secret"] === esperado;
    }
    module2.exports = { secretValido };
  }
});

// src/interfaces/webhooks/n8nWebhookController.js
var require_n8nWebhookController = __commonJS({
  "src/interfaces/webhooks/n8nWebhookController.js"(exports2, module2) {
    "use strict";
    var PostgresCitaRepository = require_PostgresCitaRepository();
    var PostgresRecordatorioRepository = require_PostgresRecordatorioRepository();
    var PostgresHorarioRepository = require_PostgresHorarioRepository();
    var ProcesarRespuestaTelegram = require_ProcesarRespuestaTelegram();
    var Recordatorio = require_Recordatorio();
    var { secretValido } = require_webhookSecret();
    var citaRepo = new PostgresCitaRepository();
    var recordatorioRepo = new PostgresRecordatorioRepository();
    var horarioRepo = new PostgresHorarioRepository();
    function responder400(res, mensaje) {
      return res.status(400).json({ ok: false, mensaje });
    }
    var RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    async function recibirRespuesta(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      try {
        const { chatId, uuidCita, respuesta, recordatorioId, fecha_hora } = req.body || {};
        if (!uuidCita || typeof uuidCita !== "string") {
          return responder400(res, "uuidCita es requerido");
        }
        if (!RE_UUID.test(uuidCita)) {
          return responder400(res, "uuidCita no tiene un formato de UUID v\xE1lido");
        }
        if (!Object.values(Recordatorio.RESPUESTAS).includes(respuesta)) {
          return responder400(
            res,
            `respuesta inv\xE1lida; use: ${Object.values(Recordatorio.RESPUESTAS).join(", ")}`
          );
        }
        if (chatId !== void 0 && chatId !== null && typeof chatId !== "string" && typeof chatId !== "number") {
          return responder400(res, "chatId debe ser texto o n\xFAmero");
        }
        if (fecha_hora !== void 0 && fecha_hora !== null && typeof fecha_hora !== "string") {
          return responder400(res, "fecha_hora debe ser texto ISO 8601");
        }
        const caso = new ProcesarRespuestaTelegram(citaRepo, recordatorioRepo, horarioRepo);
        const resultado = await caso.execute({
          chatId: chatId ?? null,
          uuidCita,
          respuesta,
          recordatorioId: recordatorioId ?? null,
          fecha_hora: fecha_hora ?? null
        });
        if (!resultado.success) {
          return responder400(res, resultado.mensaje);
        }
        return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data ?? null });
      } catch (error) {
        console.error("[Webhook n8n] Error al procesar respuesta:", error.message);
        return res.status(500).json({ ok: false, mensaje: "Error al procesar la respuesta" });
      }
    }
    async function salud(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      return res.json({ ok: true, mensaje: "Webhook n8n activo" });
    }
    module2.exports = { recibirRespuesta, salud };
  }
});

// src/interfaces/webhooks/n8nWebhook.routes.js
var require_n8nWebhook_routes = __commonJS({
  "src/interfaces/webhooks/n8nWebhook.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_n8nWebhookController();
    router.post("/respuesta", ctrl.recibirRespuesta);
    router.get("/health", ctrl.salud);
    module2.exports = router;
  }
});

// src/application/use-cases/VincularTelegram.js
var require_VincularTelegram = __commonJS({
  "src/application/use-cases/VincularTelegram.js"(exports2, module2) {
    "use strict";
    var RE_CHAT_ID = /^-?\d{1,30}$/;
    var RE_CODIGO = /^[A-Z0-9]{6}$/;
    function normalizarChatId(valor) {
      if (valor === void 0 || valor === null) return null;
      const limpio = String(valor).trim();
      return RE_CHAT_ID.test(limpio) ? limpio : null;
    }
    function normalizarCodigo(valor) {
      if (typeof valor !== "string") return "";
      return valor.trim().replace(/^["']+|["']+$/g, "").replace(/^\/START\s+/i, "").trim().toUpperCase();
    }
    function esErrorDeDatos(error) {
      return error?.code === "22003" || error?.code === "22P02";
    }
    var VincularTelegram = class {
      constructor(db) {
        this.db = db;
      }
      // Paciente dueño de un chatId, exista o no un usuario activo detrás.
      async pacientePorChat(chatId) {
        const { rows } = await this.db.query(
          `SELECT p.id AS paciente_id,
              u.id, u.uuid_publico, u.email, u.rol_id, u.nombre,
              (e.clave = 'activo') AS activo
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE p.telegram_chat_id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL`,
          [chatId]
        );
        const fila = rows[0];
        if (!fila) return null;
        return {
          pacienteId: String(fila.paciente_id),
          activo: fila.activo === true,
          usuario: fila.activo ? {
            id: fila.id,
            uuid_publico: fila.uuid_publico,
            email: fila.email,
            rol_id: fila.rol_id,
            nombre: fila.nombre
          } : null
        };
      }
      // GET /api/telegram/estado/:chatId — ¿este chat ya está vinculado?
      async estadoPorChat(chatId) {
        const chat = normalizarChatId(chatId);
        if (!chat) {
          return { status: 400, ok: false, mensaje: "chatId inv\xE1lido" };
        }
        const vinculado = await this.pacientePorChat(chat);
        return {
          status: 200,
          ok: true,
          mensaje: "Estado de vinculaci\xF3n",
          data: {
            vinculado: Boolean(vinculado),
            paciente_id: vinculado ? vinculado.pacienteId : null
          }
        };
      }
      // POST /api/telegram/vincular — n8n recibe "/start <código>" y lo canjea.
      async execute({ chatId, codigo } = {}) {
        const chat = normalizarChatId(chatId);
        if (!chat) {
          return { status: 400, ok: false, mensaje: "chatId inv\xE1lido" };
        }
        const yaVinculado = await this.pacientePorChat(chat);
        if (yaVinculado) {
          return { status: 200, ok: true, mensaje: "Ya vinculado", data: yaVinculado };
        }
        const cod = normalizarCodigo(codigo);
        if (!cod) {
          return { status: 400, ok: false, mensaje: "codigo es requerido" };
        }
        if (!RE_CODIGO.test(cod)) {
          return { status: 400, ok: false, mensaje: "C\xF3digo inv\xE1lido: debe tener 6 caracteres alfanum\xE9ricos" };
        }
        const client = await this.db.getClient();
        try {
          await client.query("BEGIN");
          const { rows } = await client.query(
            `SELECT codigo, paciente_id, creado_en, expira_en, usado_en, usado_chat_id
         FROM telegram_codigos
         WHERE codigo = $1
         FOR UPDATE`,
            [cod]
          );
          const registro = rows[0];
          if (!registro) {
            await client.query("ROLLBACK");
            return { status: 400, ok: false, mensaje: "C\xF3digo no existe o no fue generado en esta webapp" };
          }
          if (registro.usado_en) {
            if (registro.usado_chat_id === chat) {
              const vinculado = await client.query(
                "SELECT 1 FROM pacientes WHERE id = $1 AND telegram_chat_id = $2 AND deleted_at IS NULL",
                [registro.paciente_id, chat]
              );
              if (vinculado.rows.length > 0) {
                const usuario2 = await this._usuarioActivo(client, registro.paciente_id);
                await client.query("COMMIT");
                return {
                  status: 200,
                  ok: true,
                  mensaje: "Ya vinculado",
                  data: { pacienteId: String(registro.paciente_id), activo: Boolean(usuario2), usuario: usuario2 }
                };
              }
            }
            await client.query("ROLLBACK");
            return { status: 409, ok: false, mensaje: "Este c\xF3digo ya fue utilizado; genera uno nuevo en la webapp" };
          }
          if (new Date(registro.expira_en).getTime() <= Date.now()) {
            await client.query("ROLLBACK");
            return { status: 400, ok: false, mensaje: "C\xF3digo expirado; genera uno nuevo en la webapp" };
          }
          const chatEnUso = await client.query(
            `SELECT id FROM pacientes
         WHERE telegram_chat_id = $1 AND id <> $2 AND deleted_at IS NULL`,
            [chat, registro.paciente_id]
          );
          if (chatEnUso.rows.length > 0) {
            await client.query("ROLLBACK");
            return { status: 409, ok: false, mensaje: "Este chat ya est\xE1 vinculado a otra cuenta [RN-051]" };
          }
          const usuario = await this._usuarioActivo(client, registro.paciente_id);
          if (!usuario) {
            await client.query("ROLLBACK");
            return { status: 409, ok: false, mensaje: "La cuenta del paciente no est\xE1 activa; no se puede vincular" };
          }
          const actualizado = await client.query(
            `UPDATE pacientes
         SET telegram_chat_id = $1, updated_at = now()
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id`,
            [chat, registro.paciente_id]
          );
          if (actualizado.rows.length === 0) {
            await client.query("ROLLBACK");
            return { status: 409, ok: false, mensaje: "No se pudo vincular: el chat o la cuenta ya est\xE1 en uso" };
          }
          const marcado = await client.query(
            `UPDATE telegram_codigos
         SET usado_en = now(), usado_chat_id = $1
         WHERE codigo = $2 AND usado_en IS NULL
         RETURNING codigo`,
            [chat, cod]
          );
          if (marcado.rows.length === 0) {
            await client.query("ROLLBACK");
            return { status: 409, ok: false, mensaje: "El c\xF3digo ya fue utilizado; genera uno nuevo en la webapp" };
          }
          await client.query("COMMIT");
          return {
            status: 200,
            ok: true,
            mensaje: "Cuenta vinculada correctamente",
            data: { pacienteId: String(registro.paciente_id), activo: true, usuario }
          };
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {
          }
          if (error.code === "23505") {
            return { status: 409, ok: false, mensaje: "Este chat ya est\xE1 vinculado a otra cuenta [RN-051]" };
          }
          if (esErrorDeDatos(error)) {
            return { status: 400, ok: false, mensaje: "Dato inv\xE1lido" };
          }
          throw error;
        } finally {
          client.release();
        }
      }
      // DELETE /api/telegram/vincular — el paciente desvincula su propia cuenta.
      async desvincularPorPaciente(pacienteId) {
        return this._desvincular({ pacienteId });
      }
      // DELETE /api/telegram/vincular/:chatId — n8n desvincula un chat.
      async desvincularPorChat(chatId) {
        const chat = normalizarChatId(chatId);
        if (!chat) {
          return { status: 400, ok: false, mensaje: "chatId inv\xE1lido" };
        }
        return this._desvincular({ chatId: chat });
      }
      // Deja `pacientes.telegram_chat_id` en NULL. Es idempotente: si la cuenta ya
      // no estaba vinculada responde 200 con `desvinculado: false`.
      async _desvincular({ pacienteId = null, chatId = null } = {}) {
        if (pacienteId === null && chatId === null) {
          return { status: 400, ok: false, mensaje: "Falta el paciente o el chatId" };
        }
        const client = await this.db.getClient();
        try {
          await client.query("BEGIN");
          const { rows } = await client.query(
            `UPDATE pacientes
            SET telegram_chat_id = NULL, updated_at = now()
          WHERE deleted_at IS NULL
            AND telegram_chat_id IS NOT NULL
            AND ($1::bigint IS NULL OR id = $1)
            AND ($2::text IS NULL OR telegram_chat_id = $2)
          RETURNING id`,
            [pacienteId, chatId]
          );
          if (rows.length === 0) {
            await client.query("ROLLBACK");
            return {
              status: 200,
              ok: true,
              mensaje: "La cuenta no estaba vinculada",
              data: { desvinculado: false }
            };
          }
          await client.query(
            "DELETE FROM telegram_codigos WHERE paciente_id = $1 AND usado_en IS NULL",
            [rows[0].id]
          );
          await client.query("COMMIT");
          return {
            status: 200,
            ok: true,
            mensaje: "Cuenta desvinculada",
            data: { desvinculado: true, paciente_id: String(rows[0].id) }
          };
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {
          }
          if (esErrorDeDatos(error)) {
            return { status: 400, ok: false, mensaje: "Dato inv\xE1lido" };
          }
          throw error;
        } finally {
          client.release();
        }
      }
      async _usuarioActivo(client, pacienteId) {
        const { rows } = await client.query(
          `SELECT u.id, u.uuid_publico, u.email, u.rol_id, u.nombre
       FROM usuarios u
       JOIN pacientes p ON p.usuario_id = u.id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE p.id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND e.clave = 'activo'`,
          [pacienteId]
        );
        return rows[0] || null;
      }
    };
    module2.exports = { VincularTelegram, normalizarChatId, normalizarCodigo };
  }
});

// src/interfaces/http/controllers/TelegramController.js
var require_TelegramController = __commonJS({
  "src/interfaces/http/controllers/TelegramController.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    var jwt = require("jsonwebtoken");
    var db = require_db();
    var { secretValido } = require_webhookSecret();
    var {
      VincularTelegram,
      normalizarChatId
    } = require_VincularTelegram();
    var { JWT_SECRET } = require_secrets();
    var TTL_CODIGO_MINUTOS = 15;
    var ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function esErrorDeDatos(error) {
      return error?.code === "22003" || error?.code === "22P02";
    }
    function respuestaError500(res, mensaje, error) {
      if (esErrorDeDatos(error)) {
        return res.status(400).json({ ok: false, mensaje: "Dato inv\xE1lido" });
      }
      console.error("[Telegram]", mensaje, error.message);
      return res.status(500).json({ ok: false, mensaje });
    }
    function responder(res, resultado) {
      return res.status(resultado.status).json({
        ok: resultado.ok,
        mensaje: resultado.mensaje,
        data: resultado.data
      });
    }
    function crearCodigo() {
      const bytes = crypto.randomBytes(6);
      let codigo = "";
      for (let i = 0; i < 6; i++) codigo += ALFABETO[bytes[i] % ALFABETO.length];
      return codigo;
    }
    function firmarJWT(usuario) {
      return jwt.sign(
        { id: usuario.id, uuid_publico: usuario.uuid_publico, email: usuario.email, rol_id: usuario.rol_id },
        JWT_SECRET,
        { expiresIn: process.env.TELEGRAM_JWT_EXPIRA || "24h" }
      );
    }
    async function obtenerPacienteActivoPorUsuario(usuarioId) {
      const { rows } = await db.query(
        `SELECT p.id AS paciente_id
     FROM pacientes p
     JOIN usuarios u ON u.id = p.usuario_id
     JOIN estados_cuenta e ON e.id = u.estado_id
     WHERE p.usuario_id = $1
       AND p.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND e.clave = 'activo'`,
        [usuarioId]
      );
      return rows[0]?.paciente_id ?? null;
    }
    async function generarCodigo(req, res) {
      const client = await db.getClient();
      try {
        await client.query("BEGIN");
        const paciente = await client.query(
          `SELECT p.id AS paciente_id
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE p.usuario_id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND e.clave = 'activo'`,
          [req.usuario.id]
        );
        if (paciente.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({ ok: false, mensaje: "Solo los pacientes activos pueden vincular Telegram" });
        }
        const pacienteId = paciente.rows[0].paciente_id;
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [pacienteId]);
        await client.query(
          "DELETE FROM telegram_codigos WHERE paciente_id = $1 AND usado_en IS NULL",
          [pacienteId]
        );
        let codigo = null;
        let expiraEn = null;
        for (let intento = 0; intento < 5 && !codigo; intento++) {
          const candidato = crearCodigo();
          const insert = await client.query(
            `INSERT INTO telegram_codigos (codigo, paciente_id, expira_en)
         VALUES ($1, $2, now() + ($3 * interval '1 minute'))
         ON CONFLICT (codigo) DO NOTHING
         RETURNING codigo, expira_en`,
            [candidato, pacienteId, TTL_CODIGO_MINUTOS]
          );
          if (insert.rows.length > 0) {
            codigo = insert.rows[0].codigo;
            expiraEn = insert.rows[0].expira_en;
          }
        }
        if (!codigo) {
          await client.query("ROLLBACK");
          return res.status(500).json({ ok: false, mensaje: "No se pudo generar un c\xF3digo \xFAnico" });
        }
        await client.query("COMMIT");
        return res.json({
          ok: true,
          mensaje: "C\xF3digo generado",
          data: {
            codigo,
            comando: `/start ${codigo}`,
            expiraEn: new Date(expiraEn).toISOString()
          }
        });
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
        }
        return respuestaError500(res, "Error al generar el c\xF3digo", error);
      } finally {
        client.release();
      }
    }
    async function estado(req, res) {
      try {
        const pacienteId = await obtenerPacienteActivoPorUsuario(req.usuario.id);
        if (!pacienteId) {
          return res.status(403).json({ ok: false, mensaje: "Solo los pacientes activos tienen estado de vinculaci\xF3n" });
        }
        const result = await db.query(
          "SELECT telegram_chat_id FROM pacientes WHERE id = $1 AND deleted_at IS NULL",
          [pacienteId]
        );
        const chatId = result.rows[0]?.telegram_chat_id ?? null;
        return res.json({ ok: true, mensaje: "Estado de vinculaci\xF3n", data: { vinculado: Boolean(chatId), chatId } });
      } catch (error) {
        return respuestaError500(res, "Error al consultar la vinculaci\xF3n", error);
      }
    }
    async function estadoPorChat(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      try {
        const caso = new VincularTelegram(db);
        const resultado = await caso.estadoPorChat(req.params.chatId);
        if (!resultado.ok) {
          return res.status(resultado.status).json({ ok: false, mensaje: resultado.mensaje });
        }
        return res.json({
          ok: true,
          mensaje: resultado.mensaje,
          // Se expone también en la raíz para que n8n lo lea sin desanidar.
          vinculado: resultado.data.vinculado,
          paciente_id: resultado.data.paciente_id,
          data: resultado.data
        });
      } catch (error) {
        return respuestaError500(res, "Error al consultar la vinculaci\xF3n", error);
      }
    }
    async function vincular(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      const chatId = normalizarChatId(req.body?.chatId);
      try {
        const caso = new VincularTelegram(db);
        const resultado = await caso.execute({ chatId, codigo: req.body?.codigo });
        const data = { chatId, paciente_id: resultado.data?.pacienteId ?? null };
        if (resultado.data?.usuario) {
          data.token = firmarJWT(resultado.data.usuario);
          data.nombre = resultado.data.usuario.nombre;
        }
        return responder(res, { ...resultado, data });
      } catch (error) {
        return respuestaError500(res, "Error al vincular la cuenta", error);
      }
    }
    async function desvincular(req, res) {
      try {
        const pacienteId = await obtenerPacienteActivoPorUsuario(req.usuario.id);
        if (!pacienteId) {
          return res.status(403).json({ ok: false, mensaje: "Solo los pacientes activos pueden desvincular Telegram" });
        }
        const caso = new VincularTelegram(db);
        return responder(res, await caso.desvincularPorPaciente(pacienteId));
      } catch (error) {
        return respuestaError500(res, "Error al desvincular la cuenta", error);
      }
    }
    async function desvincularPorChat(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      try {
        const caso = new VincularTelegram(db);
        return responder(res, await caso.desvincularPorChat(req.params.chatId));
      } catch (error) {
        return respuestaError500(res, "Error al desvincular el chat", error);
      }
    }
    async function buscarPacienteActivoPorChat(chatId) {
      const { rows } = await db.query(
        `SELECT p.id AS paciente_id, u.id, u.uuid_publico, u.email, u.rol_id, u.nombre
     FROM pacientes p
     JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.telegram_chat_id = $1
       AND p.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND u.estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo')`,
        [chatId]
      );
      return rows[0] || null;
    }
    async function obtenerSesionPorChat(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, vinculado: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      const chatId = normalizarChatId(req.body?.chatId ?? req.query?.chatId);
      if (!chatId) {
        return res.status(400).json({ ok: false, vinculado: false, mensaje: "chatId inv\xE1lido" });
      }
      try {
        const fila = await buscarPacienteActivoPorChat(chatId);
        if (!fila) {
          return res.json({ ok: false, vinculado: false });
        }
        return res.json({
          ok: true,
          vinculado: true,
          token: firmarJWT(fila)
        });
      } catch (error) {
        return respuestaError500(res, "Error al consultar la sesi\xF3n", error);
      }
    }
    async function tokenPorChat(req, res) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      try {
        const chatId = normalizarChatId(req.body?.chatId);
        if (!chatId) {
          return res.status(400).json({ ok: false, mensaje: "chatId inv\xE1lido" });
        }
        const fila = await buscarPacienteActivoPorChat(chatId);
        if (!fila) {
          return res.status(404).json({
            ok: false,
            mensaje: "Este chat no est\xE1 vinculado a una cuenta. Escribe /start con tu c\xF3digo para vincularlo."
          });
        }
        return res.json({
          ok: true,
          mensaje: "Token generado",
          data: { token: firmarJWT(fila), pacienteId: String(fila.paciente_id), nombre: fila.nombre }
        });
      } catch (error) {
        return respuestaError500(res, "Error al generar el token", error);
      }
    }
    module2.exports = {
      generarCodigo,
      estado,
      estadoPorChat,
      vincular,
      desvincular,
      desvincularPorChat,
      obtenerSesionPorChat,
      tokenPorChat
    };
  }
});

// src/interfaces/http/routes/telegram.routes.js
var require_telegram_routes = __commonJS({
  "src/interfaces/http/routes/telegram.routes.js"(exports2, module2) {
    "use strict";
    var express2 = require("express");
    var router = express2.Router();
    var ctrl = require_TelegramController();
    var authMiddleware = require_authMiddleware();
    var roleMiddleware = require_roleMiddleware();
    var { secretValido } = require_webhookSecret();
    router.post("/codigo", authMiddleware, roleMiddleware("paciente"), ctrl.generarCodigo);
    router.get("/estado", authMiddleware, roleMiddleware("paciente"), ctrl.estado);
    router.delete("/vincular", authMiddleware, roleMiddleware("paciente"), ctrl.desvincular);
    function exigirSecret(req, res, next) {
      if (!secretValido(req)) {
        return res.status(401).json({ ok: false, mensaje: "Secreto de webhook inv\xE1lido" });
      }
      next();
    }
    router.post("/vincular", exigirSecret, ctrl.vincular);
    router.post("/sesion", exigirSecret, ctrl.obtenerSesionPorChat);
    router.post("/token", exigirSecret, ctrl.tokenPorChat);
    router.get("/estado/:chatId", exigirSecret, ctrl.estadoPorChat);
    router.delete("/vincular/:chatId", exigirSecret, ctrl.desvincularPorChat);
    module2.exports = router;
  }
});

// src/infrastructure/jobs/recordatorioScheduler.js
var require_recordatorioScheduler = __commonJS({
  "src/infrastructure/jobs/recordatorioScheduler.js"(exports2, module2) {
    "use strict";
    var PostgresRecordatorioRepository = require_PostgresRecordatorioRepository();
    var N8nNotificacionAdapter = require_N8nNotificacionAdapter();
    var EnviarRecordatorio = require_EnviarRecordatorio();
    var Recordatorio = require_Recordatorio();
    function iniciarRecordatorios2({
      intervaloMs = Number(process.env.REMINDERS_INTERVAL_MS) || 5 * 60 * 1e3
    } = {}) {
      if (process.env.REMINDERS_ENABLED === "false") {
        console.log("[Recordatorios] Scheduler desactivado por REMINDERS_ENABLED=false");
        return null;
      }
      if (!process.env.N8N_WEBHOOK_URL) {
        console.warn("[Recordatorios] N8N_WEBHOOK_URL no configurado; scheduler desactivado");
        return null;
      }
      const caso = new EnviarRecordatorio(
        new PostgresRecordatorioRepository(),
        new N8nNotificacionAdapter()
      );
      let ejecutando = false;
      const ejecutar = async () => {
        if (ejecutando) return;
        ejecutando = true;
        try {
          for (const tipo of [Recordatorio.TIPOS.H24, Recordatorio.TIPOS.H2]) {
            const resultado = await caso.execute({ tipo });
            if (resultado.data?.enviados || resultado.data?.fallidos) {
              console.log(`[Recordatorios] ${tipo}: ${resultado.mensaje}`);
            }
          }
        } catch (error) {
          console.error("[Recordatorios] Error en el ciclo:", error.message);
        } finally {
          ejecutando = false;
        }
      };
      const timer = setInterval(ejecutar, Math.max(6e4, intervaloMs));
      timer.unref();
      ejecutar();
      console.log(`[Recordatorios] Scheduler activo cada ${Math.round(intervaloMs / 1e3)}s`);
      return timer;
    }
    module2.exports = { iniciarRecordatorios: iniciarRecordatorios2 };
  }
});

// src/infrastructure/jobs/citasVencidasScheduler.js
var require_citasVencidasScheduler = __commonJS({
  "src/infrastructure/jobs/citasVencidasScheduler.js"(exports2, module2) {
    "use strict";
    var db = require_db();
    async function ejecutarLimpiezaCitasVencidas() {
      let client1 = null;
      try {
        client1 = await db.getClient();
        await client1.query("BEGIN");
        await client1.query(
          `SELECT set_config('app.cambiado_por', '', true),
              set_config('app.origen', 'sistema', true),
              set_config('app.comentario', 'RN-087: Cita pasada sin asistencia', true)`
        );
        const res1 = await client1.query(
          `UPDATE citas
       SET estado_id = (SELECT id FROM estados_cita WHERE clave = 'no_asistio')
       WHERE estado_id IN (SELECT id FROM estados_cita WHERE clave IN ('pendiente', 'confirmada'))
         AND (fecha_hora + (duracion_minutos * INTERVAL '1 minute')) < NOW()
       RETURNING id`
        );
        await client1.query("COMMIT");
        if (res1.rowCount > 0) {
          console.log(`[CitasVencidas] RN-087: ${res1.rowCount} cita(s) pasada(s) marcada(s) como 'no_asistio'`);
        }
      } catch (error) {
        if (client1) {
          try {
            await client1.query("ROLLBACK");
          } catch (_) {
          }
        }
        console.error("[CitasVencidas] Error al procesar RN-087 (citas pasadas):", error.message);
      } finally {
        if (client1) client1.release();
      }
      let client2 = null;
      try {
        client2 = await db.getClient();
        await client2.query("BEGIN");
        await client2.query(
          `SELECT set_config('app.cambiado_por', '', true),
              set_config('app.origen', 'sistema', true),
              set_config('app.comentario', 'Expirada por falta de confirmaci\xF3n', true)`
        );
        const res2 = await client2.query(
          `UPDATE citas
       SET estado_id = (SELECT id FROM estados_cita WHERE clave = 'cancelada'),
           motivo = COALESCE(motivo, 'Expirada por falta de confirmaci\xF3n')
       WHERE estado_id = (SELECT id FROM estados_cita WHERE clave = 'pendiente')
         AND created_at < (NOW() - INTERVAL '30 minutes')
         AND fecha_hora > NOW()
       RETURNING id`
        );
        await client2.query("COMMIT");
        if (res2.rowCount > 0) {
          console.log(`[CitasVencidas] RN-088: ${res2.rowCount} cita(s) no confirmada(s) cancelada(s) por expiraci\xF3n`);
        }
      } catch (error) {
        if (client2) {
          try {
            await client2.query("ROLLBACK");
          } catch (_) {
          }
        }
        console.error("[CitasVencidas] Error al procesar RN-088 (citas no confirmadas):", error.message);
      } finally {
        if (client2) client2.release();
      }
    }
    function iniciarCitasVencidasScheduler2({
      intervaloMs = Number(process.env.CITAS_VENCIDAS_INTERVAL_MS) || 15 * 60 * 1e3
    } = {}) {
      if (process.env.CITAS_VENCIDAS_ENABLED === "false") {
        console.log("[CitasVencidas] Scheduler desactivado por CITAS_VENCIDAS_ENABLED=false");
        return null;
      }
      let ejecutando = false;
      const ejecutar = async () => {
        if (ejecutando) return;
        ejecutando = true;
        try {
          await ejecutarLimpiezaCitasVencidas();
        } catch (error) {
          console.error("[CitasVencidas] Error en el ciclo del scheduler:", error.message);
        } finally {
          ejecutando = false;
        }
      };
      const timer = setInterval(ejecutar, Math.max(6e4, intervaloMs));
      timer.unref();
      ejecutar();
      console.log(`[CitasVencidas] Scheduler activo cada ${Math.round(intervaloMs / 1e3 / 60)} min`);
      return timer;
    }
    module2.exports = {
      ejecutarLimpiezaCitasVencidas,
      iniciarCitasVencidasScheduler: iniciarCitasVencidasScheduler2
    };
  }
});

// src/server.js
var path = require("path");
var fs = require("fs");
var envCandidates = [
  path.join(__dirname, ".env"),
  path.join(__dirname, "..", ".env"),
  path.join(process.cwd(), ".env")
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    break;
  }
}
var express = require("express");
var cors = require("cors");
var authRoutes = require_auth_routes();
var captchaRoutes = require_captcha_routes();
var dashboardRoutes = require_dashboard_routes();
var usuariosRoutes = require_usuarios_routes();
var pacientesRoutes = require_pacientes_routes();
var medicosRoutes = require_medicos_routes();
var consultoriosRoutes = require_consultorios_routes();
var especialidadesRoutes = require_especialidades_routes();
var horariosRoutes = require_horarios_routes();
var citasRoutes = require_citas_routes();
var recordatoriosRoutes = require_recordatorios_routes();
var perfilRoutes = require_perfil_routes();
var n8nWebhookRoutes = require_n8nWebhook_routes();
var telegramRoutes = require_telegram_routes();
var { iniciarRecordatorios } = require_recordatorioScheduler();
var { iniciarCitasVencidasScheduler } = require_citasVencidasScheduler();
var app = express();
app.use(cors());
app.use(express.json());
var frontendPath = path.join(__dirname, "..", "..", "frontend");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}
var UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/api/auth", authRoutes);
app.use("/api/captcha", captchaRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/usuarios/perfil", perfilRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/pacientes", pacientesRoutes);
app.use("/api/medicos", medicosRoutes);
app.use("/api/consultorios", consultoriosRoutes);
app.use("/api/especialidades", especialidadesRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/citas", citasRoutes);
app.use("/api/recordatorios", recordatoriosRoutes);
app.use("/api/perfil", perfilRoutes);
app.use("/api/webhooks/n8n", n8nWebhookRoutes);
app.use("/api/telegram", telegramRoutes);
app.get("/api/health", (req, res) => res.json({ ok: true, mensaje: "Servidor activo" }));
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: "Ruta no encontrada" });
});
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
});
var PORT = process.env.PORT || 4e3;
app.listen(PORT, () => {
  console.log(`\u{1F680} Servidor escuchando en http://localhost:${PORT}`);
  iniciarRecordatorios();
  iniciarCitasVencidasScheduler();
});
