import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_PERSONAS } from '@/graphql/queries/personas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Link } from 'react-router-dom'
import { Plus, Search, Eye } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

export function ListaPersonas() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 10
  const { unidadActiva } = useUnidad()

  const { data, loading } = useQuery(GET_PERSONAS, {
    variables: { unidadId: unidadActiva?.id || 0, search, page, limit },
    skip: !unidadActiva,
  })

  const personas = data?.personas?.items || []
  const totalPages = data?.personas?.totalPages || 1
  const total = data?.personas?.total || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Personas</h1>
        <Link to="/personas/nueva">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Persona
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Personas ({total})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, CI..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : personas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron personas
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombres</TableHead>
                    <TableHead>Apellidos</TableHead>
                    <TableHead>CI</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personas.map((persona: any) => (
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
                      <TableCell>
                        <Link to={`/personas/${persona.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
