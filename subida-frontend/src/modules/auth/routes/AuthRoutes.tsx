import { RouteDefinition } from '@shared/types/shared.types'
import { ROUTES } from '@config/routes'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'

export const authRoutes: RouteDefinition[] = [
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
    publico: true,
  },
  {
    path: ROUTES.DASHBOARD,
    element: <DashboardPage />,
  },
]
