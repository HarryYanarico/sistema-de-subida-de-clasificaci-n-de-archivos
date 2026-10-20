import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeywordInput } from '@/components/ui/keyword-input'
import { SugerenciasAdminPanel } from '../SugerenciasAdminPanel/SugerenciasAdminPanel'
import { TipoDocumentoFormProps } from './TipoDocumentoForm.types'

export function TipoDocumentoForm({
  form,
  editingId,
  onChange,
  onSubmit,
  onCancel,
  onPalabrasActualizadas,
}: TipoDocumentoFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          value={form.nombre}
          onChange={(e) => onChange({ ...form, nombre: e.target.value })}
          placeholder="Ej: Certificado de Nacimiento"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Palabras Clave *</Label>
        <KeywordInput
          value={form.palabrasClave}
          onChange={(keywords) => onChange({ ...form, palabrasClave: keywords })}
          placeholder="Escribir palabra y presionar Enter"
        />
        <p className="text-xs text-muted-foreground">
          Palabras que identifican este tipo de documento. Se asigna peso automáticamente.
        </p>
      </div>

      {editingId && (
        <div className="space-y-4 pt-1">
          <SugerenciasAdminPanel
            tipoDocumentoId={Number(editingId)}
            onPalabrasActualizadas={(nuevasPalabras) => {
              if (onPalabrasActualizadas) {
                onPalabrasActualizadas(nuevasPalabras)
              }
            }}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{editingId ? 'Guardar' : 'Crear'}</Button>
      </div>
    </form>
  )
}
