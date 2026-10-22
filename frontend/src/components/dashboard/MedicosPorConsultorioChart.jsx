import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard';
import {
  ESTILO_EJE,
  ESTILO_TOOLTIP,
  PALETA,
  formatearNumero,
  sumarTotales,
} from './chartTheme';

export default function MedicosPorConsultorioChart({ datos = [] }) {
  const total = sumarTotales(datos);
  const altura = Math.max(240, datos.length * 44);

  return (
    <ChartCard
      id="medicos-consultorio"
      titulo="Médicos por consultorio"
      descripcion="Cobertura de los consultorios activos"
      resumenCorto={`Total: ${formatearNumero(total)}`}
      vacio={datos.length === 0}
      mensajeVacio="Aún no hay médicos con consultorio asignado"
    >
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8EEF3" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="consultorio"
            width={130}
            tick={ESTILO_EJE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(94, 155, 186, 0.08)' }}
            contentStyle={ESTILO_TOOLTIP}
            formatter={(valor) => [formatearNumero(valor), 'Médicos']}
          />
          <Bar dataKey="total" name="Médicos" radius={[0, 7, 7, 0]} maxBarSize={24}>
            {datos.map((item, indice) => (
              <Cell key={item.consultorio} fill={PALETA[indice % PALETA.length]} />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              style={{ fontSize: 11, fill: '#2A1B4F', fontFamily: "'DM Sans', system-ui, sans-serif" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
