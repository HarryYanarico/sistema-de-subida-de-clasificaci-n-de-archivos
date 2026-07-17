import { gql } from '@apollo/client';

export const CREATE_TIPO_DOCUMENTO = gql`
  mutation CreateTipoDocumento(
    $nombre: String!
    $palabrasClave: String!
    $requiere: String
    $excluye: String
    $scoreMinimo: Int
    $esObligatorio: Boolean
    $orden: Int
  ) {
    createTipoDocumento(
      nombre: $nombre
      palabrasClave: $palabrasClave
      requiere: $requiere
      excluye: $excluye
      scoreMinimo: $scoreMinimo
      esObligatorio: $esObligatorio
      orden: $orden
    ) {
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
        requiere
        excluye
        scoreMinimo
        esObligatorio
        orden
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
    $requiere: String
    $excluye: String
    $scoreMinimo: Int
    $esObligatorio: Boolean
    $orden: Int
    $activo: Boolean
  ) {
    updateTipoDocumento(
      id: $id
      nombre: $nombre
      palabrasClave: $palabrasClave
      requiere: $requiere
      excluye: $excluye
      scoreMinimo: $scoreMinimo
      esObligatorio: $esObligatorio
      orden: $orden
      activo: $activo
    ) {
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
        requiere
        excluye
        scoreMinimo
        esObligatorio
        orden
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
