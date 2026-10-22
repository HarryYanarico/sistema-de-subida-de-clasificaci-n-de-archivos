import { useState } from 'react'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  AlertCircle,
  Eye,
  HelpCircle,
  FileQuestion,
  Copy,
  Layers,
} from 'lucide-react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'
import { LayoutProps, NavItem } from './Layout.types'

const navigationItems: NavItem[] = [
  { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: 'Personas', href: ROUTES.PERSONAS.ROOT, icon: Users },
  { name: 'Visor Documentos', href: ROUTES.PERSONAS.VISTA_LISTA, icon: Eye },
  {
    name: 'Subir Documentos',
    href: ROUTES.DOCUMENTOS.SUBIR,
    icon: Upload,
    roles: ['admin', 'operador'],
  },
  {
    name: 'Documentos Pendientes',
    href: ROUTES.DOCUMENTOS.PENDIENTES,
    icon: AlertCircle,
    roles: ['admin', 'operador'],
  },
  {
    name: 'Revisión: Dudosas',
    href: ROUTES.REVISION.DUDOSAS,
    icon: HelpCircle,
    roles: ['admin', 'operador'],
  },
  {
    name: 'Revisión: Sin Clasificar',
    href: ROUTES.REVISION.SIN_CLASIFICAR,
    icon: FileQuestion,
    roles: ['admin', 'operador'],
  },
  {
    name: 'Revisión: Duplicados',
    href: ROUTES.REVISION.DUPLICADOS,
    icon: Copy,
    roles: ['admin', 'operador'],
  },
  {
    name: 'Revisión: Sin Agrupar',
    href: ROUTES.REVISION.SIN_AGRUPAR,
    icon: Layers,
    roles: ['admin', 'operador'],
  },
  {
    name: 'Tipos de Documento',
    href: ROUTES.CONFIGURACION.TIPOS_DOCUMENTO,
    icon: FileText,
    roles: ['admin'],
  },
]

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { tieneRol } = useAuth()

  const navegacionVisible = navigationItems.filter(
    (item) => !item.roles || tieneRol(...item.roles)
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={navegacionVisible}
      />

      <div className="lg:pl-64 flex flex-col flex-1">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  )
}
