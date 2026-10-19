import { Badge } from '@/components/ui/badge'
import { CheckCircle2, HelpCircle, Copy, FileQuestion, ShieldCheck } from 'lucide-react'

/**
 * Traduccion del estado del documento a etiqueta visible.
 *
 * Los estados no son un detalle interno: "dudosa" y "duplicado" significan que
 * el resultado Automatico no es confiable y que un humano deberia mirarlo. Sin
 * esta etiqueta, una persona ve el mismo cartel verde en un duplicado que en
 * un documento revisado.
 */
const ESTADOS: Record<
  string,
  { label: string; variant: any; icon: typeof CheckCircle2 }
> = {
  clasificado: { label: 'Clasificado', variant: 'success', icon: CheckCircle2 },
  verificado: { label: 'Verificado', variant: 'success', icon: ShieldCheck },
  dudosa: { label: 'Dudosa', variant: 'warning', icon: HelpCircle },
  duplicado: { label: 'Duplicado', variant: 'destructive', icon: Copy },
  duplicada: { label: 'Duplicada', variant: 'destructive', icon: Copy },
  sin_clasificar: { label: 'Sin clasificar', variant: 'secondary', icon: FileQuestion },
  pendiente: { label: 'Pendiente', variant: 'secondary', icon: FileQuestion },
}

export function EstadoDocumentoBadge({
  estado,
  className = 'text-xs',
}: {
  estado?: string | null
  className?: string
}) {
  // Sin estado no se inventa nada: la consulta puede no pedirlo.
  if (!estado) return null

  const config = ESTADOS[estado]
  if (!config) {
    // Un estado desconocido no debe romper la lista, pero tampoco esconderse.
    return (
      <Badge variant="secondary" className={className}>
        {estado}
      </Badge>
    )
  }

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  )
}
