import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard';
import {
  ESTILO_EJE,
  ESTILO_TOOLTIP,
  formatearNumero,
  sumarTotales,
} from './chartTheme';

export default function CitasPorDiaChart({ datos = [], descripcion }) {
  const total = sumarTotales(datos);

  return (
    <ChartCard
      id="citas-dia"
      titulo="Citas por día"
      descripcion={descripcion ?? 'Citas registradas en el rango seleccionado'}
      resumenCorto={`Total: ${formatearNumero(total)}`}
      vacio={total === 0}
      mensajeVacio="Aún no hay citas registradas"
      className="dash-chart--ancho"
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={datos} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF3" />
          <XAxis
            dataKey="etiqueta"
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={ESTILO_TOOLTIP}
            cursor={{ stroke: '#5E9BBA', strokeWidth: 1.5, strokeDasharray: '4 2' }}
            labelFormatter={(etiqueta) => etiqueta}
            formatter={(valor) => [formatearNumero(valor), 'Citas']}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Citas"
            stroke="#5E9BBA"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#5E9BBA', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
