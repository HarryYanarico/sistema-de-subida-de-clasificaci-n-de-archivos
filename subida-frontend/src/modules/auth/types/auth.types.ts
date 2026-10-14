import { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { EstadisticasDigitalizacion, DocumentoRecienteGraphQL } from '@app-types/index'
export type { EstadisticasDigitalizacion, DocumentoRecienteGraphQL }

export interface LoginCredentials {
  username: string
  password: string
}

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: LucideIcon
  iconColorClass?: string
  progressValue?: number
  action?: ReactNode
}

export interface OperationalBreakdownProps {
  stats: EstadisticasDigitalizacion
}

export interface RecentDocumentsTableProps {
  recientes: DocumentoRecienteGraphQL[]
}
