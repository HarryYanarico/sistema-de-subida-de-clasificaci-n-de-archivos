import { gql } from '@apollo/client'

export const ASIGNAR_DOCUMENTO = gql`
  mutation AsignarDocumento($documentoId: Int!, $tipoDocumentoId: Int!) {
    asignarDocumento(documentoId: $documentoId, tipoDocumentoId: $tipoDocumentoId) {
      documento {
        id
        estado
        tipoDocumento {
          id
          nombre
        }
      }
      success
      message
    }
  }
`

export const CLASIFICAR_DOCUMENTO = gql`
  mutation ClasificarDocumento($documentoId: Int!) {
    clasificarDocumento(documentoId: $documentoId) {
      documento {
        id
        estado
        tipoDocumento {
          id
          nombre
        }
      }
      success
      message
    }
  }
`

export const RECLASIFICAR_DOCUMENTO = gql`
  mutation ReclasificarDocumento($documentoId: Int!, $tipoDocumentoId: Int!) {
    reclasificarDocumento(
      documentoId: $documentoId
      tipoDocumentoId: $tipoDocumentoId
    ) {
      documento {
        id
        estado
        score
        tipoDocumento {
          id
          nombre
        }
        historialClasificacion
      }
      success
      message
    }
  }
`

export const CREAR_Y_ASIGNAR_TIPO = gql`
  mutation CrearYAsignarTipo(
    $documentoId: Int!
    $nombre: String!
    $palabrasClave: String!
  ) {
    crearYAsignarTipo(
      documentoId: $documentoId
      nombre: $nombre
      palabrasClave: $palabrasClave
    ) {
      documento {
        id
        estado
        tipoDocumento {
          id
          nombre
        }
      }
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
      }
      success
      message
    }
  }
`
