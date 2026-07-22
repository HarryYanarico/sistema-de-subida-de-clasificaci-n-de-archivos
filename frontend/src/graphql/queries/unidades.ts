import { gql } from '@apollo/client';

export const GET_UNIDADES = gql`
  query GetUnidades($activo: Boolean) {
    unidades(activo: $activo) {
      id
      nombre
      slug
      descripcion
      activo
    }
  }
`;
