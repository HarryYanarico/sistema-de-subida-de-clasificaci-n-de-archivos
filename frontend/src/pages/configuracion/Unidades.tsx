import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_UNIDADES } from '@/graphql/queries/unidades'
import { CREATE_UNIDAD, UPDATE_UNIDAD, DELETE_UNIDAD } from '@/graphql/mutations/unidades'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

interface UnidadForm {
  nombre: string
  descripcion: string
}

const emptyForm: UnidadForm = {
  nombre: '',
  descripcion: '',
}

export function Unidades() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<UnidadForm>(emptyForm)

  const { data, loading, refetch } = useQuery(GET_UNIDADES)
  const { refetch: refetchContext } = useUnidad()
  const [createUnidad] = useMutation(CREATE_UNIDAD)
  const [updateUnidad] = useMutation(UPDATE_UNIDAD)
  const [deleteUnidad] = useMutation(DELETE_UNIDAD)

  const unidades = data?.unidades || []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data } = await createUnidad({
        variables: {
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
        },
      })
      if (!data?.createUnidad?.success) {
        alert(data?.createUnidad?.message || 'Error al crear')
        return
      }
      setForm(emptyForm)
      setCreateOpen(false)
      refetch()
      refetchContext()
    } catch (err: any) {
      alert('Error al crear unidad: ' + (err.message || err))
    }
  }

  const openEdit = (unidad: any) => {
    setEditId(unidad.id)
    setForm({
      nombre: unidad.nombre,
      descripcion: unidad.descripcion || '',
    })
    setEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    try {
      const { data } = await updateUnidad({
        variables: {
          id: Number(editId),
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
        },
      })
      if (!data?.updateUnidad?.success) {
        alert(data?.updateUnidad?.message || 'Error al guardar')
        return
      }
      setForm(emptyForm)
      setEditId(null)
      setEditOpen(false)
      refetch()
      refetchContext()
    } catch (err: any) {
      alert('Error al guardar unidad: ' + (err.message || err))
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('¿Está seguro de eliminar esta unidad? Se desactivará.')) {
      try {
        const { data } = await deleteUnidad({ variables: { id: Number(id) } })
        if (!data?.deleteUnidad?.success) {
          alert(data?.deleteUnidad?.message || 'Error al eliminar')
          return
        }
        refetch()
        refetchContext()
      } catch (err: any) {
        alert('Error al eliminar unidad: ' + (err.message || err))
      }
    }
  }

  const unidadForm = (mode: 'create' | 'edit') => (
    <form onSubmit={mode === 'create' ? handleCreate : handleEdit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`nombre-${mode}`}>Nombre *</Label>
        <Input
          id={`nombre-${mode}`}
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Ej: Dirección de Registro y Admisión"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`descripcion-${mode}`}>Descripción</Label>
        <Input
          id={`descripcion-${mode}`}
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Descripción breve de la unidad"
        />
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
        <h1 className="text-3xl font-bold">Unidades</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Unidad</DialogTitle>
            </DialogHeader>
            {unidadForm('create')}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Unidades ({unidades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unidades.map((unidad: any) => (
                  <TableRow key={unidad.id}>
                    <TableCell className="font-medium">{unidad.nombre}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{unidad.slug}</TableCell>
                    <TableCell className="text-muted-foreground">{unidad.descripcion || '-'}</TableCell>
                    <TableCell>
                      {unidad.activo ? (
                        <Badge variant="default">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(unidad)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(unidad.id)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Unidad</DialogTitle>
          </DialogHeader>
          {unidadForm('edit')}
        </DialogContent>
      </Dialog>
    </div>
  )
}
