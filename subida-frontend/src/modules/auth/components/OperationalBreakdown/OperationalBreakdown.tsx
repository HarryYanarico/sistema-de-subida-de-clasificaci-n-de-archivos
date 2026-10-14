import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { OperationalBreakdownProps } from './OperationalBreakdown.types'

export function OperationalBreakdown({ stats }: OperationalBreakdownProps) {
  const breakdownItems = [
    {
      label: 'Verificados',
      count: stats.totalVerificados,
      color: 'bg-green-500',
      description: 'Revisión humana final',
    },
    {
      label: 'Clasificados',
      count: stats.totalClasificados,
      color: 'bg-blue-500',
      description: 'Alta confianza automática',
    },
    {
      label: 'Dudosos',
      count: stats.totalDudosos,
      color: 'bg-amber-500',
      textClass: 'text-amber-600',
      description: 'Baja confianza / empate',
    },
    {
      label: 'Sin clasificar',
      count: stats.totalSinClasificar,
      color: 'bg-orange-500',
      textClass: 'text-orange-600',
      description: 'Sin coincidencia',
    },
    {
      label: 'Duplicados',
      count: stats.totalDuplicados,
      color: 'bg-slate-500',
      description: 'Copias perceptuales',
    },
    {
      label: 'Pendientes',
      count: stats.totalPendientes,
      color: 'bg-zinc-400',
      description: 'En espera de asignación',
    },
  ]

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Desglose de Estados de Digitalización</CardTitle>
        <CardDescription>
          Distribución total de folios según el resultado del procesamiento automático y manual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {breakdownItems.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                {item.label}
              </div>
              <div className={`text-2xl font-bold mt-1 ${item.textClass || ''}`}>
                {item.count}
              </div>
              <span className="text-[11px] text-muted-foreground">{item.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
