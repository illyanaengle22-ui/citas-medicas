import {
  Area,
  AreaChart,
  CartesianGrid,
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

export default function RegistrosPorMesChart({ datos = [], agrupacion = 'mes' }) {
  const porDia = agrupacion === 'dia';
  const titulo = porDia ? 'Registros por día' : 'Registros por mes';
  const descripcion = porDia
    ? 'Altas de usuarios por día dentro del rango seleccionado'
    : 'Altas de usuarios por mes dentro del rango seleccionado';
  const total = sumarTotales(datos);

  return (
    <ChartCard
      id={porDia ? 'registros-dia' : 'registros-mes'}
      titulo={titulo}
      descripcion={descripcion}
      resumenCorto={`Total: ${formatearNumero(total)}`}
      vacio={total === 0}
      mensajeVacio="Aún no hay registros en el rango seleccionado"
    >
      <ResponsiveContainer width="100%" height={290}>
        <AreaChart data={datos} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradiente-registros" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#5E9BBA" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#5E9BBA" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF3" />

          <XAxis
            dataKey="etiqueta"
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={porDia ? 20 : 8}
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
            cursor={{ fill: 'rgba(94, 155, 186, 0.08)' }}
            labelFormatter={(etiqueta) => etiqueta}
            formatter={(valor) => [formatearNumero(valor), 'Registros']}
          />

          <Area
            type="monotone"
            dataKey="total"
            name="Registros"
            stroke="#5E9BBA"
            strokeWidth={2.5}
            fill="url(#gradiente-registros)"
            dot={{ r: 3, fill: '#5E9BBA', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
