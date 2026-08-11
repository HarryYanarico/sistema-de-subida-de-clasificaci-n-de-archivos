import { gql } from '@apollo/client';

export const CREATE_TIPO_DOCUMENTO = gql`
  mutation CreateTipoDocumento(
    $unidadId: Int!
    $nombre: String!
    $palabrasClave: String!
  ) {
    createTipoDocumento(
      unidadId: $unidadId
      nombre: $nombre
      palabrasClave: $palabrasClave
    ) {
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
`;

export const UPDATE_TIPO_DOCUMENTO = gql`
  mutation UpdateTipoDocumento(
    $id: Int!
    $nombre: String
    $palabrasClave: String
    $activo: Boolean
  ) {
    updateTipoDocumento(
      id: $id
      nombre: $nombre
      palabrasClave: $palabrasClave
      activo: $activo
    ) {
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
        activo
      }
      success
      message
    }
  }
`;

export const DELETE_TIPO_DOCUMENTO = gql`
  mutation DeleteTipoDocumento($id: Int!) {
    deleteTipoDocumento(id: $id) {
      success
      message
    }
  }
`;

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
`;

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
`;

export const SUGERIR_CLASIFICACION_IA = gql`
  mutation SugerirClasificacionIA($documentoId: Int!) {
    sugerirClasificacionIa(documentoId: $documentoId) {
      tipoSugerido {
        id
        nombre
        slug
      }
      palabrasClaveSugeridas
      esNuevoTipo
      nombreSugerido
      rawResponse
      success
      message
    }
  }
`;

export const CREAR_Y_ASIGNAR_TIPO_IA = gql`
  mutation CrearYAsignarTipoIA(
    $documentoId: Int!
    $nombre: String!
    $palabrasClave: String!
  ) {
    crearYAsignarTipoIa(
      documentoId: $documentoId
      nombre: $nombre
      palabrasClave: $palabrasClave
    ) {
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
      }
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
`;
