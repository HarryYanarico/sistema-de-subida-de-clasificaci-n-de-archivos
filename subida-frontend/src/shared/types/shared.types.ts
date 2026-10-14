/**
 * Tipos compartidos para Layout, componentes de interfaz y navegación.
 */
import { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  readonly name: string
  readonly href: string
  readonly icon: LucideIcon
  readonly roles?: string[]
  readonly badge?: string | number
}

export interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
}

export interface SelectOption<T = string | number> {
  readonly label: string
  readonly value: T
  readonly disabled?: boolean
}

export interface BaseComponentProps {
  readonly className?: string
  readonly children?: ReactNode
}

export interface RouteDefinition {
  readonly path: string
  readonly element: ReactNode
  readonly publico?: boolean
  readonly roles?: string[]
}

