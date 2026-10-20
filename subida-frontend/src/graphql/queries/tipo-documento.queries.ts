import { gql } from '@apollo/client'

export const GET_TIPOS_DOCUMENTO = gql`
  query GetTiposDocumento($activo: Boolean) {
    tiposDocumento(activo: $activo) {
      id
      nombre
      slug
      palabrasClave
      keywordsObligatorias
      activo
      createdAt
    }
  }
`

export const GET_TIPO_DOCUMENTO = gql`
  query GetTipoDocumento($id: Int!) {
    tipoDocumento(id: $id) {
      id
      nombre
      slug
      palabrasClave
      keywordsObligatorias
      activo
      createdAt
    }
  }
`

export const GET_SUGERENCIAS_KEYWORD = gql`
  query GetSugerenciasKeyword($tipoDocumentoId: Int!) {
    sugerenciasKeyword(tipoDocumentoId: $tipoDocumentoId) {
      id
      palabra
      ratio
      frecuencia
      aceptada
      createdAt
    }
  }
`

export const GET_SUGERENCIAS_ADMIN = gql`
  query GetSugerenciasAdmin($tipoId: ID!) {
    sugerenciasAdmin(tipoId: $tipoId) {
      suficientesEjemplos
      totalEjemplos
      mensaje
      siempre {
        palabra
        esObligatoria
        seleccionada
      }
      suelen {
        palabra
        esObligatoria
        seleccionada
      }
      yaNoAparecen {
        palabra
        esObligatoria
        seleccionada
      }
    }
  }
`

