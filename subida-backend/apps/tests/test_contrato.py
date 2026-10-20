"""Prueba de contrato: el schema debe seguir exponiendo exactamente las
mismas operaciones y argumentos que consume el frontend Apollo.

Es el test que atrapa una regresion de la migracion Graphene -> Strawberry:
un nombre de campo o un tipo de argumento cambiado rompe el frontend en
tiempo de ejecucion, no en compilacion.
"""

from django.test import Client, SimpleTestCase, TestCase

from config.schema import schema

# (nombre del campo, [(argumento, tipo SDL sin el valor por defecto)])
# Sistema single-tenant: sin Unidad ni argumentos unidadId.
ESPERADO = {
    'Query': {
        'personas': [('limit', 'Int'), ('orderBy', 'String'), ('page', 'Int'), ('search', 'String')],
        'persona': [('id', 'Int!')],
        'tiposDocumento': [('activo', 'Boolean')],
        'tipoDocumento': [('id', 'Int!')],
        'documentosPersona': [('personaId', 'Int!')],
        'documentosPendientes': [
            ('limit', 'Int'), ('offset', 'Int!'),
        ],
        # Las tres colas de revision comparten forma: paginacion opcional.
        'documentosDudosos': [
            ('limit', 'Int'), ('offset', 'Int!'),
        ],
        'documentosSinClasificar': [
            ('limit', 'Int'), ('offset', 'Int!'),
        ],
        'documentosDuplicados': [
            ('limit', 'Int'), ('offset', 'Int!'),
        ],
        'sugerenciasKeyword': [('tipoDocumentoId', 'Int!')],
        'estadisticasDigitalizacion': [],
        'documentosRecientes': [('limit', 'Int')],
        'me': [],
        'lotes': [('estado', 'String'), ('limit', 'Int'), ('offset', 'Int')],
        'lote': [('id', 'ID!')],
        'grupos': [('loteId', 'ID!')],
        'paginas': [('grupoId', 'ID'), ('limit', 'Int'), ('loteId', 'ID'), ('offset', 'Int')],
        'paginasDuplicadas': [('limit', 'Int'), ('offset', 'Int')],
        'paginasSinAgrupar': [('limit', 'Int'), ('offset', 'Int')],
        'sugerenciasAdmin': [('tipoId', 'ID!')],
    },
    'Mutation': {
        'loginUser': [('password', 'String!'), ('username', 'String!')],
        'createUser': [
            ('firstName', 'String!'), ('lastName', 'String!'), ('email', 'String!'),
            ('password', 'String!'), ('telefono', 'String'), ('role', 'String'),
            ('username', 'String!'),
        ],
        'createPersona': [
            ('apellidos', 'String!'), ('ci', 'String'), ('codigo', 'String!'), ('email', 'String'),
            ('nombres', 'String!'), ('telefono', 'String'),
        ],
        'updatePersona': [
            ('apellidos', 'String'), ('ci', 'String'), ('codigo', 'String'), ('email', 'String'),
            ('id', 'Int!'), ('nombres', 'String'), ('telefono', 'String'),
        ],
        'deletePersona': [('id', 'Int!')],
        'createTipoDocumento': [
            ('keywordsObligatorias', '[String!]'), ('nombre', 'String!'),
            ('palabrasClave', 'String!'),
        ],
        'updateTipoDocumento': [
            ('activo', 'Boolean'), ('id', 'Int!'), ('keywordsObligatorias', '[String!]'),
            ('nombre', 'String'), ('palabrasClave', 'String'),
        ],
        'deleteTipoDocumento': [('id', 'Int!')],
        'asignarDocumento': [('documentoId', 'Int!'), ('tipoDocumentoId', 'Int!')],
        'clasificarDocumento': [('documentoId', 'Int!')],
        'reclasificarDocumento': [
            ('documentoId', 'Int!'), ('tipoDocumentoId', 'Int!'),
        ],
        'crearYAsignarTipo': [
            ('documentoId', 'Int!'), ('nombre', 'String!'), ('palabrasClave', 'String!'),
        ],
        'aceptarSugerencia': [('id', 'Int!'), ('peso', 'Int!')],
        'descartarSugerencia': [('id', 'Int!')],
        'generarSugerenciasKeywords': [('limpiar', 'Boolean!'), ('minDocs', 'Int!'), ('top', 'Int!')],
        'crearDocumentoConPaginas': [
            ('esDobleCara', 'Boolean'),
            ('loteId', 'ID!'),
            ('nombreFinal', 'String'),
            ('paginaIds', '[ID!]!'),
            ('tipoDocumentoId', 'Int'),
        ],
        'agregarPaginaADocumento': [
            ('documentoId', 'ID!'),
            ('paginaId', 'ID!'),
        ],
        'quitarPaginaDeDocumento': [
            ('documentoId', 'ID!'),
            ('paginaId', 'ID!'),
        ],
        'confirmarAgrupamiento': [
            ('asignaciones', '[AsignacionGrupoInput!]!'),
            ('loteId', 'ID!'),
        ],
        'asignarPaginaATipo': [
            ('paginaId', 'ID!'),
            ('tipoDocumentoId', 'ID!'),
        ],
        'crearTipoYAsignar': [
            ('nombre', 'String!'),
            ('paginaId', 'ID!'),
        ],
        'descartarPagina': [
            ('paginaId', 'ID!'),
        ],
        'guardarPalabrasAdmin': [
            ('palabrasObligatorias', '[String!]!'),
            ('palabrasSeleccionadas', '[String!]!'),
            ('tipoId', 'ID!'),
        ],
    },
}


def _sin_default(tipo_sdl):
    """`Int = 1` -> `Int`. Los opcionales conservan su default en el schema."""
    return tipo_sdl.split('=')[0].strip()


class ContratoSchemaTests(SimpleTestCase):

    def setUp(self):
        self.graphql = schema._schema

    def test_campos_de_la_raiz(self):
        for raiz, campos in ESPERADO.items():
            with self.subTest(raiz=raiz):
                reales = set(self.graphql.query_type.fields if raiz == 'Query'
                             else self.graphql.mutation_type.fields)
                self.assertEqual(reales, set(campos))

    def test_argumentos_de_cada_operacion(self):
        for raiz, campos in ESPERADO.items():
            tipo_raiz = self.graphql.query_type if raiz == 'Query' else self.graphql.mutation_type
            for nombre, argumentos in campos.items():
                with self.subTest(operacion=nombre):
                    campo = tipo_raiz.fields[nombre]
                    reales = sorted(
                        (a, _sin_default(str(campo.args[a].type))) for a in campo.args
                    )
                    self.assertEqual(reales, sorted(argumentos))

    def test_campos_de_cada_tipo_de_payload(self):
        esperados = {
            'PersonaType': [
                'apellidos', 'ci', 'codigo', 'createdAt', 'documentosClasificados', 'email', 'id',
                'nombres', 'porcentajeCompletado', 'telefono', 'tieneDocumentosClasificados',
                'totalDocumentos', 'updatedAt',
            ],
            'PersonaConnection': ['items', 'page', 'total', 'totalPages'],
            'TipoDocumentoType': [
                'activo', 'color', 'createdAt', 'ejemplosPaginas', 'firmaConsolidada',
                'id', 'keywordsObligatorias', 'nombre', 'palabrasClave', 'slug', 'unidad',
            ],
            'DocumentoType': [
                'archivoOriginal', 'archivoPagina', 'createdAt', 'duplicadoDe', 'esDobleCara',
                'estado', 'historialClasificacion', 'id', 'keywordsMatcheadas', 'lote',
                'nombreFinal', 'paginaNumero', 'paginas', 'persona', 'phash', 'score',
                'textoExtraido', 'tipoDocumento', 'totalPaginas', 'unidad',
            ],
            'LoteType': [
                'createdAt', 'documentos', 'estado', 'grupos', 'id', 'nombreArchivoOriginal',
                'paginas', 'parejasSugeridas', 'totalGrupos', 'totalPaginas', 'unidad',
            ],
            'GrupoType': [
                'createdAt', 'estado', 'firmaConsolidada', 'id', 'loteId', 'paginas',
                'parejasSugeridas', 'tipoDocumentoSugerido', 'totalPaginas', 'unidad',
            ],
            'PaginaType': [
                'createdAt', 'descartable', 'estado', 'firmaEstructura', 'firmaPalabras',
                'grupo', 'id', 'loteId', 'loteNombre', 'nroPaginaEnPdf', 'pdfOrigen', 'phash', 'textoOcr', 'unidad',
            ],
            'DocumentoByPersona': ['clasificados', 'documentos', 'pendientes', 'personaId',
                                   'totalPaginas'],
            'UnidadType': ['activa', 'codigo', 'createdAt', 'id', 'nombre'],

            'UserType': ['codEmpleado', 'email', 'firstName', 'id', 'lastName', 'role', 'rolSlug', 'telefono', 'unidad', 'username'],
            'LoginUser': ['message', 'success', 'token', 'user'],
            'CreateUser': ['message', 'success', 'user'],
            'CreatePersona': ['message', 'persona', 'success'],
            'UpdatePersona': ['message', 'persona', 'success'],
            'DeletePersona': ['message', 'success'],
            'CreateTipoDocumento': ['message', 'success', 'tipoDocumento'],
            'UpdateTipoDocumento': ['message', 'success', 'tipoDocumento'],
            'DeleteTipoDocumento': ['message', 'success'],
            'AsignarDocumento': ['documento', 'message', 'success'],
            'ClasificarDocumento': ['documento', 'message', 'success'],
            'ReclasificarDocumento': ['documento', 'message', 'success'],
            'CrearYAsignarTipo': ['documento', 'message', 'success', 'tipoDocumento'],
            'SugerenciaKeywordType': [
                'aceptada', 'createdAt', 'frecuencia', 'id', 'palabra', 'ratio', 'tipoDocumento',
            ],
            'AceptarSugerencia': ['message', 'success', 'sugerencia', 'tipoDocumento'],
            'DescartarSugerencia': ['message', 'success', 'sugerencia'],
            'GenerarSugerenciasKeywords': ['message', 'success', 'totalGeneradas', 'totalVerificados'],
            'EstadisticasDigitalizacionType': [
                'sugerenciasPendientes', 'tasaEfectividad', 'totalClasificados', 'totalDocumentos',
                'totalDudosos', 'totalDuplicados', 'totalPendientes', 'totalSinClasificar',
                'totalVerificados',
            ],
            'ParejaSugeridaType': ['paginaAnversoId', 'paginaReversoId'],
            'CrearDocumentoConPaginas': ['advertencia', 'documento', 'message', 'success'],
            'AgregarPaginaADocumento': ['advertencia', 'documento', 'message', 'success'],
            'QuitarPaginaDeDocumento': ['documento', 'message', 'success'],
        }
        for nombre, campos in esperados.items():
            with self.subTest(tipo=nombre):
                self.assertEqual(set(self.graphql.type_map[nombre].fields), set(campos))

    def test_las_relaciones_anidadas_no_degeneran(self):
        """`persona` y `tipoDocumento` deben ser los tipos reales.

        Sin redeclarar la FK, strawberry_django deja `DjangoModelType { pk }`,
        que rompe las selections anidadas del frontend en silencio.
        """
        documento = self.graphql.type_map['DocumentoType']
        self.assertEqual(str(documento.fields['persona'].type), 'PersonaType!')
        self.assertEqual(str(documento.fields['tipoDocumento'].type), 'TipoDocumentoType')

    def test_enum_por_defecto_ya_no_expone_los_enum_de_django(self):
        """`estado` y `role` pasaron a String con el valor de la base."""
        for nombre_tipo, campo in [('DocumentoType', 'estado'), ('UserType', 'role')]:
            with self.subTest(campo=campo):
                tipo = str(self.graphql.type_map[nombre_tipo].fields[campo].type)
                self.assertEqual(tipo, 'String!')


from django.test import override_settings


@override_settings(DEBUG=True, DEV_FAKE_UNIDAD='LEGACY')
class VistaGraphQLTests(TestCase):
    """Transporte HTTP: el frontend envia POST a /graphql/."""

    def test_get_rechaza_queries_y_post_las_atiende(self):
        import json

        consulta = '{ personas { total } }'
        cliente = Client()

        # Sin barra final Django redirige (APPEND_SLASH): hay que pegarle a la
        # ruta real. Strawberry responde 400 (no 405) con este mensaje.
        con_get = cliente.get('/graphql/', {'query': consulta})
        self.assertEqual(con_get.status_code, 400)
        self.assertIn(b'not allowed when using GET', con_get.content)

        con_post = cliente.post(
            '/graphql/',
            data=json.dumps({'query': consulta}),
            content_type='application/json',
        )
        self.assertEqual(con_post.status_code, 200)
        cuerpo = con_post.json()
        self.assertIsNone(cuerpo.get('errors'))
        # Solo importa la forma de la respuesta que espera el frontend.
        # La migracion 0005 siembra 4 personas iniciales.
        self.assertEqual(cuerpo['data']['personas']['total'], 4)

    def test_post_con_operacion_invalida_reporta_errores(self):
        """Un campo inexistente vuelve en `errors`, no como exception."""
        import json

        respuesta = self.client.post(
            '/graphql/',
            data=json.dumps({'query': '{ campoQueNoExiste }'}),
            content_type='application/json',
        )
        cuerpo = respuesta.json()
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNone(cuerpo['data'])
        self.assertIn('errors', cuerpo)
        self.assertIn('campoQueNoExiste', cuerpo['errors'][0]['message'])