import { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  readonly name: string
  readonly href: string
  readonly icon: LucideIcon
  readonly roles?: string[]
}

export interface LayoutProps {
  readonly children: ReactNode
}

export interface HeaderProps {
  readonly onOpenSidebar: () => void
  readonly title?: string
}

export interface SidebarProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly items: NavItem[]
}

export interface FooterProps {
  readonly className?: string
}
