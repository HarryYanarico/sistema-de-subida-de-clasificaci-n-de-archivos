import { gql } from '@apollo/client'

export const CONFIRMAR_AGRUPAMIENTO = gql`
  mutation ConfirmarAgrupamiento($loteId: ID!, $asignaciones: [AsignacionGrupoInput!]!) {
    confirmarAgrupamiento(loteId: $loteId, asignaciones: $asignaciones) {
      id
      estado
      nombreArchivoOriginal
      totalPaginas
      totalGrupos
      documentos {
        id
        nombreFinal
        esDobleCara
        totalPaginas
        estado
        tipoDocumento {
          id
          nombre
          color
        }
        paginas {
          id
          nroPaginaEnPdf
        }
      }
    }
  }
`
export const GUARDAR_BORRADOR_AGRUPAMIENTO = gql`
  mutation GuardarBorradorAgrupamiento($loteId: ID!, $borrador: JSON!) {
    guardarBorradorAgrupamiento(loteId: $loteId, borrador: $borrador) {
      success
      message
    }
  }
`

export const ASIGNAR_PAGINA_A_DOCUMENTO_INCOMPLETO = gql`
  mutation AsignarPaginaADocumentoIncompleto($documentoId: ID!, $paginaId: ID!, $slot: String) {
    asignarPaginaADocumentoIncompleto(documentoId: $documentoId, paginaId: $paginaId, slot: $slot) {
      success
      message
      documento {
        id
        estado
        paginas {
          id
          nroPaginaEnPdf
        }
      }
    }
  }
`

export const MARCAR_DOCUMENTO_COMPLETO = gql`
  mutation MarcarDocumentoCompleto($documentoId: ID!) {
    marcarDocumentoCompleto(documentoId: $documentoId) {
      success
      message
      documento {
        id
        estado
      }
    }
  }
`

export const DESCARTAR_DOCUMENTO_INCOMPLETO = gql`
  mutation DescartarDocumentoIncompleto($documentoId: ID!) {
    descartarDocumentoIncompleto(documentoId: $documentoId) {
      success
      message
      documento {
        id
        estado
      }
    }
  }
`
