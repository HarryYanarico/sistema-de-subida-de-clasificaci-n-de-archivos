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
