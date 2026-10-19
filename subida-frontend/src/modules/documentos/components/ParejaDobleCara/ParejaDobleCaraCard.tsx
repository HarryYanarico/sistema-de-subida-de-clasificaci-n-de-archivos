import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, Plus, AlertTriangle, Trash2, FileText, Layers } from 'lucide-react'
import { ParejaDobleCaraCardProps } from './ParejaDobleCaraCard.types'

export function ParejaDobleCaraCard({
  documento,
  onToggleDobleCara,
  onAgregarPagina,
  onQuitarPagina,
  onVerPagina,
  paginasDisponibles = [],
  disabled = false,
}: ParejaDobleCaraCardProps) {
  const [paginaSeleccionadaParaAgregar, setPaginaSeleccionadaParaAgregar] = useState<string>('')
  const [mostrandoSelector, setMostrandoSelector] = useState(false)

  const pags = documento.paginas
  const esDoble = pags.length === 2 && documento.esDobleCara
  const tieneMasDeDos = pags.length > 2

  const handleCheckboxChange = (checked: boolean) => {
    onToggleDobleCara(documento.id, checked)
  }

  const handleConfirmarAgregar = () => {
    if (!paginaSeleccionadaParaAgregar || !onAgregarPagina) return
    onAgregarPagina(documento.id, Number(paginaSeleccionadaParaAgregar))
    setPaginaSeleccionadaParaAgregar('')
    setMostrandoSelector(false)
  }

  // Candidatos para agregar como reverso (que no estén ya en este documento)
  const candidatos = paginasDisponibles.filter(
    (cand) => !pags.some((p) => p.id === cand.id)
  )

  return (
    <Card className="border border-border/80 hover:border-primary/50 transition-all shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Encabezado del documento */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              {documento.nombre || `Documento (${pags.length} pág${pags.length > 1 ? 's' : ''})`}
            </span>
            {esDoble && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                Doble cara (Anverso/Reverso)
              </Badge>
            )}
            {pags.length === 1 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                1 sola página
              </Badge>
            )}
            {tieneMasDeDos && (
              <Badge variant="destructive" className="text-xs">
                {pags.length} páginas
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {pags.map((p) => `Pág. ${p.nroPaginaEnPdf}`).join(', ')}
          </div>
        </div>

        {/* Advertencia si supera las 2 páginas por defecto */}
        {tieneMasDeDos && (
          <div
            id={`alerta-mas-de-dos-paginas-${documento.id}`}
            className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Advertencia:</span> El documento tiene más de 2 páginas por defecto.
              Se permite continuar y guardar todas las páginas asignadas.
            </div>
          </div>
        )}

        {/* Checkbox cuando son 2 páginas: "Estas dos páginas son el mismo documento" */}
        {pags.length === 2 && (
          <div className="flex items-center space-x-2 p-2.5 rounded-md bg-muted/40 border">
            <Checkbox
              id={`checkbox-doble-cara-${documento.id}`}
              checked={documento.esDobleCara}
              onCheckedChange={handleCheckboxChange}
              disabled={disabled}
            />
            <label
              htmlFor={`checkbox-doble-cara-${documento.id}`}
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
            >
              ☑ Estas dos páginas son el mismo documento (anverso/reverso)
            </label>
          </div>
        )}

        {/* Grilla visual de páginas del documento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {pags.map((pag, index) => {
            const etiqueta =
              pags.length === 2
                ? index === 0
                  ? 'Anverso'
                  : 'Reverso'
                : `Pág. ${pag.nroPaginaEnPdf}`

            return (
              <div
                key={pag.id}
                className="relative flex flex-col border rounded-md p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={index === 0 ? 'default' : 'secondary'} className="text-[11px]">
                    {etiqueta}
                  </Badge>
                  {pags.length > 1 && onQuitarPagina && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onQuitarPagina(documento.id, pag.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      title="Quitar página de este documento"
                      disabled={disabled}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Previsualización / Información */}
                <div className="flex gap-2 items-start flex-1 min-h-[70px]">
                  <div className="w-14 h-18 bg-muted rounded border flex items-center justify-center shrink-0 text-muted-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">
                      Página {pag.nroPaginaEnPdf}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-3 mt-1 font-mono">
                      {pag.textoOcr || '(Sin texto OCR extraído)'}
                    </div>
                  </div>
                </div>

                {onVerPagina && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onVerPagina(pag)}
                    className="w-full mt-2 h-7 text-xs gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver página
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* Sección de "+ Agregar reverso / página adicional" */}
        <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
          {!mostrandoSelector ? (
            candidatos.length > 0 && onAgregarPagina && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                id={`btn-agregar-reverso-${documento.id}`}
                onClick={() => setMostrandoSelector(true)}
                disabled={disabled}
                className="text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                + Agregar reverso
              </Button>
            )
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={paginaSeleccionadaParaAgregar}
                onValueChange={setPaginaSeleccionadaParaAgregar}
              >
                <SelectTrigger className="h-8 text-xs w-[220px]">
                  <SelectValue placeholder="Seleccionar página para reverso" />
                </SelectTrigger>
                <SelectContent>
                  {candidatos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      Página {c.nroPaginaEnPdf} ({c.pdfOrigen})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmarAgregar}
                disabled={!paginaSeleccionadaParaAgregar || disabled}
                className="h-8 text-xs"
              >
                Vincular
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMostrandoSelector(false)
                  setPaginaSeleccionadaParaAgregar('')
                }}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
