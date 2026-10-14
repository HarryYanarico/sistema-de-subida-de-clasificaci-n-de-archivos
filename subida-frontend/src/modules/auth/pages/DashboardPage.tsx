import { useQuery } from '@apollo/client'
import { Link } from 'react-router-dom'
import { GET_DASHBOARD_METRICAS } from '@graphql/queries/dashboard.queries'
import { ROUTES } from '@config/routes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  UploadCloud,
  AlertTriangle,
  HelpCircle,
  Copy,
  Settings,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FolderOpen,
  RefreshCw,
} from 'lucide-react'
import { MetricCard } from '../components/MetricCard/MetricCard'
import { OperationalBreakdown } from '../components/OperationalBreakdown/OperationalBreakdown'
import { RecentDocumentsTable } from '../components/RecentDocumentsTable/RecentDocumentsTable'
import { EstadisticasDigitalizacion, DocumentoRecienteGraphQL } from '@app-types/index'

export function DashboardPage() {
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD_METRICAS, {
    variables: { recientesLimit: 8 },
    fetchPolicy: 'cache-and-network',
  })

  const stats: EstadisticasDigitalizacion = data?.estadisticasDigitalizacion || {
    totalDocumentos: 0,
    totalClasificados: 0,
    totalVerificados: 0,
    totalDudosos: 0,
    totalSinClasificar: 0,
    totalDuplicados: 0,
    totalPendientes: 0,
    tasaEfectividad: 0,
    sugerenciasPendientes: 0,
  }

  const recientes: DocumentoRecienteGraphQL[] = data?.documentosRecientes || []
  const enRevision = (stats.totalDudosos || 0) + (stats.totalSinClasificar || 0)

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Panel de Digitalización y Clasificación
          </h1>
          <p className="text-muted-foreground mt-1">
            Supervisión en tiempo real de folios digitalizados, efectividad del clasificador y colas de revisión.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Link to={ROUTES.DOCUMENTOS.SUBIR}>
            <Button className="gap-2 shadow-sm">
              <UploadCloud className="h-4 w-4" />
              Subir y Digitalizar PDFs
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/15 text-destructive border border-destructive/20 text-sm">
          Error al cargar estadísticas: {error.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Folios */}
        <MetricCard
          title="Total Folios Procesados"
          value={stats.totalDocumentos}
          subtitle="Páginas procesadas y resguardadas"
          icon={FileText}
          iconColorClass="bg-primary/10 text-primary"
        />

        {/* Tasa Efectividad */}
        <MetricCard
          title="Efectividad del Clasificador"
          value={`${stats.tasaEfectividad}%`}
          subtitle={`${stats.totalClasificados + stats.totalVerificados} exitosos`}
          icon={TrendingUp}
          iconColorClass="bg-green-500/10 text-green-600"
          progressValue={stats.tasaEfectividad}
        />

        {/* En Revisión Humana */}
        <MetricCard
          title="En Revisión Humana"
          value={enRevision}
          subtitle="Requieren validación o confirmación"
          icon={AlertTriangle}
          iconColorClass="bg-amber-500/10 text-amber-600"
          action={
            <Badge variant="warning" className="text-xs">
              {stats.totalDudosos} dud. / {stats.totalSinClasificar} s/c
            </Badge>
          }
        />

        {/* Sugerencias de Reglas */}
        <MetricCard
          title="Palabras Clave Sugeridas"
          value={stats.sugerenciasPendientes}
          subtitle="Listas para auto-entrenar el clasificador"
          icon={Sparkles}
          iconColorClass="bg-purple-500/10 text-purple-600"
          action={
            <Link to={ROUTES.CONFIGURACION.TIPOS_DOCUMENTO}>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1">
                Gestionar <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          }
        />
      </div>

      {/* Resumen Operativo y Accesos Rápidos */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Desglose de Estado */}
        <OperationalBreakdown stats={stats} />

        {/* Colas de Acción Rápida */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Colas y Acciones Directas</CardTitle>
            <CardDescription>Accesos directos a las áreas operativas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to={ROUTES.REVISION.DUDOSAS} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-amber-500/50">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Revisar Dudosos
                </span>
                <Badge variant="warning">{stats.totalDudosos}</Badge>
              </Button>
            </Link>

            <Link to={ROUTES.REVISION.SIN_CLASIFICAR} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-orange-500/50">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-orange-500" />
                  Revisar Sin Clasificar
                </span>
                <Badge variant="outline" className="border-orange-300 text-orange-600">
                  {stats.totalSinClasificar}
                </Badge>
              </Button>
            </Link>

            <Link to={ROUTES.REVISION.DUPLICADOS} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-slate-500/50">
                <span className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-slate-500" />
                  Revisar Duplicados
                </span>
                <Badge variant="secondary">{stats.totalDuplicados}</Badge>
              </Button>
            </Link>

            <Link to={ROUTES.CONFIGURACION.TIPOS_DOCUMENTO} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-purple-500/50">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-purple-500" />
                  Entrenar Reglas y Tipos
                </span>
                {stats.sugerenciasPendientes > 0 && (
                  <Badge variant="default" className="bg-purple-600">
                    {stats.sugerenciasPendientes} nuevas
                  </Badge>
                )}
              </Button>
            </Link>

            <Link to={ROUTES.DOCUMENTOS.PENDIENTES} className="block">
              <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground">
                <FolderOpen className="h-4 w-4 mr-2" />
                Ver Vista Agrupada por Persona
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Folios Recientes */}
      <RecentDocumentsTable recientes={recientes} />
    </div>
  )
}

// Alias export para retrocompatibilidad
export const Dashboard = DashboardPage
