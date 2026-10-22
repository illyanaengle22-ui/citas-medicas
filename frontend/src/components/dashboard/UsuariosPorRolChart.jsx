import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import ChartCard from './ChartCard';
import {
  COLORES_ROL,
  ESTILO_TOOLTIP,
  PALETA,
  etiquetaRol,
  formatearNumero,
  sumarTotales,
} from './chartTheme';

export default function UsuariosPorRolChart({ datos = [] }) {
  const total = sumarTotales(datos);

  return (
    <ChartCard
      id="usuarios-rol"
      titulo="Usuarios por rol"
      descripcion="Distribución de las cuentas activas en la plataforma"
      resumenCorto={`Total: ${formatearNumero(total)}`}
      vacio={total === 0}
      mensajeVacio="Aún no hay usuarios registrados"
    >
      <ResponsiveContainer width="100%" height={290}>
        <PieChart>
          <Pie
            data={datos}
            dataKey="total"
            nameKey="rol"
            cx="50%"
            cy="48%"
            innerRadius={64}
            outerRadius={96}
            paddingAngle={datos.filter((item) => Number(item.total) > 0).length > 1 ? 2 : 0}
            labelLine={false}
            label={({ value, percent }) => (
              Number(value) > 0 && percent ? `${Math.round(percent * 100)} %` : ''
            )}
            isAnimationActive={false}
          >
            {datos.map((item, indice) => (
              <Cell
                key={item.rol}
                fill={COLORES_ROL[item.rol] ?? PALETA[indice % PALETA.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={ESTILO_TOOLTIP}
            formatter={(valor, nombre) => [formatearNumero(valor), etiquetaRol(nombre)]}
          />
          <Legend
            iconType="circle"
            iconSize={9}
            formatter={(valor) => etiquetaRol(valor)}
            wrapperStyle={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
