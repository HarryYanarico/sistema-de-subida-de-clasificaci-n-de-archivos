import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { routes } from '@config/routes.tsx'
import { ROUTES } from '@config/routes'
import { Layout } from '@shared/components/layout/Layout'
import { ProtectedRoute } from '@shared/components/route/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'

function App() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const isLoginPage = location.pathname === ROUTES.LOGIN

  // Sin sesión, todo excepto /login se manda al login.
  const content = (
    <Routes>
      {routes.map((route, index) => (
        <Route
          key={index}
          path={route.path}
          element={
            route.publico || isLoginPage ? (
              route.element
            ) : (
              <ProtectedRoute roles={route.roles}>{route.element}</ProtectedRoute>
            )
          }
        />
      ))}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN} replace />}
      />
    </Routes>
  )

  if (isLoginPage) return content

  return <Layout>{content}</Layout>
}

export default App
