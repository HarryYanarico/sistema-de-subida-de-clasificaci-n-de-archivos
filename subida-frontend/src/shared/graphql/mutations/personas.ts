import { gql } from '@apollo/client';

export const CREATE_PERSONA = gql`
  mutation CreatePersona(
    $codigo: String!
    $nombres: String!
    $apellidos: String!
    $ci: String
    $email: String
    $telefono: String
  ) {
    createPersona(
      codigo: $codigo
      nombres: $nombres
      apellidos: $apellidos
      ci: $ci
      email: $email
      telefono: $telefono
    ) {
      persona {
        id
        codigo
        nombres
        apellidos
      }
      success
      message
    }
  }
`;

export const UPDATE_PERSONA = gql`
  mutation UpdatePersona(
    $id: Int!
    $codigo: String
    $nombres: String
    $apellidos: String
    $ci: String
    $email: String
    $telefono: String
  ) {
    updatePersona(
      id: $id
      codigo: $codigo
      nombres: $nombres
      apellidos: $apellidos
      ci: $ci
      email: $email
      telefono: $telefono
    ) {
      persona {
        id
        codigo
        nombres
        apellidos
      }
      success
      message
    }
  }
`;

export const DELETE_PERSONA = gql`
  mutation DeletePersona($id: Int!) {
    deletePersona(id: $id) {
      success
      message
    }
  }
`;
