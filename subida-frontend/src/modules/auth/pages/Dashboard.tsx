import { useQuery } from '@apollo/client'
import { GET_PERSONAS } from '@/graphql/queries/personas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, Clock, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useUnidad } from '@/contexts/UnidadContext'

export function Dashboard() {
  const { unidadActiva } = useUnidad()
  const { data } = useQuery(GET_PERSONAS, {
    variables: { unidadId: Number(unidadActiva?.id) || 0, page: 1, limit: 10 },
    skip: !unidadActiva,
  })

  const totalPersonas = data?.personas?.total || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link to="/documentos/subir">
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Subir Documentos
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Personas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPersonas}</div>
            <p className="text-xs text-muted-foreground">Personas registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos Procesados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Páginas clasificadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Sin clasificar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">100% clasificados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/personas/registrar" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Registrar Nueva Persona
              </Button>
            </Link>
            <Link to="/personas" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Ver Personas Registradas
              </Button>
            </Link>
            <Link to="/configuracion/tipos-documento" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Gestionar Tipos de Documento
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Personas Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.personas?.items?.length > 0 ? (
              <div className="space-y-2">
                {data.personas.items.slice(0, 5).map((persona: any) => (
                  <Link
                    key={persona.id}
                    to={`/personas/${persona.id}/casillero`}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent"
                  >
                    <div>
                      <p className="font-medium">{persona.nombres} {persona.apellidos}</p>
                      <p className="text-sm text-muted-foreground">Código: {persona.codigo}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {persona.porcentajeCompletado}%
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay personas registradas aún
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
