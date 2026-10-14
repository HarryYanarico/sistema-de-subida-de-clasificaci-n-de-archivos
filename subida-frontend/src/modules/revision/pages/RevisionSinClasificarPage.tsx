import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_DOCUMENTOS_SIN_CLASIFICAR } from '@graphql/queries/revision.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import { RECLASIFICAR_DOCUMENTO } from '@graphql/mutations/documento.mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { useColaRevision } from '../hooks/useColaRevision'
import { VisorDocumento } from '../components/VisorRevision/VisorRevision'
import { RevisionItemCard } from '../components/RevisionItemCard/RevisionItemCard'
import { Documento, TipoDocumento } from '@app-types/index'

/**
 * Cola de revisión de documentos que el clasificador no pudo resolver.
 */
export function RevisionSinClasificarPage() {
  const { documentos, loading, error, recargar, cargarMas, hayMas } =
    useColaRevision(GET_DOCUMENTOS_SIN_CLASIFICAR)

  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })
  const tipos: TipoDocumento[] = tiposData?.tiposDocumento || []

  const [seleccion, setSeleccion] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState<number | null>(null)
  const [visorDoc, setVisorDoc] = useState<Documento | null>(null)
  const [reclasificarDocumento] = useMutation(RECLASIFICAR_DOCUMENTO)

  const confirmar = async (documentoId: number) => {
    const tipoId = seleccion[documentoId]
    if (!tipoId) return

    setGuardando(documentoId)
    try {
      await reclasificarDocumento({
        variables: { documentoId, tipoDocumentoId: Number(tipoId) },
      })
      recargar()
    } finally {
      setGuardando(null)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revisión: Sin Clasificar</h1>
        <p className="text-muted-foreground">
          Páginas donde el clasificador no encontró ningún tipo de documento
        </p>
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No hay documentos sin clasificar
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Todo quedó clasificado
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-sm">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} por revisar
            </Badge>
            {hayMas && (
              <Button variant="ghost" size="sm" onClick={cargarMas}>
                Cargar más
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {documentos.map((doc: Documento) => (
              <RevisionItemCard
                key={doc.id}
                documento={doc}
                tipos={tipos}
                seleccionadoTipoId={seleccion[doc.id]}
                guardando={guardando === doc.id}
                onSeleccionarTipo={(tipoId) =>
                  setSeleccion((prev) => ({ ...prev, [doc.id]: tipoId }))
                }
                onConfirmar={() => confirmar(doc.id)}
                onVerDocumento={setVisorDoc}
              />
            ))}
          </div>
        </>
      )}

      {/* Visor completo del documento */}
      <VisorDocumento documento={visorDoc} onClose={() => setVisorDoc(null)} />
    </div>
  )
}

// Alias export para retrocompatibilidad
export const RevisionSinClasificar = RevisionSinClasificarPage
