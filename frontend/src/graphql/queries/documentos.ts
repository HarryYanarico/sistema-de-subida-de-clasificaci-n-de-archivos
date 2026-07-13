import { gql } from '@apollo/client';

export const GET_TIPOS_DOCUMENTO = gql`
  query GetTiposDocumento($activo: Boolean) {
    tiposDocumento(activo: $activo) {
      id
      nombre
      slug
      palabrasClave
      esObligatorio
      orden
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
          esObligatorio
        }
        archivoPagina
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
  query GetDocumentosPendientes {
    documentosPendientes {
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
