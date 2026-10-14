import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_PERSONA } from '@graphql/queries/persona.queries'
import { GET_DOCUMENTOS_PERSONA } from '@graphql/queries/documento.queries'
import { ROUTES } from '@config/routes'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Printer,
  X,
  FileText,
  User,
  CreditCard,
  Maximize2,
} from 'lucide-react'
import { EstadoDocumentoBadge } from '@modules/revision/components/EstadoDocumentoBadge/EstadoDocumentoBadge'
import { Documento, Persona } from '@app-types/index'

export function VistaPersonaDocumentosPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const personaId = parseInt(id || '0', 10)
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)

  const { data: personaData, loading: loadingPersona } = useQuery(GET_PERSONA, {
    variables: { id: personaId },
  })

  const { data: docsData, loading: loadingDocs } = useQuery(GET_DOCUMENTOS_PERSONA, {
    variables: { personaId },
  })

  const persona: Persona | undefined = personaData?.persona
  const todosLosDocs: Documento[] = docsData?.documentosPersona?.documentos || []
  const documentos = todosLosDocs.filter((doc) => doc.tipoDocumento != null)

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
        <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.PERSONAS.VISTA_LISTA)}>
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
          <span>Código: {persona.codigo}</span>
        </div>
        {persona.ci && (
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>CI: {persona.ci}</span>
          </div>
        )}
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Esta persona no tiene documentos clasificados
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {documentos.map((doc) => (
            <Card
              key={doc.id}
              className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
              onClick={() => setSelectedDoc(doc)}
            >
              <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                <img
                  src={`/api/documents/${doc.id}/thumbnail/`}
                  alt={doc.tipoDocumento?.nombre || 'Documento'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary">
                    <Maximize2 className="h-4 w-4 mr-1" /> Ver
                  </Button>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm truncate">{doc.tipoDocumento?.nombre}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">Pág. {doc.paginaNumero}</span>
                  <EstadoDocumentoBadge estado={doc.estado} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-4xl w-full h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{selectedDoc.tipoDocumento?.nombre}</span>
                <Badge variant="outline">Página {selectedDoc.paginaNumero}</Badge>
                <EstadoDocumentoBadge estado={selectedDoc.estado} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint(selectedDoc.id)}
                >
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDoc(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4 bg-muted/20">
              <iframe
                src={`/api/documents/${selectedDoc.id}/file/`}
                className="w-full h-full rounded border bg-white"
                title="Visor de Documento"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Alias export para retrocompatibilidad
export const VistaPersonaDocumentos = VistaPersonaDocumentosPage
