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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { KeywordInput } from '@/components/ui/keyword-input'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

interface TipoForm {
  nombre: string
  palabrasClave: string[]
  requiere: string
  excluye: string
  scoreMinimo: number
  esObligatorio: boolean
  orden: number
}

const emptyForm: TipoForm = {
  nombre: '',
  palabrasClave: [],
  requiere: '',
  excluye: '',
  scoreMinimo: 3,
  esObligatorio: false,
  orden: 0,
}

export function TiposDocumento() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unidadActiva) return
    try {
      const { data } = await createTipo({
        variables: {
          unidadId: Number(unidadActiva.id),
          nombre: form.nombre,
          palabrasClave: form.palabrasClave.join(', '),
          requiere: form.requiere,
          excluye: form.excluye,
          scoreMinimo: form.scoreMinimo,
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
      requiere: tipo.requiere || '',
      excluye: tipo.excluye || '',
      scoreMinimo: tipo.scoreMinimo || 3,
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
          requiere: form.requiere,
          excluye: form.excluye,
          scoreMinimo: form.scoreMinimo,
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
        <Label>Palabras Clave (palabra:peso) *</Label>
        <KeywordInput
          value={form.palabrasClave}
          onChange={(keywords) => setForm({ ...form, palabrasClave: keywords })}
          placeholder="Ej: certificado:5, nacimiento:4"
        />
        <p className="text-xs text-muted-foreground">
          Formato: palabra:peso (peso 1-5). Mayor peso = mayor prioridad en la clasificación.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`requiere-${mode}`}>Requiere (keywords)</Label>
          <Input
            id={`requiere-${mode}`}
            value={form.requiere}
            onChange={(e) => setForm({ ...form, requiere: e.target.value })}
            placeholder="Ej: certificado, nacimiento"
          />
          <p className="text-xs text-muted-foreground">
            Palabras que DEBEN estar en el texto para clasificar
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`excluye-${mode}`}>Excluye (slugs)</Label>
          <Input
            id={`excluye-${mode}`}
            value={form.excluye}
            onChange={(e) => setForm({ ...form, excluye: e.target.value })}
            placeholder="Ej: diploma-bachiller-reverso"
          />
          <p className="text-xs text-muted-foreground">
            Slugs de tipos que se excluyen mutuamente
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`scoreMinimo-${mode}`}>Score Mínimo</Label>
          <Input
            id={`scoreMinimo-${mode}`}
            type="number"
            min={1}
            max={20}
            value={form.scoreMinimo}
            onChange={(e) => setForm({ ...form, scoreMinimo: parseInt(e.target.value) || 3 })}
          />
          <p className="text-xs text-muted-foreground">
            Score ponderado mínimo para clasificar
          </p>
        </div>
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
          <Label htmlFor={`obligatorio-${mode}`}>Obligatorio</Label>
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
          <DialogContent className="max-w-2xl">
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
                  <TableHead>Ord.</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Palabras Clave</TableHead>
                  <TableHead>Requiere</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Obl.</TableHead>
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
                      {tipo.requiere ? (
                        <div className="flex flex-wrap gap-1">
                          {tipo.requiere.split(',').map((r: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {r.trim()}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{'>'}= {tipo.scoreMinimo}</Badge>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Tipo de Documento</DialogTitle>
          </DialogHeader>
          {tipoForm('edit')}
        </DialogContent>
      </Dialog>
    </div>
  )
}
