import { gql } from '@apollo/client'

export const FRAGMENT_DOCUMENTO_BASE = gql`
  fragment DocumentoBase on DocumentoType {
    id
    paginaNumero
    textoExtraido
    estado
    score
    keywordsMatcheadas
    createdAt
  }
`

export const FRAGMENT_DOCUMENTO_REVISION = gql`
  fragment DocumentoRevision on DocumentoType {
    id
    paginaNumero
    textoExtraido
    estado
    score
    keywordsMatcheadas
    historialClasificacion
    phash
    duplicadoDe
    persona {
      id
      codigo
      nombres
      apellidos
    }
    tipoDocumento {
      id
      nombre
      slug
    }
  }
`
