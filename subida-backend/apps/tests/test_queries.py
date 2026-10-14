from apps.tests.base import GraphQLTestCase
from apps.tests.datos import DatosGraphQL


class QueryPersonasTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_lista_paginada_y_campos_calculados(self):
        # search acota al fixture: los seeds historicos tambien viven en la DB.
        datos = self.consulta(
            'personas',
            'total', 'page', 'totalPages',
            'items { id codigo nombres apellidos ci email telefono '
            'totalDocumentos documentosClasificados porcentajeCompletado '
            'tieneDocumentosClasificados createdAt }',
            search='310000',
        )

        self.assertEqual(datos['total'], 2)
        self.assertEqual(datos['page'], 1)
        self.assertEqual(datos['totalPages'], 1)

        # `codigo` ordena Persona.Meta.ordering, no la Creacion.
        primero = datos['items'][0]
        self.assertEqual(primero['codigo'], '310000001')
        self.assertEqual(primero['totalDocumentos'], 2)
        self.assertEqual(primero['documentosClasificados'], 1)
        self.assertEqual(primero['porcentajeCompletado'], 50.0)
        self.assertIs(primero['tieneDocumentosClasificados'], True)
        self.assertEqual(primero['ci'], '1234567')
        self.assertIsNone(primero['email'])

    def test_porcentaje_cero_sin_documentos(self):
        datos = self.consulta(
            'personas',
            'items { codigo totalDocumentos porcentajeCompletado tieneDocumentosClasificados }',
            search='310000',
        )
        sin_docs = [i for i in datos['items'] if i['codigo'] == '310000002'][0]
        self.assertEqual(sin_docs['totalDocumentos'], 0)
        self.assertEqual(sin_docs['porcentajeCompletado'], 0)
        self.assertIs(sin_docs['tieneDocumentosClasificados'], False)

    def test_search_por_codigo_nombres_apellidos_y_ci(self):
        for busqueda, esperados in [
            ('310000002', ['310000002']),
            ('Maria', ['310000002']),
            ('Perez', ['310000001']),
            ('1234567', ['310000001']),
        ]:
            with self.subTest(busqueda=busqueda):
                datos = self.consulta(
                    'personas', 'items { codigo }',
                    search=busqueda,
                )
                self.assertIn(esperados[0], [i['codigo'] for i in datos['items']])

    def test_paginacion_reparte_y_calcula_total_pages(self):
        d = self.consulta(
            'personas', 'items { codigo }', 'totalPages',
            search='310000', page=2, limit=1,
        )
        self.assertEqual(len(d['items']), 1)
        self.assertEqual(d['items'][0]['codigo'], '310000002')
        self.assertEqual(d['totalPages'], 2)

    def test_page_y_limit_aceptan_null_explicito(self):
        # El frontend declara $page/$limit como Int. Un null explicito debe
        # seguir cayendo al default, no romper la consulta.
        d = self.ejecutar(
            'query($page: Int, $limit: Int) { '
            'personas(search: "310000", page: $page, limit: $limit) { total page items { codigo } } }',
            {'page': None, 'limit': None},
        )['personas']
        self.assertEqual(d['total'], 2)
        self.assertEqual(d['page'], 1)
        self.assertEqual(len(d['items']), 2)

    def test_persona_por_id_y_inexistente(self):
        p = self.consulta('persona', 'id', 'codigo', id=self.d['persona'].id)
        self.assertEqual(p['codigo'], '310000001')
        self.assertIsNone(self.consulta('persona', 'id', id=999999))

    def test_ordenamiento_por_created_at_y_whitelist(self):
        d_asc = self.consulta(
            'personas', 'items { codigo }',
            search='310000', orderBy='created_at',
        )
        codigos_asc = [i['codigo'] for i in d_asc['items']]
        d_desc = self.consulta(
            'personas', 'items { codigo }',
            search='310000', orderBy='-created_at',
        )
        codigos_desc = [i['codigo'] for i in d_desc['items']]
        self.assertEqual(codigos_asc, list(reversed(codigos_desc)))


class QueryDocumentosTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_tipos_documento_filtran_por_activo(self):
        # Sin filtro llegan todos, incluidos los seeds historicos (desactivados
        # por el fixture). Las aserciones son por membresia, no por conteo.
        todos = self.consulta('tiposDocumento', 'id', 'nombre', 'slug', 'palabrasClave', 'activo')
        por_slug = {t['slug']: t for t in todos}
        self.assertIn('certificado-de-nacimiento', por_slug)
        self.assertIn('comprobante-de-pago', por_slug)

        activos = self.consulta('tiposDocumento', 'nombre', 'activo', activo=True)
        nombres_activos = [t['nombre'] for t in activos]
        self.assertIn('Certificado de Nacimiento', nombres_activos)

        inactivos = self.consulta('tiposDocumento', 'nombre', activo=False)
        nombres_inactivos = [t['nombre'] for t in inactivos]
        self.assertIn('Comprobante de Pago', nombres_inactivos)

    def test_tipo_documento_por_id(self):
        t = self.consulta('tipoDocumento', 'nombre', id=self.d['tipo'].id)
        self.assertEqual(t['nombre'], 'Certificado de Nacimiento')
        self.assertIsNone(self.consulta('tipoDocumento', 'nombre', id=999999))

    def test_documentos_persona_con_estadisticas(self):
        d = self.consulta(
            'documentosPersona',
            'personaId', 'totalPaginas', 'clasificados', 'pendientes',
            'documentos { id paginaNumero estado textoExtraido '
            'tipoDocumento { id nombre slug } }',
            personaId=self.d['persona'].id,
        )

        self.assertEqual(d['personaId'], self.d['persona'].id)
        self.assertEqual(d['totalPaginas'], 2)
        self.assertEqual(d['clasificados'], 1)
        self.assertEqual(d['pendientes'], 1)

        # El orden viene de Documento.Meta.ordering = [persona, pagina_numero].
        self.assertEqual([x['paginaNumero'] for x in d['documentos']], [1, 2])
        self.assertEqual(d['documentos'][0]['tipoDocumento']['nombre'], 'Certificado de Nacimiento')
        self.assertIsNone(d['documentos'][1]['tipoDocumento'])

    def test_documentos_pendientes_listan_los_sin_tipo(self):
        d = self.consulta(
            'documentosPendientes',
            'id', 'paginaNumero', 'estado',
            'persona { id codigo nombres apellidos }',
            'tipoDocumento { id nombre }',
        )

        self.assertEqual(len(d), 1)
        self.assertEqual(d[0]['id'], str(self.d['pendiente'].id))
        # `estado` es String con el valor de la base, no el nombre del enum.
        self.assertEqual(d[0]['estado'], 'pendiente')
        self.assertIsNone(d[0]['tipoDocumento'])

        # La relacion anidada `persona` es el regression test del tipo generico
        # DjangoModelType: si pierde el tipo, esta seleccion deja de validar.
        self.assertEqual(d[0]['persona']['codigo'], '310000001')
        self.assertEqual(d[0]['persona']['nombres'], 'Juan')
        self.assertEqual(d[0]['persona']['apellidos'], 'Perez')

    def test_documento_clasificado_no_aparece_como_pendiente(self):
        d = self.consulta('documentosPendientes', 'id')
        self.assertNotIn(str(self.d['clasificado'].id), [x['id'] for x in d])

    def test_estado_de_un_documento_clasificado(self):
        d = self.consulta(
            'documentosPersona', 'documentos { estado }',
            personaId=self.d['persona'].id,
        )
        estados = sorted(x['estado'] for x in d['documentos'])
        self.assertEqual(estados, ['clasificado', 'pendiente'])


class QueryClasificacionTests(GraphQLTestCase):
    """Los campos del clasificador local tienen que salir por GraphQL."""

    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_documento_expone_score_y_keywords(self):
        self.d['clasificado'].score = 12.0
        self.d['clasificado'].keywords_matcheadas = ['certificado', 'nacimiento']
        self.d['clasificado'].save()

        d = self.consulta(
            'documentosPersona',
            'documentos { id score keywordsMatcheadas }',
            personaId=self.d['persona'].id,
        )
        por_id = {x['id']: x for x in d['documentos']}
        clasificado = por_id[str(self.d['clasificado'].id)]
        self.assertEqual(clasificado['score'], 12.0)
        self.assertEqual(clasificado['keywordsMatcheadas'], ['certificado', 'nacimiento'])

    def test_score_null_no_rompe(self):
        d = self.consulta('documentosPersona', 'documentos { id score }', personaId=self.d['persona'].id)
        por_id = {x['id']: x['score'] for x in d['documentos']}
        # El documento pendiente nunca fue clasificado: score sigue en null.
        self.assertIsNone(por_id[str(self.d['pendiente'].id)])

    def test_tipo_documento_expone_keywords_obligatorias(self):
        self.d['tipo'].keywords_obligatorias = ['registro civil']
        self.d['tipo'].save()

        d = self.consulta(
            'tiposDocumento', 'id keywordsObligatorias',
        )
        por_id = {x['id']: x['keywordsObligatorias'] for x in d}
        self.assertEqual(por_id[str(self.d['tipo'].id)], ['registro civil'])
        # El otro tipo se creo sin obligatorias.
        self.assertEqual(por_id[str(self.d['tipo'].id + 1)], [])

    def test_sin_clasificar_aparece_en_pendientes(self):
        """Un documento 'sin_clasificar' es un pendiente mas, no se esconde."""
        self.d['pendiente'].estado = 'sin_clasificar'
        self.d['pendiente'].save()

        d = self.consulta('documentosPendientes', 'id estado')
        pendientes = {x['id']: x['estado'] for x in d}
        self.assertEqual(pendientes[str(self.d['pendiente'].id)], 'sin_clasificar')

    def test_los_dudosos_no_entran_en_pendientes(self):
        """Un 'dudosa' ya tiene tipo asignado: no es una cola sin clasificar."""
        self.d['clasificado'].estado = 'dudosa'
        self.d['clasificado'].save()

        d = self.consulta('documentosPendientes', 'id')
        self.assertNotIn(str(self.d['clasificado'].id), [x['id'] for x in d])

    def test_sugerencias_keyword_retorna_pendientes(self):
        from apps.documentos.models import SugerenciaKeyword
        SugerenciaKeyword.objects.create(
            tipo_documento=self.d['tipo'],
            palabra='reniec',
            ratio=3.5,
            frecuencia=5,
            aceptada=None,
        )
        SugerenciaKeyword.objects.create(
            tipo_documento=self.d['tipo'],
            palabra='antigua',
            ratio=2.0,
            frecuencia=2,
            aceptada=True,
        )
        d = self.consulta(
            'sugerenciasKeyword', 'id palabra ratio frecuencia',
            tipoDocumentoId=self.d['tipo'].id,
        )
        palabras = [x['palabra'] for x in d]
        self.assertIn('reniec', palabras)
        self.assertNotIn('antigua', palabras)

    def test_documentos_pendientes_paginacion(self):
        # Con limit y offset
        d = self.consulta('documentosPendientes', 'id', limit=1, offset=0)
        self.assertEqual(len(d), 1)

    def test_estadisticas_digitalizacion(self):
        d = self.consulta(
            'estadisticasDigitalizacion',
            'totalDocumentos', 'totalClasificados', 'totalVerificados',
            'totalDudosos', 'totalSinClasificar', 'totalDuplicados',
            'totalPendientes', 'tasaEfectividad', 'sugerenciasPendientes',
        )
        self.assertGreaterEqual(d['totalDocumentos'], 2)
        self.assertGreaterEqual(d['totalClasificados'], 1)
        self.assertGreaterEqual(d['totalPendientes'], 1)
        self.assertIsInstance(d['tasaEfectividad'], float)

    def test_documentos_recientes(self):
        d = self.consulta('documentosRecientes', 'id paginaNumero estado', limit=2)
        self.assertLessEqual(len(d), 2)
        self.assertGreaterEqual(len(d), 1)