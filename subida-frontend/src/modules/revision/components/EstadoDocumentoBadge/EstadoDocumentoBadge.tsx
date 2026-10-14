import { Badge } from '@/components/ui/badge'
import { CheckCircle2, HelpCircle, Copy, FileQuestion, ShieldCheck, LucideIcon } from 'lucide-react'
import { EstadoDocumentoBadgeProps } from './EstadoDocumentoBadge.types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const ESTADOS: Record<
  string,
  { label: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  clasificado: { label: 'Clasificado', variant: 'success', icon: CheckCircle2 },
  verificado: { label: 'Verificado', variant: 'success', icon: ShieldCheck },
  dudosa: { label: 'Dudosa', variant: 'warning', icon: HelpCircle },
  duplicado: { label: 'Duplicado', variant: 'destructive', icon: Copy },
  sin_clasificar: { label: 'Sin clasificar', variant: 'secondary', icon: FileQuestion },
  pendiente: { label: 'Pendiente', variant: 'secondary', icon: FileQuestion },
}

export function EstadoDocumentoBadge({
  estado,
  className = 'text-xs',
}: EstadoDocumentoBadgeProps) {
  if (!estado) return null

  const config = ESTADOS[estado]
  if (!config) {
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
