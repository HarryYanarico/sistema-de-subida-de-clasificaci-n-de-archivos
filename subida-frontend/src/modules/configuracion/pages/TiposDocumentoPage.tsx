import { useState, FormEvent } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import {
  CREATE_TIPO_DOCUMENTO,
  UPDATE_TIPO_DOCUMENTO,
  DELETE_TIPO_DOCUMENTO,
  GENERAR_SUGERENCIAS_KEYWORDS,
} from '@graphql/mutations/tipo-documento.mutations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Sparkles, X, Loader2 } from 'lucide-react'
import { TipoDocumentoList } from '../components/TipoDocumentoList/TipoDocumentoList'
import { TipoDocumentoForm } from '../components/TipoDocumentoForm/TipoDocumentoForm'
import {
  formatKeywordsForPayload,
  parseKeywords,
  parseKeywordsToUI,
} from '../services/tipos-documento.service'
import { TipoForm } from '../types/configuracion.types'
import { TipoDocumento } from '@app-types/index'

const emptyForm: TipoForm = {
  nombre: '',
  palabrasClave: [],
}

export function TiposDocumentoPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TipoForm>(emptyForm)

  const { data, loading, refetch } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })

  const [createTipo] = useMutation(CREATE_TIPO_DOCUMENTO)
  const [updateTipo] = useMutation(UPDATE_TIPO_DOCUMENTO)
  const [deleteTipo] = useMutation(DELETE_TIPO_DOCUMENTO)
  const [generarSugerencias, { loading: analizando }] = useMutation(GENERAR_SUGERENCIAS_KEYWORDS)

  const [analisisMsg, setAnalisisMsg] = useState<{ tipo: 'success' | 'warning'; texto: string } | null>(null)

  const tipos: TipoDocumento[] = data?.tiposDocumento || []

  const handleAnalizarDocumentos = async () => {
    setAnalisisMsg(null)
    try {
      const res = await generarSugerencias({
        variables: { minDocs: 5, top: 5, limpiar: false },
      })
      const payload = res.data?.generarSugerenciasKeywords
      if (payload?.success) {
        setAnalisisMsg({
          tipo: 'success',
          texto: payload.message || 'Se encontraron y actualizaron sugerencias de palabras clave.',
        })
        refetch()
      } else {
        setAnalisisMsg({
          tipo: 'warning',
          texto: payload?.message || 'No se pudieron generar sugerencias en este momento.',
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al conectar con el servidor para analizar.'
      setAnalisisMsg({
        tipo: 'warning',
        texto: message,
      })
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ nombre: '', palabrasClave: [], keywordsItems: [] })
    setDialogOpen(true)
  }

  const openEdit = (tipo: TipoDocumento) => {
    setEditingId(tipo.id)
    const rawKeywords = tipo.palabrasClave || tipo.palabras_clave || ''
    const obligatorias = (tipo as any).keywordsObligatorias || (tipo as any).keywords_obligatorias || []
    const items = parseKeywordsToUI(rawKeywords, obligatorias)
    setForm({
      nombre: tipo.nombre,
      palabrasClave: items.map((i) => `${i.palabra}:${i.esObligatoria ? 5 : 3}`),
      keywordsItems: items,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const palabrasClave = formatKeywordsForPayload(form.palabrasClave)
    const payload = {
      nombre: form.nombre,
      palabrasClave,
    }

    try {
      if (editingId) {
        const { data: updateData } = await updateTipo({
          variables: { id: Number(editingId), ...payload },
        })
        if (!updateData?.updateTipoDocumento?.success) {
          alert(updateData?.updateTipoDocumento?.message || 'Error al guardar')
          return
        }
      } else {
        const { data: createData } = await createTipo({
          variables: { ...payload },
        })
        if (!createData?.createTipoDocumento?.success) {
          alert(createData?.createTipoDocumento?.message || 'Error al crear')
          return
        }
      }
      setForm(emptyForm)
      setEditingId(null)
      setDialogOpen(false)
      refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`Error al ${editingId ? 'guardar' : 'crear'} tipo de documento: ` + message)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('¿Está seguro de eliminar este tipo de documento?')) {
      try {
        const { data: deleteData } = await deleteTipo({ variables: { id: Number(id) } })
        if (!deleteData?.deleteTipoDocumento?.success) {
          alert(deleteData?.deleteTipoDocumento?.message || 'Error al eliminar')
          return
        }
        refetch()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        alert('Error al eliminar tipo de documento: ' + message)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tipos de Documento</h1>
          <p className="text-sm text-muted-foreground">
            Configura los tipos de documentos y las palabras clave que el sistema usa para clasificar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAnalizarDocumentos}
            disabled={analizando}
            className="border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
            title="Analiza automáticamente documentos verificados y propone nuevas palabras clave"
          >
            {analizando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-amber-500" />
                Analizando documentos...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                Buscar Nuevas Palabras Clave
              </>
            )}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {analisisMsg && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            analisisMsg.tipo === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{analisisMsg.texto}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAnalisisMsg(null)}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Lista de Tipos */}
      <TipoDocumentoList
        tipos={tipos}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {/* Modal Crear / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Tipo de Documento' : 'Crear Tipo de Documento'}
            </DialogTitle>
          </DialogHeader>
          <TipoDocumentoForm
            form={form}
            editingId={editingId}
            onChange={setForm}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false)
              setForm(emptyForm)
              setEditingId(null)
            }}
            onPalabrasActualizadas={(nuevasPalabras) => {
              setForm((prev) => ({
                ...prev,
                palabrasClave: parseKeywords(nuevasPalabras),
              }))
              refetch()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Alias export para retrocompatibilidad
export const TiposDocumento = TiposDocumentoPage
