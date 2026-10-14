import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_PERSONAS } from '@graphql/queries/persona.queries'
import { ROUTES } from '@config/routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search } from 'lucide-react'
import { PersonaTable } from '../components/PersonaTable/PersonaTable'
import { Persona } from '@app-types/index'

export function ListaPersonasPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 10

  const { data, loading } = useQuery(GET_PERSONAS, {
    variables: { search, page, limit },
  })

  const personas: Persona[] = data?.personas?.items || []
  const totalPages: number = data?.personas?.totalPages || 1
  const total: number = data?.personas?.total || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión y seguimiento de expedientes y casilleros por persona
          </p>
        </div>
        <Link to={ROUTES.PERSONAS.REGISTRAR}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Persona
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Personas ({total})</CardTitle>
          <div className="flex items-center gap-2 pt-2">
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
          <PersonaTable
            personas={personas}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// Alias export para retrocompatibilidad
export const ListaPersonas = ListaPersonasPage
