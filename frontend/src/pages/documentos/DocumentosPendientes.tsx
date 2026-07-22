import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_DOCUMENTOS_PENDIENTES, GET_TIPOS_DOCUMENTO } from '@/graphql/queries/documentos'
import { ASIGNAR_DOCUMENTO } from '@/graphql/mutations/documentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { FileText, Printer, ChevronRight } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

export function DocumentosPendientes() {
  const [asignarDocumento] = useMutation(ASIGNAR_DOCUMENTO)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [showDialog, setShowDialog] = useState(false)
  const { unidadActiva } = useUnidad()

  const { data, loading, refetch } = useQuery(GET_DOCUMENTOS_PENDIENTES, {
    variables: { unidadId: unidadActiva?.id || 0 },
    skip: !unidadActiva,
  })
  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { unidadId: unidadActiva?.id || 0, activo: true },
    skip: !unidadActiva,
  })

  const documentos = data?.documentosPendientes || []
  const tipos = tiposData?.tiposDocumento || []

  const handleAsignar = async (documentoId: number, tipoDocumentoId: string) => {
    await asignarDocumento({
      variables: {
        documentoId,
        tipoDocumentoId: parseInt(tipoDocumentoId),
      },
    })
    refetch()
  }

  const openDocViewer = (doc: any) => {
    setSelectedDoc(doc)
    setShowDialog(true)
  }

  const handlePrint = () => {
    if (!selectedDoc) return
    const printWindow = window.open(`/api/documents/${selectedDoc.id}/file/`, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  const personasMap = new Map<number, { persona: any; documentos: any[] }>()
  documentos.forEach((doc: any) => {
    const personaId = doc.persona.id
    if (!personasMap.has(personaId)) {
      personasMap.set(personaId, { persona: doc.persona, documentos: [] })
    }
    personasMap.get(personaId)!.documentos.push(doc)
  })

  const personasConPendientes = Array.from(personasMap.values())

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documentos Pendientes</h1>
        <p className="text-muted-foreground">
          Documentos que no pudieron clasificarse automáticamente
        </p>
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No hay documentos pendientes</p>
            <p className="text-sm text-muted-foreground mt-1">
              Todos los documentos han sido clasificados
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-sm">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} pendiente{documentos.length !== 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-muted-foreground">
              en {personasConPendientes.length} persona{personasConPendientes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {personasConPendientes.map(({ persona, documentos: docs }) => (
            <Card key={persona.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {persona.nombres?.[0] || ''}{persona.apellidos?.[0] || ''}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{persona.nombres} {persona.apellidos}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Código: {persona.codigo} · {docs.length} documento{docs.length !== 1 ? 's' : ''} pendiente{docs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Link to={`/personas/${persona.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver casillero
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {docs.map((doc: any) => (
                    <div
                      key={doc.id}
                      onClick={() => openDocViewer(doc)}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium">Página {doc.paginaNumero}</span>
                          {doc.textoExtraido && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {doc.textoExtraido.slice(0, 100)}...
                            </p>
                          )}
                        </div>
                      </div>
                      <Select onValueChange={(value) => handleAsignar(doc.id, value)}>
                        <SelectTrigger className="w-[220px] flex-shrink-0 ml-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.map((tipo: any) => (
                            <SelectItem key={tipo.id} value={tipo.id.toString()}>
                              {tipo.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl w-[90vw] !flex !flex-col !h-[85vh] !p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Documento sin clasificar</DialogTitle>
                <DialogDescription>
                  Página {selectedDoc?.paginaNumero} de {selectedDoc?.persona?.nombres} {selectedDoc?.persona?.apellidos}
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden">
            {selectedDoc && (
              <iframe
                key={selectedDoc.id}
                src={`/api/documents/${selectedDoc.id}/file/`}
                className="w-full h-full border-0 rounded-lg"
                title={`Documento - Página ${selectedDoc.paginaNumero}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
