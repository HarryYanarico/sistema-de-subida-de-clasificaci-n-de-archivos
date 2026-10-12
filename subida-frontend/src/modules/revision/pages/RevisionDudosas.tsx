import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_DOCUMENTOS_DUDOSOS, GET_TIPOS_DOCUMENTO } from '@/graphql/queries/documentos'
import { RECLASIFICAR_DOCUMENTO } from '@/graphql/mutations/documentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check } from 'lucide-react'
import { useColaRevision } from '../hooks/useColaRevision'
import { HistorialReclasificaciones, VisorDocumento } from '../components/VisorRevision'

/**
 * Cola de revision de documentos 'dudosa'.
 *
 * Estas paginas ya tienen un tipo asignado, pero el clasificador no estaba
 * seguro: el empate o el score bajo no sostienen la decision. El revisor
 * confirma el tipo correcto o elige otro.
 */
export function RevisionDudosas() {
  const { documentos, loading, error, recargar, cargarMas, hayMas } =
    useColaRevision(GET_DOCUMENTOS_DUDOSOS)

  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })
  const tipos = tiposData?.tiposDocumento || []

  const [seleccion, setSeleccion] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState<number | null>(null)
  const [visorDoc, setVisorDoc] = useState<any>(null)
  const [reclasificarDocumento] = useMutation(RECLASIFICAR_DOCUMENTO)

  const confirmar = async (documentoId: number) => {
    const tipoId = seleccion[documentoId]
    if (!tipoId) return

    setGuardando(documentoId)
    try {
      await reclasificarDocumento({
        variables: { documentoId, tipoDocumentoId: Number(tipoId) },
      })
      // La cola se recarga entera: el documento verificado ya no debe volver y
      // el que estaba detras pasa a ocupar su lugar.
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
        <h1 className="text-3xl font-bold">Revision: Documentos Dudosos</h1>
        <p className="text-muted-foreground">
          Paginas con tipo asignado pero eleccion no defendible por el clasificador
        </p>
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No hay documentos dudosos
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              El clasificador no tuvo ninguna decisión ambigua
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
                Cargar mas
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {documentos.map((doc: any) => (
              <Card key={doc.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Miniatura: el backend la renderiza on-the-fly desde el PDF */}
                    <button
                      type="button"
                      onClick={() => setVisorDoc(doc)}
                      className="shrink-0 w-full lg:w-40 border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                    >
                      <img
                        src={`/api/documents/${doc.id}/thumbnail/`}
                        alt={`Pagina ${doc.paginaNumero}`}
                        className="w-full aspect-[3/4] object-cover"
                        loading="lazy"
                      />
                    </button>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {doc.persona?.nombres} {doc.persona?.apellidos}
                            <span className="text-muted-foreground font-normal">
                              {' '}· Codigo {doc.persona?.codigo} · Pagina {doc.paginaNumero}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Clasificado como <strong>{doc.tipoDocumento?.nombre || '—'}</strong>
                            {doc.score != null && <> · score {doc.score}</>}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setVisorDoc(doc)}>
                          Ver pagina
                        </Button>
                      </div>

                      {doc.keywordsMatcheadas?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {doc.keywordsMatcheadas.map((k: string) => (
                            <Badge key={k} variant="secondary" className="text-xs">
                              {k}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {doc.textoExtraido && (
                        <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2 line-clamp-3 max-h-24 overflow-hidden">
                          {doc.textoExtraido}
                        </p>
                      )}

                      <HistorialReclasificaciones historial={doc.historialClasificacion} />

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select
                          value={seleccion[doc.id] || ''}
                          onValueChange={(value) =>
                            setSeleccion((prev) => ({ ...prev, [doc.id]: value }))
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Confirmar como..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tipos.map((tipo: any) => (
                              <SelectItem key={tipo.id} value={tipo.id.toString()}>
                                {tipo.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          disabled={!seleccion[doc.id] || guardando === doc.id}
                          onClick={() => confirmar(doc.id)}
                        >
                          {guardando === doc.id ? 'Guardando...' : 'Confirmar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <VisorDocumento documento={visorDoc} onClose={() => setVisorDoc(null)} />
    </div>
  )
}
