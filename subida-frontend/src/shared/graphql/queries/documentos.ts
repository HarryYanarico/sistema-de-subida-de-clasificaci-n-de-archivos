import { gql } from '@apollo/client';

export const GET_TIPOS_DOCUMENTO = gql`
  query GetTiposDocumento($activo: Boolean) {
    tiposDocumento(activo: $activo) {
      id
      nombre
      slug
      palabrasClave
      keywordsObligatorias
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
        score
        keywordsMatcheadas
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
      score
      keywordsMatcheadas
    }
  }
`;

// Campos que una tarjeta de revision necesita. Se comparten las tres colas
// para que el backend y el frontend keep en el mismo contrato.
const CAMPOS_REVISION = `
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
  score
  keywordsMatcheadas
  historialClasificacion
  phash
  duplicadoDe
  tipoDocumento {
    id
    nombre
  }
`;

export const GET_DOCUMENTOS_DUDOSOS = gql`
  query GetDocumentosDudosos($limit: Int, $offset: Int) {
    documentosDudosos(limit: $limit, offset: $offset) {
      ${CAMPOS_REVISION}
    }
  }
`;

export const GET_DOCUMENTOS_SIN_CLASIFICAR = gql`
  query GetDocumentosSinClasificar($limit: Int, $offset: Int) {
    documentosSinClasificar(limit: $limit, offset: $offset) {
      ${CAMPOS_REVISION}
    }
  }
`;

export const GET_DOCUMENTOS_DUPLICADOS = gql`
  query GetDocumentosDuplicados($limit: Int, $offset: Int) {
    documentosDuplicados(limit: $limit, offset: $offset) {
      ${CAMPOS_REVISION}
    }
  }
`;
