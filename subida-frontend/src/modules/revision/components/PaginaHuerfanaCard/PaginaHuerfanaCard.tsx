import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  AlertCircle,
  Loader2,
  Calendar,
  FolderOpen,
  Trash2,
  PlusCircle,
  Layers,
  Eye,
} from 'lucide-react'
import { PaginaHuerfanaCardProps } from './PaginaHuerfanaCard.types'
import { getPaginaThumbnailUrl } from '@modules/documentos/services/upload.service'

export function PaginaHuerfanaCard({
  pagina,
  config,
  tipos,
  estaGuardando,
  errorFila,
  onSetModo,
  onSetTipoId,
  onSetNombreNuevo,
  onConfirmar,
  onVerModal,
}: PaginaHuerfanaCardProps) {
  const textoMuestra = (pagina.textoOcr || '').trim()

  return (
    <Card className="hover:border-primary/40 transition-colors shadow-sm overflow-hidden">
      <CardContent className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Visualización / Miniatura */}
          <div className="lg:col-span-3 flex flex-col items-center justify-center bg-muted/20 border rounded-lg p-3 text-center gap-2">
            <div
              onClick={() => onVerModal(pagina)}
              className="w-24 h-32 rounded border bg-card shadow-sm flex flex-col items-center justify-between p-2 cursor-pointer hover:border-primary transition-all group relative overflow-hidden"
              title="Click para ver la imagen y el texto OCR completo"
            >
              <div className="relative w-full h-20 bg-muted/20 rounded flex items-center justify-center overflow-hidden">
                <img
                  src={getPaginaThumbnailUrl(pagina.id)}
                  alt={`Página ${pagina.nroPaginaEnPdf}`}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <FileText className="h-7 w-7 text-muted-foreground/40 absolute -z-0" />
              </div>
              <div className="w-full text-center">
                <span className="text-xs font-mono font-bold block">
                  Pág. {pagina.nroPaginaEnPdf}
                </span>
                <span className="text-[9px] text-muted-foreground line-clamp-1">
                  {textoMuestra ? textoMuestra.slice(0, 20) : 'Sin texto'}
                </span>
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs rounded transition-opacity gap-1">
                <Eye className="h-3.5 w-3.5" />
                <span>Ver</span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground font-mono space-y-0.5 w-full">
              {pagina.createdAt && (
                <div className="flex items-center justify-center gap-1 text-[10px]">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(pagina.createdAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-1 text-[10px] truncate">
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate" title={pagina.loteNombre || pagina.pdfOrigen}>
                  {pagina.loteNombre || pagina.pdfOrigen || `Lote #${pagina.loteId}`}
                </span>
              </div>
            </div>
          </div>

          {/* Información y Texto OCR */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">
                  Página {pagina.nroPaginaEnPdf}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {pagina.estado}
                </Badge>
                {pagina.descartable && (
                  <Badge variant="destructive" className="text-xs">
                    Candidata a descarte
                  </Badge>
                )}
              </div>

              <div className="bg-muted/40 p-3 rounded-md border text-xs text-muted-foreground font-mono leading-relaxed line-clamp-4">
                {textoMuestra ? `"${textoMuestra}"` : '(Página sin texto OCR legible detectado)'}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onVerModal(pagina)}
              className="text-xs text-muted-foreground hover:text-foreground self-start gap-1 p-0 h-auto"
            >
              <Eye className="h-3.5 w-3.5" /> Ver OCR completo
            </Button>
          </div>

          {/* Selector de Acciones */}
          <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l lg:pl-5 pt-4 lg:pt-0 space-y-3">
            <div className="space-y-3">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Resolver página
              </span>

              {/* Botones de Modo */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => onSetModo(pagina.id, 'existente')}
                  className={`py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
                    config.modo === 'existente'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Existente
                </button>
                <button
                  type="button"
                  onClick={() => onSetModo(pagina.id, 'nuevo')}
                  className={`py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
                    config.modo === 'nuevo'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Nuevo
                </button>
                <button
                  type="button"
                  onClick={() => onSetModo(pagina.id, 'descartar')}
                  className={`py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
                    config.modo === 'descartar'
                      ? 'bg-destructive/15 text-destructive shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-destructive'
                  }`}
                >
                  Descartar
                </button>
              </div>

              {/* Formulario según modo */}
              {config.modo === 'existente' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Tipo de documento:</label>
                  <Select
                    value={config.tipoId || (tipos.length > 0 ? String(tipos[0].id) : '')}
                    onValueChange={(val) => onSetTipoId(pagina.id, val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipos.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.modo === 'nuevo' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Nombre del nuevo tipo:</label>
                  <Input
                    placeholder="Ej: Certificado de Nacimiento"
                    value={config.nombreNuevo || ''}
                    onChange={(e) => onSetNombreNuevo(pagina.id, e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              )}

              {config.modo === 'descartar' && (
                <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Confirmar descarte
                  </div>
                  <p className="text-[11px] leading-tight">
                    Esta página quedará marcada como 'descartada' y no se creará ningún documento a
                    partir de ella.
                  </p>
                </div>
              )}

              {errorFila && (
                <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorFila}</span>
                </div>
              )}
            </div>

            {/* Botón Confirmar */}
            <Button
              type="button"
              size="sm"
              disabled={estaGuardando}
              onClick={() => onConfirmar(pagina)}
              className={`w-full text-xs font-semibold gap-1.5 ${
                config.modo === 'descartar'
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : ''
              }`}
            >
              {estaGuardando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Guardando...
                </>
              ) : config.modo === 'descartar' ? (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Descartar página
                </>
              ) : config.modo === 'nuevo' ? (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  Crear tipo y asignar
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5" />
                  Asignar a tipo existente
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
