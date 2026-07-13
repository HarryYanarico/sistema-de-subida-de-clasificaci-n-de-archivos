import { gql } from '@apollo/client';

export const GET_PERSONAS = gql`
  query GetPersonas($search: String, $page: Int, $limit: Int) {
    personas(search: $search, page: $page, limit: $limit) {
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
