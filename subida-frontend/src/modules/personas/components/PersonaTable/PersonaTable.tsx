import { Link } from 'react-router-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { ROUTES } from '@config/routes'
import { PersonaTableProps } from './PersonaTable.types'

export function PersonaTable({
  personas,
  loading,
  page,
  totalPages,
  total,
  onPageChange,
}: PersonaTableProps) {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No se encontraron personas registradas
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombres</TableHead>
            <TableHead>Apellidos</TableHead>
            <TableHead>CI</TableHead>
            <TableHead>Documentos</TableHead>
            <TableHead>Progreso</TableHead>
            <TableHead className="w-16 text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {personas.map((persona) => (
            <TableRow key={persona.id}>
              <TableCell className="font-mono font-medium">{persona.codigo}</TableCell>
              <TableCell>{persona.nombres}</TableCell>
              <TableCell>{persona.apellidos}</TableCell>
              <TableCell>{persona.ci || '-'}</TableCell>
              <TableCell>
                {persona.documentosClasificados}/{persona.totalDocumentos}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={persona.porcentajeCompletado} className="w-20" />
                  <Badge variant={persona.porcentajeCompletado === 100 ? 'default' : 'secondary'}>
                    {persona.porcentajeCompletado}%
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Link to={ROUTES.PERSONAS.CASILLERO(persona.id)}>
                  <Button variant="ghost" size="sm" title="Ver Casillero">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando página {page} de {totalPages} ({total} personas en total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
