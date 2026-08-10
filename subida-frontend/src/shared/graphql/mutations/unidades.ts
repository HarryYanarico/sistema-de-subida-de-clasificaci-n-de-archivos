import { gql } from '@apollo/client';

export const CREATE_UNIDAD = gql`
  mutation CreateUnidad($nombre: String!, $descripcion: String) {
    createUnidad(nombre: $nombre, descripcion: $descripcion) {
      unidad {
        id
        nombre
        slug
        descripcion
        activo
      }
      success
      message
    }
  }
`;

export const UPDATE_UNIDAD = gql`
  mutation UpdateUnidad($id: Int!, $nombre: String, $descripcion: String, $activo: Boolean) {
    updateUnidad(id: $id, nombre: $nombre, descripcion: $descripcion, activo: $activo) {
      unidad {
        id
        nombre
        slug
        descripcion
        activo
      }
      success
      message
    }
  }
`;

export const DELETE_UNIDAD = gql`
  mutation DeleteUnidad($id: Int!) {
    deleteUnidad(id: $id) {
      success
      message
    }
  }
`;
