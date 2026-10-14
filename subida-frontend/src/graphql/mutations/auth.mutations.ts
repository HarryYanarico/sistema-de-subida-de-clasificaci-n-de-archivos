import { gql } from '@apollo/client'

export const LOGIN_USER = gql`
  mutation LoginUser($username: String!, $password: String!) {
    loginUser(username: $username, password: $password) {
      token
      user {
        id
        username
        email
        firstName
        lastName
        role
        telefono
      }
      success
      message
    }
  }
`
