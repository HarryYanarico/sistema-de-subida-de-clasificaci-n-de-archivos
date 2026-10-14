import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_PERSONA } from '@graphql/queries/persona.queries'
import { GET_DOCUMENTOS_PERSONA } from '@graphql/queries/documento.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import { ASIGNAR_DOCUMENTO, CREAR_Y_ASIGNAR_TIPO } from '@graphql/mutations/documento.mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  FileText,
  AlertCircle,
  User,
  Printer,
  Calendar,
  Mail,
  Phone,
  CreditCard,
  Plus,
  Loader2,
} from 'lucide-react'
import { TipoDocumentoCard } from '../components/TipoDocumentoCard/TipoDocumentoCard'
import { Documento, TipoDocumento, Persona } from '@app-types/index'
import { ROUTES } from '@config/routes'

export function CasilleroDocumentosPage() {
  const { id } = useParams<{ id: string }>()
  const personaId = parseInt(id || '0', 10)

  const [asignarDocumento] = useMutation(ASIGNAR_DOCUMENTO)
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const { data: personaData, loading: loadingPersona } = useQuery(GET_PERSONA, {
    variables: { id: personaId },
  })

  const { data: docsData, loading: loadingDocs, refetch } = useQuery(GET_DOCUMENTOS_PERSONA, {
    variables: { personaId },
  })

  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })

  const persona: Persona | undefined = personaData?.persona
  const documentos: Documento[] = docsData?.documentosPersona?.documentos || []
  const totalPaginas: number = docsData?.documentosPersona?.totalPaginas || 0
  const clasificados: number = docsData?.documentosPersona?.clasificados || 0
  const pendientes: number = docsData?.documentosPersona?.pendientes || 0
  const tipos: TipoDocumento[] = tiposData?.tiposDocumento || []

  const handleAsignar = async (documentoId: number, tipoDocumentoId: string) => {
    await asignarDocumento({
      variables: {
        documentoId: parseInt(String(documentoId), 10),
        tipoDocumentoId: parseInt(tipoDocumentoId, 10),
      },
    })
    refetch()
  }

  const getDocumentosForTipo = (tipoId: number) => {
    return documentos.filter((doc) => doc.tipoDocumento?.id === tipoId)
  }

  const openDocViewer = (doc: Documento) => {
    setSelectedDoc(doc)
    setShowDialog(true)
  }

  const [crearYAsignarTipo] = useMutation(CREAR_Y_ASIGNAR_TIPO)
  const [docParaCrearTipo, setDocParaCrearTipo] = useState<Documento | null>(null)
  const [showCrearTipoDialog, setShowCrearTipoDialog] = useState(false)
  const [nombreNuevoTipo, setNombreNuevoTipo] = useState('')
  const [palabrasClaveNuevoTipo, setPalabrasClaveNuevoTipo] = useState('')
  const [loadingCrearTipo, setLoadingCrearTipo] = useState(false)

  const openCrearTipoDialog = (doc: Documento) => {
    setDocParaCrearTipo(doc)
    setNombreNuevoTipo('')
    setPalabrasClaveNuevoTipo('')
    setShowCrearTipoDialog(true)
  }

  const handleCrearYAsignar = async () => {
    if (!docParaCrearTipo || !nombreNuevoTipo.trim()) return
    setLoadingCrearTipo(true)
    try {
      const { data } = await crearYAsignarTipo({
        variables: {
          documentoId: parseInt(String(docParaCrearTipo.id), 10),
          nombre: nombreNuevoTipo.trim(),
          palabrasClave: palabrasClaveNuevoTipo.trim(),
        },
      })
      if (data?.crearYAsignarTipo?.success) {
        setShowCrearTipoDialog(false)
        setDocParaCrearTipo(null)
        setNombreNuevoTipo('')
        setPalabrasClaveNuevoTipo('')
        refetch()
      }
    } finally {
      setLoadingCrearTipo(false)
    }
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
        <Link to={ROUTES.PERSONAS.ROOT}>
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
            {tipos
              .filter((tipo) => documentos.some((doc) => doc.tipoDocumento?.id === tipo.id))
              .map((tipo) => {
                const docs = getDocumentosForTipo(tipo.id)

                return (
                  <TipoDocumentoCard
                    key={tipo.id}
                    tipo={tipo}
                    docs={docs}
                    tipos={tipos}
                    onOpenViewer={openDocViewer}
                    onAsignar={handleAsignar}
                  />
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
                .filter((doc) => !doc.tipoDocumento)
                .map((doc) => (
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
                        onClick={(e) => {
                          e.stopPropagation()
                          openCrearTipoDialog(doc)
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Crear tipo
                      </Button>
                      <Select onValueChange={(value) => handleAsignar(doc.id, value)}>
                        <SelectTrigger
                          className="w-[180px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.map((tipo) => (
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

      {/* Dialog de crear tipo manual */}
      <Dialog open={showCrearTipoDialog} onOpenChange={setShowCrearTipoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Crear tipo y asignar
            </DialogTitle>
            <DialogDescription>
              Página {docParaCrearTipo?.paginaNumero} — Se creará el tipo y se asignará el documento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Nombre del nuevo tipo</Label>
              <Input
                className="mt-1.5"
                value={nombreNuevoTipo}
                onChange={(e) => setNombreNuevoTipo(e.target.value)}
                placeholder="Ej: Libreta de Notas"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Palabras clave (separadas por coma)</Label>
              <Input
                className="mt-1.5"
                value={palabrasClaveNuevoTipo}
                onChange={(e) => setPalabrasClaveNuevoTipo(e.target.value)}
                placeholder="Ej: libreta, notas, calificaciones"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowCrearTipoDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCrearYAsignar}
                disabled={loadingCrearTipo || !nombreNuevoTipo.trim()}
              >
                {loadingCrearTipo ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Crear tipo y asignar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Alias export para retrocompatibilidad
export const CasilleroDocumentos = CasilleroDocumentosPage
