"""Base comun para las pruebas de la API GraphQL.

Ejecuta el schema strawberry contra la base de pruebas de Django (TestCase), sin
pasar por la vista HTTP: lo que se prueba es el contrato (payloads, nombres de
campo, valores de `estado`), no el transporte.

Los helpers reciben los argumentos ya en camelCase (como en el frontend) e
infieren la declaracion de variable a partir del valor de Python.
"""

from django.test import TestCase

from config.schema import schema

TIPOS = {bool: 'Boolean', int: 'Int', str: 'String'}


def _declarar(variables):
    """`{'search': 'x'}` -> '$search: String!' (None queda como null)."""
    partes = []
    for nombre, valor in variables.items():
        if valor is None:
            raise ValueError(
                'No se puede inferir el tipo de {0!r}: escribe la consulta a mano '
                'con self.ejecutar()'.format(nombre)
            )
        partes.append('${0}: {1}!'.format(nombre, TIPOS[type(valor)]))
    return ', '.join(partes)


def _invocacion(raiz, variables):
    if not variables:
        return raiz
    argumentos = ', '.join('{0}: ${0}'.format(k) for k in variables)
    return '{0}({1})'.format(raiz, argumentos)


class GraphQLTestCase(TestCase):

    def ejecutar(self, operacion, variables=None, context_value=None):
        resultado = schema.execute_sync(operacion, variable_values=variables or {}, context_value=context_value)
        self.assertIsNone(
            resultado.errors,
            msg='Errores de GraphQL: {0}'.format(resultado.errors),
        )
        return resultado.data

    def consulta(self, raiz, *campos, **variables):
        """`consulta('personas', 'total', search='x')` -> data['personas']."""
        context_value = variables.pop('context_value', None)
        declaracion = _declarar(variables)
        firma = '({0})'.format(declaracion) if declaracion else ''
        cuerpo = ' '.join(campos) if campos else '__typename'
        return self.ejecutar(
            'query{0} {{ {1} {{ {2} }} }}'.format(firma, _invocacion(raiz, variables), cuerpo),
            variables,
            context_value=context_value,
        )[raiz]

    def mutacion(self, raiz, *campos, **variables):
        """`mutacion('createPersona', 'success', codigo='1', ...)`."""
        context_value = variables.pop('context_value', None)
        declaracion = _declarar(variables)
        firma = '({0})'.format(declaracion) if declaracion else ''
        cuerpo = ' '.join(campos) if campos else '__typename'
        return self.ejecutar(
            'mutation{0} {{ {1} {{ {2} }} }}'.format(firma, _invocacion(raiz, variables), cuerpo),
            variables,
            context_value=context_value,
        )[raiz]