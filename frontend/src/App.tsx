import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ListaPersonas } from './pages/personas/ListaPersonas'
import { RegistrarPersona } from './pages/personas/RegistrarPersona'
import { CasilleroDocumentos } from './pages/personas/CasilleroDocumentos'
import { TiposDocumento } from './pages/configuracion/TiposDocumento'
import { SubirDocumentos } from './pages/documentos/SubirDocumentos'
import { DocumentosPendientes } from './pages/documentos/DocumentosPendientes'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <Layout onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/personas" element={<ListaPersonas />} />
        <Route path="/personas/nueva" element={<RegistrarPersona />} />
        <Route path="/personas/:id" element={<CasilleroDocumentos />} />
        <Route path="/documentos/subir" element={<SubirDocumentos />} />
        <Route path="/documentos/pendientes" element={<DocumentosPendientes />} />
        <Route path="/configuracion/tipos-documento" element={<TiposDocumento />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
