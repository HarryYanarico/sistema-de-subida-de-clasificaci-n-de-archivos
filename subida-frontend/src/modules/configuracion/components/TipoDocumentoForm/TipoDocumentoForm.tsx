import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Lock, Unlock, Plus, Trash2 } from 'lucide-react'
import { SugerenciasAdminPanel } from '../SugerenciasAdminPanel/SugerenciasAdminPanel'
import { TipoDocumentoFormProps } from './TipoDocumentoForm.types'
import { KeywordItemUI } from '../../services/tipos-documento.service'

export function TipoDocumentoForm({
  form,
  editingId,
  onChange,
  onSubmit,
  onCancel,
  onPalabrasActualizadas,
}: TipoDocumentoFormProps) {
  const [nuevaPalabra, setNuevaPalabra] = useState('')

  // Convertir lista de palabras plana a ítems estructurados si aún no están convertidos
  const keywordsItems: KeywordItemUI[] = (form.keywordsItems || []).length > 0
    ? (form.keywordsItems || [])
    : (form.palabrasClave || []).map((k) => {
        const parts = k.split(':')
        const word = parts[0].trim()
        const weight = parts[1] ? Number(parts[1]) : 3
        return {
          palabra: word,
          esObligatoria: weight >= 5,
          activa: true,
        }
      })

  const syncItems = (items: KeywordItemUI[]) => {
    const flatStrings = items
      .filter((i) => i.activa && i.palabra.trim())
      .map((i) => `${i.palabra.trim()}:${i.esObligatoria ? 5 : 3}`)
    onChange({
      ...form,
      palabrasClave: flatStrings,
      keywordsItems: items,
    })
  }

  const handleAgregarPalabra = () => {
    const palabraLimpia = nuevaPalabra.trim().toLowerCase()
    if (!palabraLimpia) return

    // Prevenir duplicados
    if (keywordsItems.some((k) => k.palabra.toLowerCase() === palabraLimpia)) {
      setNuevaPalabra('')
      return
    }

    const nuevos = [
      ...keywordsItems,
      {
        palabra: palabraLimpia,
        esObligatoria: false,
        activa: true,
      },
    ]
    syncItems(nuevos)
    setNuevaPalabra('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAgregarPalabra()
    }
  }

  const handleToggleActiva = (index: number, activa: boolean) => {
    const nuevos = [...keywordsItems]
    nuevos[index] = { ...nuevos[index], activa }
    syncItems(nuevos)
  }

  const handleToggleObligatoria = (index: number) => {
    const nuevos = [...keywordsItems]
    const actual = nuevos[index].esObligatoria
    nuevos[index] = {
      ...nuevos[index],
      esObligatoria: !actual,
      activa: true, // Si se marca como obligatoria, se activa automáticamente
    }
    syncItems(nuevos)
  }

  const handleEliminarPalabra = (index: number) => {
    const nuevos = keywordsItems.filter((_, i) => i !== index)
    syncItems(nuevos)
  }

  const totalActivas = keywordsItems.filter((k) => k.activa).length
  const totalObligatorias = keywordsItems.filter((k) => k.activa && k.esObligatoria).length

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nombre" className="text-sm font-semibold">
          Nombre del Tipo de Documento *
        </Label>
        <Input
          id="nombre"
          value={form.nombre}
          onChange={(e) => onChange({ ...form, nombre: e.target.value })}
          placeholder="Ej: Certificado de Nacimiento, Título Profesional, Contrato..."
          required
          className="h-10 text-sm"
        />
      </div>

      {/* Gestión de Palabras Clave amigable (sin pesos visibles) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-sm font-semibold">Palabras Clave Identificadoras</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Términos que caracterizan este documento. Usa el candado 🔒 para palabras que deban
              aparecer obligatoriamente.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {totalActivas} activa(s) · {totalObligatorias} imprescindible(s)
          </Badge>
        </div>

        {/* Input para agregar palabras */}
        <div className="flex gap-2">
          <Input
            value={nuevaPalabra}
            onChange={(e) => setNuevaPalabra(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una palabra o frase y presiona Enter..."
            className="h-9 text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAgregarPalabra}
            disabled={!nuevaPalabra.trim()}
            className="h-9 text-xs gap-1 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>

        {/* Lista interactiva de palabras clave */}
        <div className="border rounded-lg p-2.5 bg-muted/20 max-h-56 overflow-y-auto space-y-1.5">
          {keywordsItems.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-3">
              No hay palabras agregadas aún. Escribe arriba para añadir la primera.
            </p>
          ) : (
            keywordsItems.map((item, idx) => (
              <div
                key={item.palabra}
                className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
                  item.activa
                    ? 'bg-card border-border shadow-2xs'
                    : 'bg-muted/40 border-dashed border-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    id={`kw-${item.palabra}-${idx}`}
                    checked={item.activa}
                    onCheckedChange={(checked) => handleToggleActiva(idx, Boolean(checked))}
                  />
                  <label
                    htmlFor={`kw-${item.palabra}-${idx}`}
                    className={`font-medium cursor-pointer select-none truncate ${
                      item.activa ? 'text-foreground' : 'text-muted-foreground line-through'
                    }`}
                  >
                    {item.palabra}
                  </label>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Candado: Imprescindible */}
                  <Button
                    type="button"
                    variant={item.esObligatoria ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleToggleObligatoria(idx)}
                    className={`h-7 px-2 text-[11px] gap-1 ${
                      item.esObligatoria
                        ? 'bg-amber-600 hover:bg-amber-700 text-white font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={
                      item.esObligatoria
                        ? 'Marcada como imprescindible (candado activado)'
                        : 'Hacer clic para marcar como obligatoria'
                    }
                  >
                    {item.esObligatoria ? (
                      <>
                        <Lock className="h-3 w-3" />
                        <span>Imprescindible</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3 w-3" />
                        <span>Común</span>
                      </>
                    )}
                  </Button>

                  {/* Eliminar */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEliminarPalabra(idx)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Eliminar palabra"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel de sugerencias inteligentes para edición */}
      {editingId && (
        <div className="space-y-4 pt-2 border-t">
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

      {/* Botones de acción */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{editingId ? 'Guardar Cambios' : 'Crear Tipo'}</Button>
      </div>
    </form>
  )
}
