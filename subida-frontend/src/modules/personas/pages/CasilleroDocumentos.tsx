import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_PERSONA } from '@/graphql/queries/personas'
import { GET_DOCUMENTOS_PERSONA, GET_TIPOS_DOCUMENTO } from '@/graphql/queries/documentos'
import { ASIGNAR_DOCUMENTO, SUGERIR_CLASIFICACION_IA } from '@/graphql/mutations/documentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { ArrowLeft, FileText, AlertCircle, User, Printer, Calendar, Mail, Phone, CreditCard, Sparkles, Loader2 } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CasilleroDocumentos() {
  const { id } = useParams<{ id: string }>()
  const [asignarDocumento] = useMutation(ASIGNAR_DOCUMENTO)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [showDialog, setShowDialog] = useState(false)
  const { unidadActiva } = useUnidad()

  const { data: personaData, loading: loadingPersona } = useQuery(GET_PERSONA, {
    variables: { id: parseInt(id || '0') },
  })

  const { data: docsData, loading: loadingDocs, refetch } = useQuery(GET_DOCUMENTOS_PERSONA, {
    variables: { personaId: parseInt(id || '0') },
  })

  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { unidadId: Number(unidadActiva?.id) || 0, activo: true },
    skip: !unidadActiva,
  })

  const persona = personaData?.persona
  const documentos = docsData?.documentosPersona?.documentos || []
  const totalPaginas = docsData?.documentosPersona?.totalPaginas || 0
  const clasificados = docsData?.documentosPersona?.clasificados || 0
  const pendientes = docsData?.documentosPersona?.pendientes || 0
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

  const getDocumentoForTipo = (tipoId: number) => {
    return documentos.find((doc: any) => doc.tipoDocumento?.id === tipoId)
  }

  const openDocViewer = (doc: any) => {
    setSelectedDoc(doc)
    setShowDialog(true)
  }

  const [sugerirIA] = useMutation(SUGERIR_CLASIFICACION_IA)
  const [loadingSugerirId, setLoadingSugerirId] = useState<number | null>(null)
  const [suggestionDoc, setSuggestionDoc] = useState<any>(null)
  const [suggestionResult, setSuggestionResult] = useState<any>(null)
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false)

  const handleSugerirIA = async (doc: any) => {
    const docId = parseInt(doc.id)
    setLoadingSugerirId(docId)
    try {
      const { data } = await sugerirIA({ variables: { documentoId: docId } })
      if (data?.sugerirClasificacionIa?.success) {
        setSuggestionDoc(doc)
        setSuggestionResult(data.sugerirClasificacionIa)
        setShowSuggestionDialog(true)
      }
    } finally {
      setLoadingSugerirId(null)
    }
  }

  const handleAplicarSugerencia = async () => {
    if (!suggestionResult?.tipoSugerido || !suggestionDoc) return
    await handleAsignar(suggestionDoc.id, suggestionResult.tipoSugerido.id.toString())
    setShowSuggestionDialog(false)
    setSuggestionDoc(null)
    setSuggestionResult(null)
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

  if (loadingPersona || loadingDocs) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>
  }

  if (!persona) {
    return <div className="text-center py-8 text-muted-foreground">Persona no encontrada</div>
  }

  const porcentaje = totalPaginas > 0 ? Math.round((clasificados / totalPaginas) * 100) : 0
  const initials = `${persona.nombres?.[0] || ''}${persona.apellidos?.[0] || ''}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/personas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Casillero de Documentos</h1>
          <p className="text-muted-foreground">Código: {persona.codigo}</p>
        </div>
      </div>

      {/* Perfil de la Persona */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre completo</p>
                <p className="font-medium">{persona.nombres} {persona.apellidos}</p>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Código</p>
                  <p className="font-mono font-medium">{persona.codigo}</p>
                </div>
              </div>
              {persona.ci && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Carnet de Identidad</p>
                    <p className="font-medium">{persona.ci}</p>
                  </div>
                </div>
              )}
              {persona.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{persona.email}</p>
                  </div>
                </div>
              )}
              {persona.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono</p>
                    <p className="font-medium">{persona.telefono}</p>
                  </div>
                </div>
              )}
              {persona.createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de registro</p>
                    <p className="font-medium">{new Date(persona.createdAt).toLocaleDateString('es-BO')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalPaginas}</div>
            <p className="text-sm text-muted-foreground">Total Páginas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{clasificados}</div>
            <p className="text-sm text-muted-foreground">Clasificados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">{pendientes}</div>
            <p className="text-sm text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Progress value={porcentaje} className="flex-1" />
              <span className="text-sm font-medium">{porcentaje}%</span>
            </div>
            <p className="text-sm text-muted-foreground">Progreso</p>
          </CardContent>
        </Card>
      </div>

      {/* Casillero de Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Asignados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tipos.filter((tipo: any) => documentos.some((doc: any) => doc.tipoDocumento?.id === tipo.id)).map((tipo: any) => {
              const doc = getDocumentoForTipo(tipo.id)
              const hasDoc = !!doc

              return (
                <div
                  key={tipo.id}
                  onClick={() => hasDoc && openDocViewer(doc)}
                  className={`group relative rounded-lg border overflow-hidden transition-all ${
                    hasDoc
                      ? 'border-border hover:border-primary/50 hover:shadow-md cursor-pointer'
                      : 'border-dashed'
                  }`}
                >
                  {/* Thumbnail area */}
                  <div className="aspect-[3/4] bg-muted/30 flex items-center justify-center relative">
                    {hasDoc ? (
                      <img
                        src={`/api/documents/${doc.id}/thumbnail/`}
                        alt={`Página ${doc.paginaNumero}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground/30" />
                    )}
                    {hasDoc && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    )}
                  </div>

                  {/* Info area */}
                  <div className="p-3 border-t">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{tipo.nombre}</span>
                    </div>
                    {hasDoc ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="success" className="text-xs flex-shrink-0">Pág. {doc.paginaNumero}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            handleSugerirIA(doc)
                          }}
                          disabled={loadingSugerirId === doc.id}
                        >
                          {loadingSugerirId === doc.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                        </Button>
                        <Select
                          defaultValue={tipo.id.toString()}
                          onValueChange={(value) => handleAsignar(doc.id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <SelectValue placeholder="Cambiar" />
                          </SelectTrigger>
                          <SelectContent>
                            {tipos.map((t: any) => (
                              <SelectItem key={t.id} value={t.id.toString()}>
                                {t.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin documento asignado</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Documentos sin clasificar */}
      {pendientes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Documentos Sin Clasificar ({pendientes})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documentos
                .filter((doc: any) => !doc.tipoDocumento)
                .map((doc: any) => (
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
                              {doc.textoExtraido.slice(0, 80)}...
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            handleSugerirIA(doc)
                          }}
                          disabled={loadingSugerirId === doc.id}
                        >
                          {loadingSugerirId === doc.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          Sugerir IA
                        </Button>
                        <Select onValueChange={(value) => handleAsignar(doc.id, value)}>
                          <SelectTrigger className="w-[180px]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog/Modal de visor de documento */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl w-[90vw] !flex !flex-col !h-[85vh] !p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  {selectedDoc?.tipoDocumento?.nombre || 'Documento sin clasificar'}
                </DialogTitle>
                <DialogDescription>
                  Página {selectedDoc?.paginaNumero} de {persona.nombres} {persona.apellidos}
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

      {/* Dialog de sugerencia IA */}
      <Dialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Sugerencia de Clasificación IA
            </DialogTitle>
            <DialogDescription>
              Página {suggestionDoc?.paginaNumero} — Basado en el texto extraído del documento
            </DialogDescription>
          </DialogHeader>

          {suggestionResult && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Tipo de documento sugerido</Label>
                <div className="mt-1.5 p-3 rounded-lg border bg-primary/5 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {suggestionResult.tipoSugerido?.nombre || 'Tipo nuevo'}
                    </p>
                    {suggestionResult.esNuevoTipo && (
                      <p className="text-xs text-muted-foreground">No coincide con ningún tipo existente</p>
                    )}
                  </div>
                </div>
              </div>

              {suggestionResult.palabrasClaveSugeridas && (
                <div>
                  <Label className="text-sm font-medium">Palabras clave sugeridas</Label>
                  <Input
                    className="mt-1.5"
                    value={suggestionResult.palabrasClaveSugeridas}
                    readOnly
                  />
                </div>
              )}

              {suggestionResult.esNuevoTipo && (
                <div className="p-3 rounded-lg bg-muted border text-sm text-muted-foreground">
                  La IA sugiere que este documento corresponde a un tipo nuevo. Puedes crearlo desde la configuración de Tipos de Documento.
                </div>
              )}

              {suggestionResult.rawResponse && (
                <div>
                  <Label className="text-sm font-medium">Respuesta de Gemini</Label>
                  <div className="mt-1.5 p-3 rounded-lg border bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {suggestionResult.rawResponse}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setShowSuggestionDialog(false)}>
                  Descartar
                </Button>
                {suggestionResult.tipoSugerido && (
                  <Button onClick={handleAplicarSugerencia}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Aplicar como {suggestionResult.tipoSugerido.nombre}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
