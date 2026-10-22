import { useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { Link } from 'react-router-dom'
import { GET_DASHBOARD_METRICAS } from '@graphql/queries/dashboard.queries'
import { GET_PAGINAS_SIN_AGRUPAR } from '@graphql/queries/revision.queries'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'
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
  Layers,
} from 'lucide-react'
import { MetricCard } from '../components/MetricCard/MetricCard'
import { OperationalBreakdown } from '../components/OperationalBreakdown/OperationalBreakdown'
import { RecentDocumentsTable } from '../components/RecentDocumentsTable/RecentDocumentsTable'
import { EstadisticasDigitalizacion, DocumentoRecienteGraphQL } from '@app-types/index'

export function DashboardPage() {
  const { user } = useAuth()

  // Queries con network-only para garantizar frescura al volver de las colas de revisión
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD_METRICAS, {
    variables: { recientesLimit: 8 },
    fetchPolicy: 'network-only',
  })

  const { data: sinAgruparData, refetch: refetchSinAgrupar } = useQuery(GET_PAGINAS_SIN_AGRUPAR, {
    variables: { limit: 100, offset: 0 },
    fetchPolicy: 'network-only',
  })

  // Refrescar automáticamente al montar
  useEffect(() => {
    refetch()
    refetchSinAgrupar()
  }, [refetch, refetchSinAgrupar])

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

  const totalSinAgrupar = sinAgruparData?.paginasSinAgrupar?.length || 0
  const recientes: DocumentoRecienteGraphQL[] = data?.documentosRecientes || []
  const enRevision = (stats.totalDudosos || 0) + (stats.totalSinClasificar || 0) + totalSinAgrupar

  const handleRecargar = () => {
    refetch()
    refetchSinAgrupar()
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Saludo y Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
            <span>
              Bienvenido, <strong className="text-foreground">{user?.username || 'Operador'}</strong>
            </span>
            {user?.unidad && (
              <>
                <span>·</span>
                <Badge variant="outline" className="text-[11px] font-mono">
                  Unidad: {user.unidad.nombre || user.unidad.codigo}
                </Badge>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Panel de Digitalización y Clasificación
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Supervisión en tiempo real de folios digitalizados, efectividad del clasificador y colas de revisión.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecargar}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          {/* Accesos directos a colas con pendientes */}
          {stats.totalDudosos > 0 && (
            <Link to={ROUTES.REVISION.DUDOSAS}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10">
                <AlertTriangle className="h-3.5 w-3.5" />
                Revisar dudosas ({stats.totalDudosos})
              </Button>
            </Link>
          )}

          {totalSinAgrupar > 0 && (
            <Link to={ROUTES.REVISION.SIN_AGRUPAR}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-blue-500/40 text-blue-600 hover:bg-blue-500/10">
                <Layers className="h-3.5 w-3.5" />
                Revisar sin agrupar ({totalSinAgrupar})
              </Button>
            </Link>
          )}

          <Link to={ROUTES.DOCUMENTOS.SUBIR}>
            <Button size="sm" className="gap-1.5 shadow-sm text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
              <UploadCloud className="h-4 w-4" />
              Subir documentos
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
              {stats.totalDudosos} dud. / {stats.totalSinClasificar} s/c / {totalSinAgrupar} s/a
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

      {/* Resumen Operativo y Accesos Rápidos a las 4 Colas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Desglose de Estado */}
        <OperationalBreakdown stats={stats} />

        {/* Colas de Acción Rápida (Las 4 colas requeridas) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Colas de Revisión Humana</CardTitle>
            <CardDescription>Accesos directos con contadores actualizados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {/* 1. Dudosos */}
            <Link to={ROUTES.REVISION.DUDOSAS} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-amber-500/50">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Documentos Dudosos
                </span>
                <Badge variant={stats.totalDudosos > 0 ? 'warning' : 'outline'}>
                  {stats.totalDudosos}
                </Badge>
              </Button>
            </Link>

            {/* 2. Sin Clasificar */}
            <Link to={ROUTES.REVISION.SIN_CLASIFICAR} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-orange-500/50">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-orange-500" />
                  Documentos Sin Clasificar
                </span>
                <Badge
                  variant="outline"
                  className={stats.totalSinClasificar > 0 ? 'border-orange-300 text-orange-600' : ''}
                >
                  {stats.totalSinClasificar}
                </Badge>
              </Button>
            </Link>

            {/* 3. Páginas Sin Agrupar (Residual) */}
            <Link to={ROUTES.REVISION.SIN_AGRUPAR} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-blue-500/50">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  Páginas Sin Agrupar
                </span>
                <Badge
                  variant="outline"
                  className={totalSinAgrupar > 0 ? 'border-blue-400 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20' : ''}
                >
                  {totalSinAgrupar}
                </Badge>
              </Button>
            </Link>

            {/* 4. Duplicados */}
            <Link to={ROUTES.REVISION.DUPLICADOS} className="block">
              <Button variant="outline" className="w-full justify-between hover:border-slate-500/50">
                <span className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-slate-500" />
                  Documentos Duplicados
                </span>
                <Badge variant="secondary">{stats.totalDuplicados}</Badge>
              </Button>
            </Link>

            {/* Accesos rápidos adicionales */}
            <div className="pt-2 border-t flex flex-col gap-1">
              <Link to={ROUTES.DOCUMENTOS.PENDIENTES} className="block">
                <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground h-8">
                  <FolderOpen className="h-3.5 w-3.5 mr-2" />
                  Ver Vista Agrupada por Persona
                </Button>
              </Link>
              <Link to={ROUTES.CONFIGURACION.TIPOS_DOCUMENTO} className="block">
                <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground h-8">
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Configurar Tipos de Documento
                </Button>
              </Link>
            </div>
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
