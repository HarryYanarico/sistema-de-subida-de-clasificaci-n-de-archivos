import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { LOGIN_USER } from '@graphql/mutations/auth.mutations'
import { ROUTES } from '@config/routes'
import { env } from '@config/environment'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { LoginForm } from '../components/LoginForm/LoginForm'
import { LoginCredentials } from '../types/auth.types'

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loginUser, { loading }] = useMutation(LOGIN_USER)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const destino = (location.state as { from?: string } | null)?.from || ROUTES.DASHBOARD

  const handleLogin = async ({ username, password }: LoginCredentials) => {
    setError(null)
    try {
      const { data } = await loginUser({
        variables: { username, password },
      })

      if (data?.loginUser?.success && data.loginUser.token && data.loginUser.user) {
        login(data.loginUser.token, data.loginUser.user)
        navigate(destino, { replace: true })
      } else {
        setError(data?.loginUser?.message || 'Credenciales inválidas')
      }
    } catch {
      setError('Error de conexión con el servidor')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{env.appTitle}</CardTitle>
          <CardDescription>Inicie sesión para acceder a la gestión documental</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSubmit={handleLogin} error={error} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}

// Alias export para retrocompatibilidad
export const Login = LoginPage
