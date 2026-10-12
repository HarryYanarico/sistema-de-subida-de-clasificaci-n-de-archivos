import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_DOCUMENTOS_DUPLICADOS, GET_TIPOS_DOCUMENTO } from '@/graphql/queries/documentos'
import { RECLASIFICAR_DOCUMENTO } from '@/graphql/mutations/documentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, Copy } from 'lucide-react'
import { useColaRevision } from '../hooks/useColaRevision'
import { VisorDocumento } from '../components/VisorRevision'

/**
 * Cola de paginas marcadas como duplicados perceptuales.
 *
 * Cada tarjeta muestra la miniatura del duplicado junto a la del original, que
 * es la unica forma de que un humano confirme que son la misma pagina: dos
 * papeles con el mismo texto y distinto sello son documentos distintos.
 */
export function RevisionDuplicados() {
  const { documentos, loading, error, recargar, cargarMas, hayMas } =
    useColaRevision(GET_DOCUMENTOS_DUPLICADOS)

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
        <h1 className="text-3xl font-bold">Revisión: Duplicados</h1>
        <p className="text-muted-foreground">
          Páginas con el mismo contenido visual que otra ya presente
        </p>
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No hay documentos duplicados
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              No se detectó ninguna página repetida
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {documentos.length} duplicado{documentos.length !== 1 ? 's' : ''}
            </Badge>
            {hayMas && (
              <Button variant="ghost" size="sm" onClick={cargarMas}>
                Cargar más
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {documentos.map((doc: any) => (
              <Card key={doc.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="shrink-0 flex gap-2">
                      {/* El duplicado y su original, lado a lado */}
                      <button
                        type="button"
                        onClick={() => setVisorDoc(doc)}
                        className="w-28 border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                      >
                        <img
                          src={`/api/documents/${doc.id}/thumbnail/`}
                          alt={`Duplicado de ${doc.persona?.nombres}`}
                          className="w-full aspect-[3/4] object-cover"
                          loading="lazy"
                        />
                        <span className="block text-[10px] text-center py-1 bg-muted/50">
                          Duplicado
                        </span>
                      </button>

                      {doc.duplicadoDe && (
                        <button
                          type="button"
                          onClick={() => setVisorDoc({ ...doc, id: doc.duplicadoDe })}
                          className="w-28 border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                        >
                          <img
                            src={`/api/documents/${doc.duplicadoDe}/thumbnail/`}
                            alt="Documento original"
                            className="w-full aspect-[3/4] object-cover"
                            loading="lazy"
                          />
                          <span className="block text-[10px] text-center py-1 bg-muted/50">
                            Original
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <p className="font-medium">
                          {doc.persona?.nombres} {doc.persona?.apellidos}
                          <span className="text-muted-foreground font-normal">
                            {' '}· Código {doc.persona?.codigo} · Página {doc.paginaNumero}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Copy className="h-3 w-3" />
                          {doc.duplicadoDe
                            ? `Copia del documento #${doc.duplicadoDe}`
                            : 'Duplicado sin original identificado'}
                          {doc.tipoDocumento && <> · {doc.tipoDocumento.nombre}</>}
                        </p>
                      </div>

                      {doc.phash && (
                        <p className="text-[11px] text-muted-foreground font-mono">
                          phash: {doc.phash}
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select
                          value={seleccion[doc.id] || ''}
                          onValueChange={(value) =>
                            setSeleccion((prev) => ({ ...prev, [doc.id]: value }))
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="No es duplicado, asignar como..." />
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
