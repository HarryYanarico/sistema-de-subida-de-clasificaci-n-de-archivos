import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { CREATE_PERSONA } from '@/graphql/mutations/personas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function RegistrarPersona() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    codigo: '',
    nombres: '',
    apellidos: '',
    ci: '',
    email: '',
    telefono: '',
  })
  const [error, setError] = useState('')
  const [createPersona, { loading }] = useMutation(CREATE_PERSONA)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const { data } = await createPersona({
        variables: {
          codigo: form.codigo,
          nombres: form.nombres,
          apellidos: form.apellidos,
          ci: form.ci || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
        },
      })

      if (data?.createPersona?.success) {
        navigate('/personas')
      } else {
        setError(data?.createPersona?.message || 'Error al crear la persona')
      }
    } catch (err) {
      setError('Error al crear la persona')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/personas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Registrar Persona</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la Persona</CardTitle>
          <CardDescription>
            Ingrese los datos de la persona. El código debe ser numérico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  name="codigo"
                  value={form.codigo}
                  onChange={handleChange}
                  placeholder="Ej: 00001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ci">Carnet de Identidad</Label>
                <Input
                  id="ci"
                  name="ci"
                  value={form.ci}
                  onChange={handleChange}
                  placeholder="Número de CI"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombres">Nombres *</Label>
                <Input
                  id="nombres"
                  name="nombres"
                  value={form.nombres}
                  onChange={handleChange}
                  placeholder="Nombres completos"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input
                  id="apellidos"
                  name="apellidos"
                  value={form.apellidos}
                  onChange={handleChange}
                  placeholder="Apellidos completos"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  placeholder="Número de teléfono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Link to="/personas">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Registrando...' : 'Registrar Persona'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
