import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_PERSONAS } from '@/graphql/queries/personas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronRight } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

export function VistaPersonaLista() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 10
  const { unidadActiva } = useUnidad()

  const { data, loading } = useQuery(GET_PERSONAS, {
    variables: { unidadId: Number(unidadActiva?.id) || 0, search, page, limit },
    skip: !unidadActiva,
  })

  const personas = data?.personas?.items || []
  const totalPages = data?.personas?.totalPages || 1
  const total = data?.personas?.total || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Visor de Documentos</h1>
        <p className="text-muted-foreground">Seleccione una persona para ver sus documentos clasificados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personas ({total})</CardTitle>
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
                    <TableHead>Docs. Clasificados</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personas.map((persona: any) => (
                    <TableRow
                      key={persona.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vista-persona/${persona.id}`)}
                    >
                      <TableCell className="font-mono font-medium">{persona.codigo}</TableCell>
                      <TableCell>{persona.nombres}</TableCell>
                      <TableCell>{persona.apellidos}</TableCell>
                      <TableCell>{persona.ci || '-'}</TableCell>
                      <TableCell>
                        {persona.tieneDocumentosClasificados ? (
                          <Badge variant="default">Sí</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
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
