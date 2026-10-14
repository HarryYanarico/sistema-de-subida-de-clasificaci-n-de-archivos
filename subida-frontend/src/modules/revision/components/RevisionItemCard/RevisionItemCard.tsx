import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, Check, Loader2, Copy } from 'lucide-react'
import { HistorialReclasificaciones } from '../VisorRevision/VisorRevision'
import { EstadoDocumentoBadge } from '../EstadoDocumentoBadge/EstadoDocumentoBadge'
import { RevisionItemCardProps } from './RevisionItemCard.types'

export function RevisionItemCard({
  documento,
  tipos,
  seleccionadoTipoId,
  guardando,
  onSeleccionarTipo,
  onConfirmar,
  onVerDocumento,
  esDuplicado = false,
}: RevisionItemCardProps) {
  const currentTipoId = seleccionadoTipoId || (documento.tipoDocumento?.id ? String(documento.tipoDocumento.id) : undefined)

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Miniatura / Miniaturas lado a lado para duplicados */}
          <div className="shrink-0 flex gap-2">
            <button
              type="button"
              onClick={() => onVerDocumento(documento)}
              className="relative group border rounded-md overflow-hidden bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary"
              title="Click para ver la página completa"
            >
              <img
                src={`/api/documents/${documento.id}/thumbnail/`}
                alt={`Página ${documento.paginaNumero}`}
                className="w-24 h-32 object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity gap-1">
                <Eye className="h-4 w-4" />
                Ver
              </span>
            </button>

            {esDuplicado && documento.duplicadoDe && (
              <button
                type="button"
                onClick={() => onVerDocumento(documento.duplicadoDe!)}
                className="relative group border-2 border-dashed border-muted-foreground/40 rounded-md overflow-hidden bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary"
                title="Click para ver el original"
              >
                <img
                  src={`/api/documents/${documento.duplicadoDe.id}/thumbnail/`}
                  alt="Original"
                  className="w-24 h-32 object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-0 inset-x-0 bg-background/90 text-[10px] text-center font-mono py-0.5 border-t">
                  Original
                </span>
              </button>
            )}
          </div>

          {/* Información del Documento */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-base">
                {documento.persona?.nombres} {documento.persona?.apellidos}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {documento.persona?.codigo}
              </span>
              <EstadoDocumentoBadge estado={documento.estado} />
              {documento.score !== null && documento.score !== undefined && (
                <Badge variant="outline" className="text-xs font-mono">
                  {Math.round(documento.score * 100)}% conf.
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Folio #{documento.id} · Página {documento.paginaNumero}
              {documento.archivoNombre && ` · Archivo: ${documento.archivoNombre}`}
            </p>

            {documento.tipoDocumento && (
              <div className="text-xs">
                <span className="text-muted-foreground">Tipo actual: </span>
                <span className="font-medium">{documento.tipoDocumento.nombre}</span>
              </div>
            )}

            {esDuplicado && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Copy className="h-3.5 w-3.5 text-amber-500" />
                <span>
                  Coincidencia visual perceptual con folio #{documento.duplicadoDe?.id || '?'}
                </span>
              </div>
            )}

            {/* Historial de reclasificaciones */}
            <HistorialReclasificaciones historial={documento.historialReclasificaciones} />
          </div>

          {/* Selector de Tipo y Confirmación */}
          <div className="shrink-0 flex flex-col justify-center gap-2 sm:w-64">
            <Select
              value={currentTipoId}
              onValueChange={onSeleccionarTipo}
              disabled={guardando}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              disabled={!currentTipoId || guardando}
              onClick={onConfirmar}
              className="gap-2 h-9 text-xs"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Confirmar Clasificación
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
