import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_TIPOS_DOCUMENTO } from '@/graphql/queries/documentos'
import { CREATE_TIPO_DOCUMENTO, UPDATE_TIPO_DOCUMENTO, DELETE_TIPO_DOCUMENTO } from '@/graphql/mutations/documentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { KeywordInput } from '@/components/ui/keyword-input'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

interface TipoForm {
  nombre: string
  palabrasClave: string[]
}

const emptyForm: TipoForm = {
  nombre: '',
  palabrasClave: [],
}

function autoAssignWeight(keywords: string[]): string[] {
  return keywords.map(k => {
    if (k.includes(':')) return k
    return `${k}:3`
  })
}

export function TiposDocumento() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TipoForm>(emptyForm)
  const { unidadActiva } = useUnidad()

  const { data, loading, refetch } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { unidadId: Number(unidadActiva?.id) || 0, activo: true },
    skip: !unidadActiva,
  })

  useEffect(() => {
    if (unidadActiva) refetch()
  }, [unidadActiva?.id])

  const [createTipo] = useMutation(CREATE_TIPO_DOCUMENTO)
  const [updateTipo] = useMutation(UPDATE_TIPO_DOCUMENTO)
  const [deleteTipo] = useMutation(DELETE_TIPO_DOCUMENTO)

  const tipos = data?.tiposDocumento || []

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (tipo: any) => {
    setEditingId(tipo.id)
    setForm({
      nombre: tipo.nombre,
      palabrasClave: tipo.palabrasClave
        ? tipo.palabrasClave.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unidadActiva) return

    const keywordsWithWeight = autoAssignWeight(form.palabrasClave)
    const payload = {
      nombre: form.nombre,
      palabrasClave: keywordsWithWeight.join(', '),
    }

    try {
      if (editingId) {
        const { data } = await updateTipo({
          variables: { id: Number(editingId), ...payload },
        })
        if (!data?.updateTipoDocumento?.success) {
          alert(data?.updateTipoDocumento?.message || 'Error al guardar')
          return
        }
      } else {
        const { data } = await createTipo({
          variables: { unidadId: Number(unidadActiva.id), ...payload },
        })
        if (!data?.createTipoDocumento?.success) {
          alert(data?.createTipoDocumento?.message || 'Error al crear')
          return
        }
      }
      setForm(emptyForm)
      setEditingId(null)
      setDialogOpen(false)
      refetch()
    } catch (err: any) {
      alert(`Error al ${editingId ? 'guardar' : 'crear'} tipo de documento: ` + (err.message || err))
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('¿Está seguro de eliminar este tipo de documento?')) {
      try {
        const { data } = await deleteTipo({ variables: { id: Number(id) } })
        if (!data?.deleteTipoDocumento?.success) {
          alert(data?.deleteTipoDocumento?.message || 'Error al eliminar')
          return
        }
        refetch()
      } catch (err: any) {
        alert('Error al eliminar tipo de documento: ' + (err.message || err))
      }
    }
  }

  const dialogForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Ej: Certificado de Nacimiento"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Palabras Clave *</Label>
        <KeywordInput
          value={form.palabrasClave}
          onChange={(keywords) => setForm({ ...form, palabrasClave: keywords })}
          placeholder="Escribir palabra y presionar Enter"
        />
        <p className="text-xs text-muted-foreground">
          Palabras que identifican este tipo de documento. Se asigna peso automáticamente.
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setForm(emptyForm); setEditingId(null) }}>
          Cancelar
        </Button>
        <Button type="submit">{editingId ? 'Guardar' : 'Crear'}</Button>
      </div>
    </form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tipos de Documento</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Tipos ({tipos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Palabras Clave</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipos.map((tipo: any) => (
                  <TableRow key={tipo.id}>
                    <TableCell className="font-medium">{tipo.nombre}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tipo.palabrasClave.split(',').map((palabra: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {palabra.trim().split(':')[0]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(tipo)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tipo.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Tipo de Documento' : 'Crear Tipo de Documento'}</DialogTitle>
          </DialogHeader>
          {dialogForm}
        </DialogContent>
      </Dialog>
    </div>
  )
}
