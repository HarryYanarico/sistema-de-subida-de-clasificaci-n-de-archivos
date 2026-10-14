import { gql } from '@apollo/client'

export const GET_DASHBOARD_METRICAS = gql`
  query GetDashboardMetricas($recientesLimit: Int) {
    estadisticasDigitalizacion {
      totalDocumentos
      totalClasificados
      totalVerificados
      totalDudosos
      totalSinClasificar
      totalDuplicados
      totalPendientes
      tasaEfectividad
      sugerenciasPendientes
    }
    documentosRecientes(limit: $recientesLimit) {
      id
      paginaNumero
      estado
      score
      createdAt
      persona {
        id
        codigo
        nombres
        apellidos
      }
      tipoDocumento {
        id
        nombre
      }
    }
  }
`
