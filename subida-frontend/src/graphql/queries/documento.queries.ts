import { gql } from '@apollo/client'
import { FRAGMENT_DOCUMENTO_BASE } from '../fragments/documento.fragments'

export const GET_DOCUMENTOS_PERSONA = gql`
  query GetDocumentosPersona($personaId: Int!) {
    documentosPersona(personaId: $personaId) {
      personaId
      documentos {
        ...DocumentoBase
        tipoDocumento {
          id
          nombre
          slug
        }
      }
      totalPaginas
      clasificados
      pendientes
    }
  }
  ${FRAGMENT_DOCUMENTO_BASE}
`

export const GET_DOCUMENTOS_PENDIENTES = gql`
  query GetDocumentosPendientes($limit: Int, $offset: Int) {
    documentosPendientes(limit: $limit, offset: $offset) {
      id
      paginaNumero
      textoExtraido
      estado
      score
      keywordsMatcheadas
      persona {
        id
        codigo
        nombres
        apellidos
      }
    }
  }
`
