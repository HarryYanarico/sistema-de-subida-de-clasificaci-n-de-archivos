import { gql } from '@apollo/client';

export const CREATE_TIPO_DOCUMENTO = gql`
  mutation CreateTipoDocumento(
    $nombre: String!
    $palabrasClave: String!
  ) {
    createTipoDocumento(
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
        keywordsMatcheadas
        historialClasificacion {
          fecha
          usuario
          estado_anterior
          tipo_anterior
          tipo_nuevo
          score_anterior
          keywords_anteriores
        }
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
