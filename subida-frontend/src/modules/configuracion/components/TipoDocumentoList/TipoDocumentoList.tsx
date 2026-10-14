import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { TipoDocumentoListProps } from './TipoDocumentoList.types'

export function TipoDocumentoList({
  tipos,
  loading,
  onEdit,
  onDelete,
}: TipoDocumentoListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Tipos ({tipos.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        ) : tipos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground italic">
            No hay tipos de documento registrados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Palabras Clave</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipos.map((tipo) => (
                <TableRow key={tipo.id}>
                  <TableCell className="font-medium">{tipo.nombre}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(tipo.palabrasClave || tipo.palabras_clave) ? (
                        (tipo.palabrasClave || tipo.palabras_clave)!.split(',').map((palabra: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {palabra.trim().split(':')[0]}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin palabras clave</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(tipo)}
                        title="Editar tipo"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(tipo.id)}
                        title="Eliminar tipo"
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
  )
}
