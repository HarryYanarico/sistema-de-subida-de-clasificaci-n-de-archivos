import { gql } from '@apollo/client';

export const GET_PERSONAS = gql`
  query GetPersonas($unidadId: Int!, $search: String, $page: Int, $limit: Int) {
    personas(unidadId: $unidadId, search: $search, page: $page, limit: $limit) {
      items {
        id
        codigo
        nombres
        apellidos
        ci
        email
        telefono
        totalDocumentos
        documentosClasificados
        porcentajeCompletado
        tieneDocumentosClasificados
        createdAt
      }
      total
      page
      totalPages
    }
  }
`;

export const GET_PERSONA = gql`
  query GetPersona($id: Int!) {
    persona(id: $id) {
      id
      codigo
      nombres
      apellidos
      ci
      email
      telefono
      createdAt
    }
  }
`;
