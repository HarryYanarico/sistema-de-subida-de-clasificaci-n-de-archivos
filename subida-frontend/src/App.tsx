import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UnidadProvider } from './shared/contexts/UnidadContext';
import { Layout } from './shared/components/layout/Layout';
import { routes } from './config/routes';

function App() {
  return (
    <UnidadProvider>
      <BrowserRouter>
        <Routes>
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UnidadProvider>
  );
}

export default App;
