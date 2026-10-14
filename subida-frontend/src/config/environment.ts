/**
 * Configuración central de variables de entorno de la aplicación.
 * Provee valores tipados y fallbacks automáticos según el modo de ejecución.
 */

export interface EnvironmentConfig {
  readonly apiUrl: string
  readonly graphqlUrl: string
  readonly apiPrefix: string
  readonly appTitle: string
  readonly isDevelopment: boolean
  readonly isProduction: boolean
  readonly isTest: boolean
}

// Detectar hostnames internos de red Docker que el navegador del cliente no puede resolver directamente
const isDockerInternalHost = (url: string): boolean => {
  if (!url) return false
  return (
    url.includes('://backend') ||
    url.includes('://host.docker.internal') ||
    url.includes('backend:8000')
  )
}

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const rawGraphqlUrl = (import.meta.env.VITE_GRAPHQL_URL || '').trim()
const rawGraphqlPath = (import.meta.env.VITE_GRAPHQL_PATH || '/graphql/').trim()
const rawApiPrefix = (import.meta.env.VITE_API_PREFIX || '/api').trim()

// Si la URL apunta a un contenedor interno de Docker (ej. http://backend:8000), el navegador del host
// NO puede resolverlo por DNS. En ese caso usamos string vacío para que el frontend use rutas relativas
// (/graphql/, /api/...) y el proxy de Vite o Nginx enrute la petición sin problemas de red ni CORS.
const safeApiUrl = isDockerInternalHost(rawApiUrl) ? '' : rawApiUrl

// Calcular GraphQL URL: respetar URL segura explícita o usar ruta relativa para el proxy
const graphqlUrl =
  rawGraphqlUrl && !isDockerInternalHost(rawGraphqlUrl)
    ? rawGraphqlUrl
    : safeApiUrl
      ? `${safeApiUrl.replace(/\/$/, '')}${rawGraphqlPath.startsWith('/') ? '' : '/'}${rawGraphqlPath}`
      : rawGraphqlPath.startsWith('/')
        ? rawGraphqlPath
        : `/${rawGraphqlPath}`

const apiUrl = safeApiUrl

export const env: EnvironmentConfig = {
  apiUrl,
  graphqlUrl,
  apiPrefix: rawApiPrefix,
  appTitle: import.meta.env.VITE_APP_TITLE || 'Sistema de Digitalización de Archivos',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  isTest: import.meta.env.MODE === 'test',
}

