import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Menu, LogOut, User as UserIcon } from 'lucide-react'
import { HeaderProps } from './Layout.types'

export function Header({ onOpenSidebar }: HeaderProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background/95 backdrop-blur px-4 sm:px-6 lg:px-8">
      {/* Mobile trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSidebar}
        className="lg:hidden text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex flex-1 items-center justify-between gap-x-4">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Plataforma de Digitalización
          </span>
        </div>

        {/* Right tools & user pill */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card text-xs">
              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <UserIcon className="h-3 w-3" />
              </div>
              <span className="font-medium text-foreground">
                {user.first_name} {user.last_name}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1 h-4">
                {user.role}
              </Badge>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
