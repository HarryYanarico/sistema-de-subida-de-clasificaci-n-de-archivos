import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { routes } from './config/routes';
import { Layout } from './shared/components/layout/Layout';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const content = (
    <Routes>
      {routes.map((route, index) => (
        <Route key={index} path={route.path} element={route.element} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  if (isLoginPage) return content;

  return (
    <Layout onLogout={handleLogout}>
      {content}
    </Layout>
  );
}

export default App;
