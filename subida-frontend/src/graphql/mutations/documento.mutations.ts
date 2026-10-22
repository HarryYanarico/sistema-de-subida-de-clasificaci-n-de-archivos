import { gql } from '@apollo/client'

export const ASIGNAR_DOCUMENTO = gql`
  mutation AsignarDocumento($documentoId: Int!, $tipoDocumentoId: Int!) {
    asignarDocumento(documentoId: $documentoId, tipoDocumentoId: $tipoDocumentoId) {
      documento {
        id
        estado
        tipoDocumento {
          id
          nombre
        }
      }
      success
      message
    }
  }
`

export const CLASIFICAR_DOCUMENTO = gql`
  mutation ClasificarDocumento($documentoId: Int!) {
    clasificarDocumento(documentoId: $documentoId) {
      documento {
        id
        estado
        tipoDocumento {
          id
          nombre
        }
      }
      success
      message
    }
  }
`

export const RECLASIFICAR_DOCUMENTO = gql`
  mutation ReclasificarDocumento($documentoId: Int!, $tipoDocumentoId: Int!) {
    reclasificarDocumento(
      documentoId: $documentoId
      tipoDocumentoId: $tipoDocumentoId
    ) {
      documento {
        id
        estado
        score
        tipoDocumento {
          id
          nombre
        }
        historialClasificacion
      }
      success
      message
    }
  }
`

export const CREAR_Y_ASIGNAR_TIPO = gql`
  mutation CrearYAsignarTipo(
    $documentoId: Int!
    $nombre: String!
    $palabrasClave: String!
  ) {
    crearYAsignarTipo(
      documentoId: $documentoId
      nombre: $nombre
      palabrasClave: $palabrasClave
    ) {
      documento {
        id
        estado
        tipoDocumento {
          id
          nombre
        }
      }
      tipoDocumento {
        id
        nombre
        slug
        palabrasClave
      }
      success
      message
    }
  }
`

export const CREAR_DOCUMENTO_CON_PAGINAS = gql`
  mutation CrearDocumentoConPaginas(
    $loteId: ID!
    $paginaIds: [ID!]!
    $tipoDocumentoId: Int
    $nombreFinal: String
    $esDobleCara: Boolean
  ) {
    crearDocumentoConPaginas(
      loteId: $loteId
      paginaIds: $paginaIds
      tipoDocumentoId: $tipoDocumentoId
      nombreFinal: $nombreFinal
      esDobleCara: $esDobleCara
    ) {
      documento {
        id
        nombreFinal
        esDobleCara
        totalPaginas
        estado
        paginas {
          id
          nroPaginaEnPdf
          textoOcr
          descartable
        }
      }
      advertencia
      success
      message
    }
  }
`

export const AGREGAR_PAGINA_A_DOCUMENTO = gql`
  mutation AgregarPaginaADocumento($documentoId: ID!, $paginaId: ID!) {
    agregarPaginaADocumento(documentoId: $documentoId, paginaId: $paginaId) {
      documento {
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
      advertencia
      success
      message
    }
  }
`

export const QUITAR_PAGINA_DE_DOCUMENTO = gql`
  mutation QuitarPaginaDeDocumento($documentoId: ID!, $paginaId: ID!) {
    quitarPaginaDeDocumento(documentoId: $documentoId, paginaId: $paginaId) {
      documento {
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
      success
      message
    }
  }
`

export const ASIGNAR_PAGINA_A_TIPO = gql`
  mutation AsignarPaginaATipo($paginaId: ID!, $tipoDocumentoId: ID!) {
    asignarPaginaATipo(paginaId: $paginaId, tipoDocumentoId: $tipoDocumentoId) {
      id
      estado
      descartable
    }
  }
`

export const CREAR_TIPO_Y_ASIGNAR = gql`
  mutation CrearTipoYAsignar($paginaId: ID!, $nombre: String!) {
    crearTipoYAsignar(paginaId: $paginaId, nombre: $nombre) {
      id
      estado
      descartable
    }
  }
`

export const DESCARTAR_PAGINA = gql`
  mutation DescartarPagina($paginaId: ID!) {
    descartarPagina(paginaId: $paginaId) {
      id
      estado
      descartable
    }
  }
`


