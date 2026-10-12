import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { routes } from './config/routes';
import { Layout } from './shared/components/layout/Layout';
import { ProtectedRoute } from './shared/components/route/ProtectedRoute';
import { useAuth } from './shared/contexts/AuthContext';

function App() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const isLoginPage = location.pathname === '/login';

  // Sin sesion, todo excepto /login se manda al login. La decision se toma
  // una sola vez aca en vez de envolver cada ruta: las rutas de /revision/* si
  // llevan su propia ProtectedRoute porque tienen requisito de rol.
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
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );

  if (isLoginPage) return content;

  return (
    <Layout>
      {content}
    </Layout>
  );
}

export default App;
