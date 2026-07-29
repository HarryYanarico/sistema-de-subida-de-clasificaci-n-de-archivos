import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_PERSONA } from '@/graphql/queries/personas'
import { GET_DOCUMENTOS_PERSONA } from '@/graphql/queries/documentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Printer, X, FileText, User, CreditCard, Maximize2 } from 'lucide-react'

export function VistaPersonaDocumentos() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selectedDoc, setSelectedDoc] = useState<any>(null)

  const { data: personaData, loading: loadingPersona } = useQuery(GET_PERSONA, {
    variables: { id: parseInt(id || '0') },
  })

  const { data: docsData, loading: loadingDocs } = useQuery(GET_DOCUMENTOS_PERSONA, {
    variables: { personaId: parseInt(id || '0') },
  })

  const persona = personaData?.persona
  const todosLosDocs: any[] = docsData?.documentosPersona?.documentos || []
  const documentos = todosLosDocs.filter((doc: any) => doc.tipoDocumento != null)

  const handlePrint = (docId: number) => {
    const printWindow = window.open(`/api/documents/${docId}/file/`, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  if (loadingPersona || loadingDocs) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>
  }

  if (!persona) {
    return <div className="text-center py-8 text-muted-foreground">Persona no encontrada</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vista-persona')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Documentos de {persona.nombres} {persona.apellidos}</h1>
          <p className="text-muted-foreground">Código: {persona.codigo}</p>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <CreditCard className="h-4 w-4" />
          <span className="font-mono">{persona.codigo}</span>
        </div>
        {persona.ci && (
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{persona.ci}</span>
          </div>
        )}
        <Badge variant="default">{documentos.length} documento{documentos.length !== 1 ? 's' : ''} clasificado{documentos.length !== 1 ? 's' : ''}</Badge>
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No tiene documentos clasificados</p>
            <p className="text-sm text-muted-foreground mt-1">
              Esta persona no tiene documentos que hayan sido clasificados aún
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documentos.map((doc: any) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="relative rounded-lg border overflow-hidden hover:border-primary/50 hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="aspect-[3/4] bg-muted/30 flex items-center justify-center relative overflow-hidden">
                <img
                  src={`/api/documents/${doc.id}/thumbnail/`}
                  alt={`Página ${doc.paginaNumero}`}
                  className="w-full h-full object-cover blur-sm brightness-75 group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 rounded-full p-2">
                    <Maximize2 className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{doc.tipoDocumento.nombre}</span>
                  <Badge variant="success" className="text-xs flex-shrink-0 ml-2">Pág. {doc.paginaNumero}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex flex-col"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-background flex flex-col h-full max-h-screen"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold">{selectedDoc.tipoDocumento?.nombre || 'Documento'}</h2>
                <p className="text-sm text-muted-foreground">
                  Página {selectedDoc.paginaNumero} de {persona.nombres} {persona.apellidos}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrint(selectedDoc.id)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDoc(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-6">
              <iframe
                key={selectedDoc.id}
                src={`/api/documents/${selectedDoc.id}/file/`}
                className="w-full h-full border-0 rounded-lg"
                title={`${selectedDoc.tipoDocumento?.nombre || 'Documento'} - Página ${selectedDoc.paginaNumero}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
