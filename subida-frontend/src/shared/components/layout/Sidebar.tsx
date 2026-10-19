import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { env } from '@config/environment'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, LogOut, FileText } from 'lucide-react'
import { SidebarProps } from './Layout.types'

export function Sidebar({ isOpen, onClose, items }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const handleLogout = () => {
    logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const renderNavLinks = () => (
    <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
      {items.map((item) => {
        const isActive =
          location.pathname === item.href ||
          (item.href !== ROUTES.DASHBOARD && location.pathname.startsWith(item.href))
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClose}
            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Icon
              className={`mr-3 h-4 w-4 shrink-0 transition-colors ${
                isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
              }`}
            />
            <span className="truncate">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )

  const renderUserSection = () => (
    <div className="border-t p-3 bg-muted/20">
      <div className="flex items-center justify-between p-2 rounded-lg bg-card border">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-semibold truncate">
            {user?.first_name} {user?.last_name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase font-mono">
              {user?.role || 'operador'}
            </Badge>
            {user?.unidad?.codigo && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 font-mono">
                {user.unidad.codigo}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              @{user?.username}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Cerrar sesión"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Backdrop & Drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-card border-r shadow-xl z-50">
          <div className="flex items-center justify-between px-4 h-16 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <span className="font-bold text-sm tracking-tight">{env.appTitle}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {renderNavLinks()}
          {renderUserSection()}
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-card">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b shrink-0">
          <div className="p-1.5 rounded-lg bg-primary text-primary-foreground shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm tracking-tight truncate leading-tight">
              {env.appTitle}
            </h2>
            <span className="text-[11px] text-muted-foreground">Archivo y Folios</span>
          </div>
        </div>
        {renderNavLinks()}
        {renderUserSection()}
      </aside>
    </>
  )
}
