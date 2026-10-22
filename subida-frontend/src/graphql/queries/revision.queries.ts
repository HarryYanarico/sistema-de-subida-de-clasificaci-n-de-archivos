import { gql } from '@apollo/client'
import { FRAGMENT_DOCUMENTO_REVISION } from '../fragments/documento.fragments'

export const GET_DOCUMENTOS_DUDOSOS = gql`
  query GetDocumentosDudosos($limit: Int, $offset: Int) {
    documentosDudosos(limit: $limit, offset: $offset) {
      ...DocumentoRevision
    }
  }
  ${FRAGMENT_DOCUMENTO_REVISION}
`

export const GET_DOCUMENTOS_SIN_CLASIFICAR = gql`
  query GetDocumentosSinClasificar($limit: Int, $offset: Int) {
    documentosSinClasificar(limit: $limit, offset: $offset) {
      ...DocumentoRevision
    }
  }
  ${FRAGMENT_DOCUMENTO_REVISION}
`

export const GET_DOCUMENTOS_DUPLICADOS = gql`
  query GetDocumentosDuplicados($limit: Int, $offset: Int) {
    documentosDuplicados(limit: $limit, offset: $offset) {
      ...DocumentoRevision
    }
  }
  ${FRAGMENT_DOCUMENTO_REVISION}
`

export const GET_PAGINAS_SIN_AGRUPAR = gql`
  query GetPaginasSinAgrupar($limit: Int, $offset: Int) {
    paginasSinAgrupar(limit: $limit, offset: $offset) {
      id
      loteId
      loteNombre
      pdfOrigen
      nroPaginaEnPdf
      textoOcr
      phash
      descartable
      estado
      createdAt
    }
  }
`

