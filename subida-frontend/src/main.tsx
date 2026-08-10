import React from 'react'
import ReactDOM from 'react-dom/client'
import { ApolloProvider } from '@apollo/client'
import { BrowserRouter } from 'react-router-dom'
import { client } from './shared/graphql/client'
import { UnidadProvider } from './shared/contexts/UnidadContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <UnidadProvider>
          <App />
        </UnidadProvider>
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>,
)
