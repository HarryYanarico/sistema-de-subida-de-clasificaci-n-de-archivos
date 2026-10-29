import { gql } from '@apollo/client'

export const GET_LOTES = gql`
  query GetLotes($limit: Int, $offset: Int, $estado: String) {
    lotes(limit: $limit, offset: $offset, estado: $estado) {
      id
      estado
      nombreArchivoOriginal
      totalPaginas
      totalGrupos
      createdAt
    }
  }
`

export const GET_LOTE = gql`
  query GetLote($id: ID!) {
    lote(id: $id) {
      id
      estado
      nombreArchivoOriginal
      totalPaginas
      totalGrupos
      borradorAgrupamiento
      createdAt
      persona {
        id
        codigo
        nombres
        apellidos
      }
      parejasSugeridas {
        paginaAnversoId
        paginaReversoId
      }
      grupos {
        id
        loteId
        totalPaginas
        estado
        firmaConsolidada
        parejasSugeridas {
          paginaAnversoId
          paginaReversoId
        }
        tipoDocumentoSugerido {
          id
          nombre
          slug
          color
        }
        paginas {
          id
          pdfOrigen
          nroPaginaEnPdf
          textoOcr
          phash
          descartable
          estado
        }
        documentos {
          id
          esDobleCara
          paginas {
            id
            nroPaginaEnPdf
          }
        }
      }
      paginas {
        id
        pdfOrigen
        nroPaginaEnPdf
        textoOcr
        phash
        descartable
        estado
      }
      documentos {
        id
        nombreFinal
        esDobleCara
        totalPaginas
        estado
        paginas {
          id
          nroPaginaEnPdf
        }
      }
    }
  }
`

export const GET_LOTE_REVISION = gql`
  query GetLoteRevision($loteId: ID!) {
    loteRevision(loteId: $loteId) {
      lote {
        id
        estado
        nombreArchivoOriginal
        totalPaginas
        totalGrupos
        persona {
          id
          codigo
          nombres
          apellidos
        }
      }
      documentosIncompletos {
        id
        nombreFinal
        esDobleCara
        totalPaginas
        estado
        historialClasificacion
        tipoDocumento {
          id
          nombre
          color
        }
        paginas {
          id
          pdfOrigen
          nroPaginaEnPdf
          textoOcr
          estado
        }
      }
      paginasHuerfanas {
        id
        pdfOrigen
        nroPaginaEnPdf
        textoOcr
        phash
        estado
      }
    }
  }
`

export const GET_GRUPOS_LOTE = gql`
  query GetGruposLote($loteId: ID!) {
    grupos(loteId: $loteId) {
      id
      loteId
      totalPaginas
      estado
      firmaConsolidada
      tipoDocumentoSugerido {
        id
        nombre
        slug
        color
      }
    }
  }
`

export const GET_PAGINAS = gql`
  query GetPaginas($loteId: ID, $grupoId: ID, $limit: Int, $offset: Int) {
    paginas(loteId: $loteId, grupoId: $grupoId, limit: $limit, offset: $offset) {
      id
      loteId
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

export const GET_PAGINAS_DUPLICADAS = gql`
  query GetPaginasDuplicadas($limit: Int, $offset: Int) {
    paginasDuplicadas(limit: $limit, offset: $offset) {
      id
      loteId
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
