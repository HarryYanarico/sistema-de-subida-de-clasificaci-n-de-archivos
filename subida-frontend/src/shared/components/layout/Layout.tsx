import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Upload,
  LogOut,
  Menu,
  X,
  FileText,
  AlertCircle,
  Eye,
  HelpCircle,
  FileQuestion,
  Copy
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Si se indica, el enlace solo aparece para esos roles. */
  roles?: string[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Personas', href: '/personas', icon: Users },
  { name: 'Visor Documentos', href: '/vista-persona', icon: Eye },
  { name: 'Subir Documentos', href: '/documentos/subir', icon: Upload },
  { name: 'Documentos Pendientes', href: '/documentos/pendientes', icon: AlertCircle },
  { name: 'Revisión: Dudosas', href: '/revision/dudosas', icon: HelpCircle, roles: ['admin', 'operador'] },
  { name: 'Revisión: Sin Clasificar', href: '/revision/sin-clasificar', icon: FileQuestion, roles: ['admin', 'operador'] },
  { name: 'Revisión: Duplicados', href: '/revision/duplicados', icon: Copy, roles: ['admin', 'operador'] },
  { name: 'Tipos de Documento', href: '/configuracion/tipos-documento', icon: FileText },
]

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { logout, user, tieneRol } = useAuth()
  const navigate = useNavigate()

  // Los enlaces de revision solo se muestran a quien puede llegar a ellos.
  // Ocultarlos evita prometer una pantalla que ProtectedRoute va a rechazar.
  const navegacionVisible = navigation.filter(
    (item) => !item.roles || tieneRol(...item.roles)
  )

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-card border-r">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <span className="text-lg font-semibold">Digitalización</span>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="p-4 space-y-1">
            {navegacionVisible.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow border-r bg-card">
          <div className="flex h-16 items-center px-4 border-b">
            <FileText className="h-6 w-6 mr-2" />
            <span className="text-lg font-semibold">Digitalización</span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navegacionVisible.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Cerrar Sesión{user ? ` (${user.username})` : ''}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground hidden sm:block">
            Sistema de Digitalización
          </span>
        </div>
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
