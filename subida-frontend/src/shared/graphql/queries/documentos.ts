import { gql } from '@apollo/client';

export const GET_TIPOS_DOCUMENTO = gql`
  query GetTiposDocumento($unidadId: Int!, $activo: Boolean) {
    tiposDocumento(unidadId: $unidadId, activo: $activo) {
      id
      nombre
      slug
      palabrasClave
      activo
    }
  }
`;

export const GET_DOCUMENTOS_PERSONA = gql`
  query GetDocumentosPersona($personaId: Int!) {
    documentosPersona(personaId: $personaId) {
      personaId
      documentos {
        id
        tipoDocumento {
          id
          nombre
          slug
        }
        paginaNumero
        textoExtraido
        estado
        createdAt
      }
      totalPaginas
      clasificados
      pendientes
    }
  }
`;

export const GET_DOCUMENTOS_PENDIENTES = gql`
  query GetDocumentosPendientes($unidadId: Int!) {
    documentosPendientes(unidadId: $unidadId) {
      id
      persona {
        id
        codigo
        nombres
        apellidos
      }
      paginaNumero
      textoExtraido
      estado
    }
  }
`;
