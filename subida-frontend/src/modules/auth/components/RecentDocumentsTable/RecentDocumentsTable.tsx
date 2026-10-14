import { Link } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { formatearFecha, obtenerVarianteEstado, obtenerEtiquetaEstado } from '@shared/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, UploadCloud, Eye } from 'lucide-react'
import { RecentDocumentsTableProps } from './RecentDocumentsTable.types'

export function RecentDocumentsTable({ recientes }: RecentDocumentsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Últimos Folios Digitalizados</CardTitle>
          <CardDescription>
            Seguimiento de las páginas procesadas más recientemente en el sistema.
          </CardDescription>
        </div>
        <Link to={ROUTES.DOCUMENTOS.SUBIR}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <UploadCloud className="h-3.5 w-3.5" />
            Subir más
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recientes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="font-medium">No se han registrado documentos aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Comienza subiendo PDFs desde el botón superior
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left text-xs uppercase tracking-wider">
                  <th className="pb-3 font-medium">Folio / Pág</th>
                  <th className="pb-3 font-medium">Persona (Código)</th>
                  <th className="pb-3 font-medium">Tipo Asignado</th>
                  <th className="pb-3 font-medium">Confianza</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recientes.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 font-mono font-semibold">
                      #{doc.id}{' '}
                      <span className="text-muted-foreground font-normal text-xs">
                        (pág. {doc.paginaNumero})
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="font-medium">
                        {doc.persona ? `${doc.persona.nombres} ${doc.persona.apellidos}` : 'No asociada'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {doc.persona?.codigo || '-'}
                      </div>
                    </td>
                    <td className="py-3">
                      {doc.tipoDocumento ? (
                        <span className="font-medium text-foreground">{doc.tipoDocumento.nombre}</span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Sin clasificar</span>
                      )}
                    </td>
                    <td className="py-3">
                      {doc.score !== null && doc.score !== undefined ? (
                        <span className="text-xs font-medium font-mono">
                          {Math.round(doc.score * 100)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">--</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant={obtenerVarianteEstado(doc.estado)}>
                        {obtenerEtiquetaEstado(doc.estado)}
                      </Badge>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatearFecha(doc.createdAt)}
                    </td>
                    <td className="py-3 text-right">
                      {doc.persona && (
                        <Link to={ROUTES.PERSONAS.CASILLERO(doc.persona.id)}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Casillero
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
