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
  COLORES_CITA,
  ESTILO_TOOLTIP,
  PALETA,
  etiquetaCita,
  formatearNumero,
  sumarTotales,
} from './chartTheme';

export default function CitasPorEstadoChart({ datos = [], porcentajeConfirmadas }) {
  const total = sumarTotales(datos);
  const descripcion = Number.isFinite(Number(porcentajeConfirmadas))
    ? `${porcentajeConfirmadas} % de las citas están confirmadas · ${formatearNumero(total)} en total`
    : 'Distribución de las citas registradas';

  return (
    <ChartCard
      id="citas-estado"
      titulo="Citas por estado"
      descripcion={descripcion}
      resumenCorto={`Total: ${formatearNumero(total)}`}
      vacio={total === 0}
      mensajeVacio="Aún no hay citas registradas"
    >
      <ResponsiveContainer width="100%" height={290}>
        <PieChart>
          <Pie
            data={datos}
            dataKey="total"
            nameKey="estado"
            cx="50%"
            cy="48%"
            innerRadius={64}
            outerRadius={96}
            paddingAngle={datos.filter((item) => Number(item.total) > 0).length > 1 ? 2 : 0}
            labelLine={false}
            isAnimationActive={false}
          >
            {datos.map((item, indice) => (
              <Cell
                key={item.estado}
                fill={COLORES_CITA[item.estado] ?? PALETA[indice % PALETA.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={ESTILO_TOOLTIP}
            formatter={(valor, nombre) => [formatearNumero(valor), etiquetaCita(nombre)]}
          />
          <Legend
            iconType="circle"
            iconSize={9}
            formatter={(valor) => etiquetaCita(valor)}
            wrapperStyle={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
