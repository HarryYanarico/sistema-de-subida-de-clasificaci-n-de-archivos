import { gql } from '@apollo/client'

export const CREATE_TIPO_DOCUMENTO = gql`
  mutation CreateTipoDocumento(
    $nombre: String!
    $palabrasClave: String!
    $keywordsObligatorias: [String!]
  ) {
    createTipoDocumento(
      nombre: $nombre
      palabrasClave: $palabrasClave
      keywordsObligatorias: $keywordsObligatorias
    ) {
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
        keywordsObligatorias
        activo
      }
      success
      message
    }
  }
`

export const UPDATE_TIPO_DOCUMENTO = gql`
  mutation UpdateTipoDocumento(
    $id: Int!
    $nombre: String
    $palabrasClave: String
    $keywordsObligatorias: [String!]
    $activo: Boolean
  ) {
    updateTipoDocumento(
      id: $id
      nombre: $nombre
      palabrasClave: $palabrasClave
      keywordsObligatorias: $keywordsObligatorias
      activo: $activo
    ) {
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
        keywordsObligatorias
        activo
      }
      success
      message
    }
  }
`

export const DELETE_TIPO_DOCUMENTO = gql`
  mutation DeleteTipoDocumento($id: Int!) {
    deleteTipoDocumento(id: $id) {
      success
      message
    }
  }
`

export const ACEPTAR_SUGERENCIA = gql`
  mutation AceptarSugerencia($id: Int!, $peso: Int!) {
    aceptarSugerencia(id: $id, peso: $peso) {
      success
      message
      tipoDocumento {
        id
        nombre
        palabrasClave
      }
      sugerencia {
        id
        palabra
        aceptada
      }
    }
  }
`

export const DESCARTAR_SUGERENCIA = gql`
  mutation DescartarSugerencia($id: Int!) {
    descartarSugerencia(id: $id) {
      success
      message
      sugerencia {
        id
        palabra
        aceptada
      }
    }
  }
`

export const GENERAR_SUGERENCIAS_KEYWORDS = gql`
  mutation GenerarSugerenciasKeywords($minDocs: Int!, $top: Int!, $limpiar: Boolean!) {
    generarSugerenciasKeywords(minDocs: $minDocs, top: $top, limpiar: $limpiar) {
      success
      message
      totalGeneradas
      totalVerificados
    }
  }
`

export const GUARDAR_PALABRAS_ADMIN = gql`
  mutation GuardarPalabrasAdmin(
    $tipoId: ID!
    $palabrasSeleccionadas: [String!]!
    $palabrasObligatorias: [String!]!
  ) {
    guardarPalabrasAdmin(
      tipoId: $tipoId
      palabrasSeleccionadas: $palabrasSeleccionadas
      palabrasObligatorias: $palabrasObligatorias
    ) {
      id
      nombre
      palabrasClave
      keywordsObligatorias
    }
  }
`

