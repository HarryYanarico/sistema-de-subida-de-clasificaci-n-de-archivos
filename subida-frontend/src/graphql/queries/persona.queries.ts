import { gql } from '@apollo/client'
import { FRAGMENT_PERSONA_BASE } from '../fragments/persona.fragments'

export const GET_PERSONAS = gql`
  query GetPersonas($search: String, $page: Int, $limit: Int, $orderBy: String) {
    personas(search: $search, page: $page, limit: $limit, orderBy: $orderBy) {
      items {
        ...PersonaBase
        totalDocumentos
        documentosClasificados
        porcentajeCompletado
        tieneDocumentosClasificados
      }
      total
      page
      totalPages
    }
  }
  ${FRAGMENT_PERSONA_BASE}
`

export const GET_PERSONA = gql`
  query GetPersona($id: Int!) {
    persona(id: $id) {
      ...PersonaBase
    }
  }
  ${FRAGMENT_PERSONA_BASE}
`
