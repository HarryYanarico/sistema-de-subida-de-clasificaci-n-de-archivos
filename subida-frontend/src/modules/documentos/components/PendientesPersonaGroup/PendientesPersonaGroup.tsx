import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Eye, Loader2, ArrowRight } from 'lucide-react'
import { ROUTES } from '@config/routes'
import { PendientesPersonaGroupProps } from './PendientesPersonaGroup.types'

export function PendientesPersonaGroup({
  persona,
  documentos,
  tipos,
  asignandoId,
  onAsignar,
  onVerDocumento,
}: PendientesPersonaGroupProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 py-3.5 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">
              {persona.nombres} {persona.apellidos}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Código: <span className="font-mono font-medium text-foreground">{persona.codigo}</span>
              {persona.ci && ` · CI: ${persona.ci}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {documentos.length} pendiente{documentos.length !== 1 ? 's' : ''}
            </Badge>
            <Link to={ROUTES.PERSONAS.CASILLERO(persona.id)}>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1 text-primary">
                Casillero
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/50">
        {documentos.map((doc) => {
          const isAssigning = asignandoId === doc.id
          return (
            <div
              key={doc.id}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Página {doc.paginaNumero}</span>
                    <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                      Folio #{doc.id}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Archivo: {doc.archivoNombre || 'Documento sin clasificar'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onVerDocumento(doc)}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Pág.
                </Button>

                <div className="w-52">
                  <Select
                    disabled={isAssigning}
                    onValueChange={(val) => onAsignar(doc.id, val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      {isAssigning ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Asignando...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Asignar tipo de documento" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {tipos.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()} className="text-xs">
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
