import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_DOCUMENTOS_PENDIENTES } from '@graphql/queries/documento.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import { ASIGNAR_DOCUMENTO } from '@graphql/mutations/documento.mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, ChevronRight, ChevronLeft, AlertCircle, X } from 'lucide-react'
import { PendientesPersonaGroup } from '../components/PendientesPersonaGroup/PendientesPersonaGroup'
import { DocumentoViewerModal } from '../components/DocumentoViewerModal/DocumentoViewerModal'
import { Documento, TipoDocumento, Persona } from '@app-types/index'

export function DocumentosPendientesPage() {
  const [asignarDocumento] = useMutation(ASIGNAR_DOCUMENTO)
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [asignandoId, setAsignandoId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const limite = 20

  const offset = (pagina - 1) * limite

  const { data, loading, refetch } = useQuery(GET_DOCUMENTOS_PENDIENTES, {
    variables: { limit: limite, offset },
    fetchPolicy: 'network-only',
  })
  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })

  const documentos: Documento[] = data?.documentosPendientes || []
  const tipos: TipoDocumento[] = tiposData?.tiposDocumento || []

  const handleAsignar = async (documentoId: number, tipoDocumentoId: string) => {
    if (asignandoId !== null) return
    setAsignandoId(documentoId)
    setErrorMsg(null)
    try {
      const res = await asignarDocumento({
        variables: {
          documentoId,
          tipoDocumentoId: parseInt(tipoDocumentoId, 10),
        },
      })
      if (res.data?.asignarDocumento && !res.data.asignarDocumento.success) {
        setErrorMsg(res.data.asignarDocumento.message || 'Error al asignar el documento')
      } else {
        await refetch()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor'
      setErrorMsg(message)
    } finally {
      setAsignandoId(null)
    }
  }

  const openDocViewer = (doc: Documento) => {
    setSelectedDoc(doc)
    setShowDialog(true)
  }

  const personasMap = new Map<number, { persona: Persona; documentos: Documento[] }>()
  documentos.forEach((doc) => {
    if (doc.persona) {
      const personaId = doc.persona.id
      if (!personasMap.has(personaId)) {
        personasMap.set(personaId, { persona: doc.persona, documentos: [] })
      }
      personasMap.get(personaId)!.documentos.push(doc)
    }
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

      {errorMsg && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/20"
            onClick={() => setErrorMsg(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="text-sm">
                {documentos.length} documento{documentos.length !== 1 ? 's' : ''} en página {pagina}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ({personasConPendientes.length} persona{personasConPendientes.length !== 1 ? 's' : ''})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2">Página {pagina}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina((p) => p + 1)}
                disabled={documentos.length < limite}
                className="gap-1"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {personasConPendientes.map(({ persona, documentos: docsPersona }) => (
              <PendientesPersonaGroup
                key={persona.id}
                persona={persona}
                documentos={docsPersona}
                tipos={tipos}
                asignandoId={asignandoId}
                onAsignar={handleAsignar}
                onVerDocumento={openDocViewer}
              />
            ))}
          </div>
        </>
      )}

      {/* Modal visor del PDF */}
      <DocumentoViewerModal
        documento={selectedDoc}
        open={showDialog}
        onClose={() => {
          setShowDialog(false)
          setSelectedDoc(null)
        }}
      />
    </div>
  )
}

// Alias export para retrocompatibilidad
export const DocumentosPendientes = DocumentosPendientesPage
