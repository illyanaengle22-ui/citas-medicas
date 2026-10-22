import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard';
import {
  COLORES_ESTADO,
  ESTILO_EJE,
  ESTILO_TOOLTIP,
  PALETA,
  etiquetaEstado,
  formatearNumero,
  sumarTotales,
} from './chartTheme';

export default function UsuariosPorEstadoChart({ datos = [], porcentajePendientes }) {
  const total = sumarTotales(datos);
  const descripcion = Number.isFinite(Number(porcentajePendientes))
    ? `${porcentajePendientes} % de las cuentas están pendientes de aprobación`
    : 'Estado de las cuentas registradas';

  return (
    <ChartCard
      id="usuarios-estado"
      titulo="Usuarios por estado"
      descripcion={descripcion}
      resumenCorto={`Total: ${formatearNumero(total)}`}
      vacio={total === 0}
      mensajeVacio="Aún no hay usuarios registrados"
    >
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={datos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF3" />
          <XAxis
            dataKey="estado"
            tickFormatter={etiquetaEstado}
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            cursor={{ fill: 'rgba(94, 155, 186, 0.08)' }}
            contentStyle={ESTILO_TOOLTIP}
            labelFormatter={(etiqueta) => etiquetaEstado(etiqueta)}
            formatter={(valor) => [formatearNumero(valor), 'Usuarios']}
          />
          <Bar dataKey="total" name="Usuarios" radius={[8, 8, 0, 0]} maxBarSize={72}>
            {datos.map((item, indice) => (
              <Cell
                key={item.estado}
                fill={COLORES_ESTADO[item.estado] ?? PALETA[indice % PALETA.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
