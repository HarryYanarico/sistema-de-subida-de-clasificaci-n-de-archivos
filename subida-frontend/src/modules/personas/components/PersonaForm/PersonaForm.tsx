import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { PersonaFormProps } from './PersonaForm.types'

export function PersonaForm({
  form,
  error,
  loading,
  onChange,
  onSubmit,
}: PersonaFormProps) {
  return (
    <Card className="max-w-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Datos de la Persona</CardTitle>
        <CardDescription>
          Ingrese los datos de la persona. El código debe ser numérico (mínimo 5 dígitos).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                name="codigo"
                value={form.codigo}
                onChange={(e) => onChange('codigo', e.target.value)}
                placeholder="Ej: 00001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci">Carnet de Identidad</Label>
              <Input
                id="ci"
                name="ci"
                value={form.ci || ''}
                onChange={(e) => onChange('ci', e.target.value)}
                placeholder="Número de CI"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombres">Nombres *</Label>
              <Input
                id="nombres"
                name="nombres"
                value={form.nombres}
                onChange={(e) => onChange('nombres', e.target.value)}
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
                onChange={(e) => onChange('apellidos', e.target.value)}
                placeholder="Apellidos completos"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email || ''}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                value={form.telefono || ''}
                onChange={(e) => onChange('telefono', e.target.value)}
                placeholder="Ej: 71234567"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Registrar Persona'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
