import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Layers, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { EstadoDocumentoBadge } from '@modules/revision/components/EstadoDocumentoBadge/EstadoDocumentoBadge'
import { TipoDocumentoCardProps } from './TipoDocumentoCard.types'

export function TipoDocumentoCard({
  tipo,
  docs,
  tipos,
  onOpenViewer,
  onAsignar,
}: TipoDocumentoCardProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const activeDoc = docs[activeIdx] || docs[0]
  const hasMultiple = docs.length > 1

  return (
    <div
      className={`group relative rounded-lg border overflow-hidden transition-all bg-card ${
        docs.length > 0
          ? 'border-border hover:border-primary/50 hover:shadow-md'
          : 'border-dashed'
      }`}
    >
      {/* Thumbnail area */}
      <div
        className="aspect-[3/4] bg-muted/30 flex items-center justify-center relative cursor-pointer"
        onClick={() => activeDoc && onOpenViewer(activeDoc)}
      >
        {activeDoc ? (
          <>
            <img
              src={`/api/documents/${activeDoc.id}/thumbnail/`}
              alt={`Página ${activeDoc.paginaNumero}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            {hasMultiple && (
              <div className="absolute top-2 right-2 bg-black/75 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Layers className="h-3 w-3" />
                <span>+{docs.length - 1} ({docs.length} folios)</span>
              </div>
            )}
          </>
        ) : (
          <FileText className="h-10 w-10 text-muted-foreground/30" />
        )}
      </div>

      {/* Mini selector de folios si hay más de 1 */}
      {hasMultiple && (
        <div className="p-2 bg-muted/40 border-t flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">Folios:</span>
          {docs.map((d, idx) => (
            <button
              key={d.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveIdx(idx)
              }}
              className={`px-2 py-0.5 text-xs rounded transition-all shrink-0 ${
                activeIdx === idx
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'bg-background hover:bg-muted text-muted-foreground border'
              }`}
            >
              Pág. {d.paginaNumero}
            </button>
          ))}
        </div>
      )}

      {/* Info area del folio activo */}
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate" title={tipo.nombre}>{tipo.nombre}</span>
          {hasMultiple && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {expanded ? <ChevronUp className="h-3 w-3 mr-0.5" /> : <ChevronDown className="h-3 w-3 mr-0.5" />}
              {expanded ? 'Ocultar' : `Ver todos (${docs.length})`}
            </Button>
          )}
        </div>

        {activeDoc ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="text-xs flex-shrink-0">
              Pág. {activeDoc.paginaNumero}
            </Badge>
            <EstadoDocumentoBadge estado={activeDoc.estado} />
            <div className="ml-auto flex-1 min-w-[110px]" onClick={(e) => e.stopPropagation()}>
              <Select
                value={tipo.id.toString()}
                onValueChange={(value) => onAsignar(activeDoc.id, value)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Cambiar" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin documento asignado</p>
        )}

        {/* Lista desplegable de todos los folios */}
        {hasMultiple && expanded && (
          <div className="pt-2 border-t space-y-2 mt-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Todos los folios de este tipo:
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {docs.map((doc, i) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-1.5 rounded border text-xs gap-2 transition-colors ${
                    activeIdx === i ? 'bg-primary/5 border-primary/40' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-muted-foreground">#{i + 1}</span>
                    <Badge variant="outline" className="text-[11px] px-1 py-0">
                      Pág. {doc.paginaNumero}
                    </Badge>
                    <EstadoDocumentoBadge estado={doc.estado} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => onOpenViewer(doc)}
                      title="Ver en visor"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <div className="w-[90px]" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={tipo.id.toString()}
                        onValueChange={(val) => onAsignar(doc.id, val)}
                      >
                        <SelectTrigger className="h-6 text-[11px] px-1.5">
                          <SelectValue placeholder="Reasignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                              {t.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
