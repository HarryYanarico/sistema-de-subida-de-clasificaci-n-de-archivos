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
