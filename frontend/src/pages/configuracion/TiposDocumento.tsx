import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_TIPOS_DOCUMENTO } from '@/graphql/queries/documentos'
import { CREATE_TIPO_DOCUMENTO, UPDATE_TIPO_DOCUMENTO, DELETE_TIPO_DOCUMENTO } from '@/graphql/mutations/documentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { KeywordInput } from '@/components/ui/keyword-input'
import { Plus, Trash2, Pencil } from 'lucide-react'

interface TipoForm {
  nombre: string
  palabrasClave: string[]
  esObligatorio: boolean
  orden: number
}

const emptyForm: TipoForm = { nombre: '', palabrasClave: [], esObligatorio: false, orden: 0 }

export function TiposDocumento() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<TipoForm>(emptyForm)

  const { data, loading, refetch } = useQuery(GET_TIPOS_DOCUMENTO)
  const [createTipo] = useMutation(CREATE_TIPO_DOCUMENTO)
  const [updateTipo] = useMutation(UPDATE_TIPO_DOCUMENTO)
  const [deleteTipo] = useMutation(DELETE_TIPO_DOCUMENTO)

  const tipos = data?.tiposDocumento || []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data } = await createTipo({
        variables: {
          nombre: form.nombre,
          palabrasClave: form.palabrasClave.join(', '),
          esObligatorio: form.esObligatorio,
          orden: form.orden,
        },
      })
      if (!data?.createTipoDocumento?.success) {
        alert(data?.createTipoDocumento?.message || 'Error al crear')
        return
      }
      setForm(emptyForm)
      setCreateOpen(false)
      refetch()
    } catch (err: any) {
      alert('Error al crear tipo de documento: ' + (err.message || err))
    }
  }

  const openEdit = (tipo: any) => {
    setEditId(tipo.id)
    setForm({
      nombre: tipo.nombre,
      palabrasClave: tipo.palabrasClave ? tipo.palabrasClave.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      esObligatorio: tipo.esObligatorio,
      orden: tipo.orden,
    })
    setEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    try {
      const { data } = await updateTipo({
        variables: {
          id: Number(editId),
          nombre: form.nombre,
          palabrasClave: form.palabrasClave.join(', '),
          esObligatorio: form.esObligatorio,
          orden: form.orden,
        },
      })
      if (!data?.updateTipoDocumento?.success) {
        alert(data?.updateTipoDocumento?.message || 'Error al guardar')
        return
      }
      setForm(emptyForm)
      setEditId(null)
      setEditOpen(false)
      refetch()
    } catch (err: any) {
      alert('Error al guardar tipo de documento: ' + (err.message || err))
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

  const tipoForm = (mode: 'create' | 'edit') => (
    <form onSubmit={mode === 'create' ? handleCreate : handleEdit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`nombre-${mode}`}>Nombre *</Label>
        <Input
          id={`nombre-${mode}`}
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
          placeholder="Escribir y presionar Enter"
        />
        <p className="text-xs text-muted-foreground">
          Palabras o frases que aparecen en el documento para clasificación automática
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`orden-${mode}`}>Orden</Label>
          <Input
            id={`orden-${mode}`}
            type="number"
            value={form.orden}
            onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id={`obligatorio-${mode}`}
            checked={form.esObligatorio}
            onChange={(e) => setForm({ ...form, esObligatorio: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor={`obligatorio-${mode}`}>Documento Obligatorio</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditOpen(false); setForm(emptyForm) }}>
          Cancelar
        </Button>
        <Button type="submit">{mode === 'create' ? 'Crear' : 'Guardar'}</Button>
      </div>
    </form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tipos de Documento</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Tipo de Documento</DialogTitle>
            </DialogHeader>
            {tipoForm('create')}
          </DialogContent>
        </Dialog>
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
                  <TableHead>Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Palabras Clave</TableHead>
                  <TableHead>Obligatorio</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipos.map((tipo: any) => (
                  <TableRow key={tipo.id}>
                    <TableCell>{tipo.orden}</TableCell>
                    <TableCell className="font-medium">{tipo.nombre}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tipo.palabrasClave.split(',').map((palabra: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {palabra.trim()}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tipo.esObligatorio ? (
                        <Badge variant="destructive">Sí</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tipo de Documento</DialogTitle>
          </DialogHeader>
          {tipoForm('edit')}
        </DialogContent>
      </Dialog>
    </div>
  )
}
