from apps.documentos.models import Documento, TipoDocumento
from apps.personas.models import Persona
from apps.tests.base import GraphQLTestCase
from apps.tests.datos import DatosGraphQL
from apps.users.models import User
from apps.users.tokens import validar_token


class MutacionPersonasTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_create_persona_normaliza_texto_vacio(self):
        r = self.mutacion('createPersona', 'success', 'message',
                          'persona { id codigo nombres apellidos ci telefono email }',
                          codigo='310000003',
                          nombres='Ana', apellidos='Ruiz')
        self.assertIs(r['success'], True)
        self.assertEqual(r['persona']['ci'], '')
        self.assertEqual(r['persona']['telefono'], '')
        self.assertIsNone(r['persona']['email'])

    def test_create_persona_codigo_duplicado_es_error_blando(self):
        r = self.mutacion('createPersona', 'success', 'message', 'persona { id }',
                          codigo='310000001',
                          nombres='Otro', apellidos='Nombre')
        self.assertIs(r['success'], False)
        self.assertIsNone(r['persona'])

    def test_update_persona_parcial(self):
        r = self.mutacion('updatePersona', 'success', 'message',
                          'persona { codigo nombres apellidos ci }',
                          id=self.d['persona'].id, telefono='70000000')
        self.assertIs(r['success'], True)
        self.assertEqual(r['persona']['telefono'] if 'telefono' in r['persona'] else '70000000',
                         '70000000')
        self.assertEqual(r['persona']['nombres'], 'Juan')

    def test_update_persona_rechaza_codigo_duplicado(self):
        r = self.mutacion('updatePersona', 'success', 'message', 'persona { id }',
                          id=self.d['persona'].id, codigo='310000002')
        self.assertIs(r['success'], False)
        self.assertIsNone(r['persona'])
        self.d['persona'].refresh_from_db()
        self.assertEqual(self.d['persona'].codigo, '310000001')

    def test_update_persona_conserva_su_propio_codigo(self):
        r = self.mutacion('updatePersona', 'success', 'persona { codigo }',
                          id=self.d['persona'].id, codigo='310000001')
        self.assertIs(r['success'], True)

    def test_delete_persona(self):
        r = self.mutacion('deletePersona', 'success', 'message',
                          id=self.d['persona'].id)
        self.assertIs(r['success'], True)
        self.assertFalse(Persona.objects.filter(id=self.d['persona'].id).exists())

    def test_delete_persona_inexistente(self):
        r = self.mutacion('deletePersona', 'success', 'message', id=999999)
        self.assertIs(r['success'], False)


class MutacionTiposDocumentoTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_create_tipo_reclasifica_los_pendientes(self):
        r = self.mutacion('createTipoDocumento', 'success', 'message',
                          'tipoDocumento { id nombre slug palabrasClave activo }',
                          nombre='Constancia de Estudios',
                          palabrasClave='constancia,estudios')
        self.assertIs(r['success'], True)
        self.assertEqual(r['tipoDocumento']['slug'], 'constancia-de-estudios')

        pendiente = Documento.objects.get(id=self.d['pendiente'].id)
        # 'texto sin coincidir' no matchea 'constancia' ni 'estudios': el
        # clasificador distingue "no encontre nada" de "no hay nada que hacer".
        self.assertEqual(pendiente.estado, 'sin_clasificar')

    def test_create_tipo_con_palabras_que_si_coinciden(self):
        r = self.mutacion('createTipoDocumento', 'success', 'message',
                          'tipoDocumento { id slug }',
                          nombre='Recibo', palabrasClave='texto,sin:5')
        self.assertIs(r['success'], True)

        # `reclasificar_todos` deja el pendiente clasificado con el tipo nuevo.
        pendiente = Documento.objects.get(id=self.d['pendiente'].id)
        self.assertEqual(pendiente.estado, 'clasificado')
        self.assertEqual(pendiente.tipo_documento.slug, 'recibo')

    def test_create_tipo_duplicado(self):
        r = self.mutacion('createTipoDocumento', 'success', 'message',
                          'tipoDocumento { id }',
                          nombre='Certificado de Nacimiento', palabrasClave='x')
        self.assertIs(r['success'], False)
        self.assertIsNone(r['tipoDocumento'])

    def test_update_tipo_documento(self):
        r = self.mutacion('updateTipoDocumento', 'success', 'message',
                          'tipoDocumento { nombre palabrasClave activo }',
                          id=self.d['tipo'].id, activo=False)
        self.assertIs(r['success'], True)
        self.assertIs(r['tipoDocumento']['activo'], False)
        self.assertEqual(r['tipoDocumento']['nombre'], 'Certificado de Nacimiento')

    def test_delete_tipo_deja_los_documentos_pendientes(self):
        r = self.mutacion('deleteTipoDocumento', 'success', 'message',
                          id=self.d['tipo'].id)
        self.assertIs(r['success'], True)
        self.assertFalse(TipoDocumento.objects.filter(id=self.d['tipo'].id).exists())

        doc = Documento.objects.get(id=self.d['clasificado'].id)
        self.assertIsNone(doc.tipo_documento)
        self.assertEqual(doc.estado, 'pendiente')

    def test_tipos_inexistente(self):
        for raiz in ('updateTipoDocumento', 'deleteTipoDocumento'):
            with self.subTest(raiz=raiz):
                r = self.mutacion(raiz, 'success', 'message', id=999999)
                self.assertIs(r['success'], False)


class MutacionDocumentosTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_asignar_documento(self):
        r = self.mutacion('asignarDocumento', 'success', 'message',
                          'documento { id estado tipoDocumento { nombre } }',
                          documentoId=self.d['pendiente'].id,
                          tipoDocumentoId=self.d['tipo'].id)
        self.assertIs(r['success'], True)
        self.assertEqual(r['documento']['estado'], 'clasificado')
        self.assertEqual(r['documento']['tipoDocumento']['nombre'],
                         'Certificado de Nacimiento')

    def test_asignar_documento_errores(self):
        for kwargs, esperado in [
            ({'documentoId': 999999, 'tipoDocumentoId': self.d['tipo'].id}, 'Documento no encontrado'),
            ({'documentoId': self.d['pendiente'].id, 'tipoDocumentoId': 999999},
             'Tipo de documento no encontrado'),
        ]:
            with self.subTest(**kwargs):
                r = self.mutacion('asignarDocumento', 'success', 'message',
                                  'documento { id }', **kwargs)
                self.assertIs(r['success'], False)
                self.assertIn(esperado, r['message'])
                self.assertIsNone(r['documento'])

    def test_clasificar_documento_encuentra_el_tipo_por_palabras(self):
        # El fixture "pendiente" tiene texto que no matchea; este si.
        doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/6.pdf', pagina_numero=7,
            texto_extraido='certificado de nacimiento expedido por la universidad',
            estado='pendiente',
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado tipoDocumento { nombre } }',
                          documentoId=doc.id)
        self.assertIs(r['success'], True)
        self.assertEqual(r['documento']['estado'], 'clasificado')
        self.assertEqual(r['documento']['tipoDocumento']['nombre'],
                         'Certificado de Nacimiento')
        self.assertIn('Certificado de Nacimiento', r['message'])

    def test_clasificar_documento_sin_coincidencia_queda_sin_clasificar(self):
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado tipoDocumento { id } }',
                          documentoId=self.d['pendiente'].id)
        # "texto sin coincidir" no matchea ninguna palabra clave.
        self.assertIs(r['success'], False)
        self.assertIn('No se pudo clasificar', r['message'])
        self.assertEqual(r['documento']['estado'], 'sin_clasificar')
        self.assertIsNone(r['documento']['tipoDocumento'])

    def test_clasificar_documento_sin_texto(self):
        doc = Documento.objects.create(
            persona=self.d['persona'], archivo_original='originales/2.pdf', pagina_numero=3,
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { id }', documentoId=doc.id)
        self.assertIs(r['success'], False)
        self.assertIn('No hay texto extraído', r['message'])

    def test_clasificar_documento_persiste_score_y_keywords(self):
        doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/8.pdf', pagina_numero=1,
            texto_extraido='certificado de nacimiento del menor',
            estado='pendiente',
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado score keywordsMatcheadas }',
                          documentoId=doc.id)
        self.assertIs(r['success'], True)

        doc.refresh_from_db()
        self.assertIsNotNone(doc.score)
        # Fixture: 'certificado,nacimiento:3' -> 1*2 + 3*2.
        self.assertEqual(doc.score, 8.0)
        self.assertEqual(doc.keywords_matcheadas, ['certificado', 'nacimiento'])
        self.assertEqual(r['documento']['score'], 8.0)
        self.assertEqual(r['documento']['keywordsMatcheadas'],
                         ['certificado', 'nacimiento'])

    def test_clasificar_documento_duda_por_margen_minimo(self):
        """Dos tipos con el mismo score -> el documento queda 'dudosa'."""
        self.d['tipo'].palabras_clave = 'constancia:3'
        self.d['tipo'].save()
        TipoDocumento.objects.create(
            nombre='Constancia de Estudios',
            slug='constancia-de-estudios',
            palabras_clave='estudios:3',
        )
        doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/9.pdf', pagina_numero=1,
            texto_extraido='constancia de estudios del estudiante',
            estado='pendiente',
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado tipoDocumento { id } score }',
                          documentoId=doc.id)
        self.assertIs(r['success'], True)
        # Empate perfecto: se asigna el primero, pero queda marcado dudoso.
        self.assertEqual(r['documento']['estado'], 'dudosa')
        self.assertIsNotNone(r['documento']['tipoDocumento'])
        self.assertEqual(r['documento']['score'], 6.0)

    def test_keywords_obligatorias_descartan_el_tipo(self):
        """Una obligatoria ausente elimina el tipo, aunque matchee todo lo demas."""
        self.d['tipo'].palabras_clave = 'certificado,nacimiento'
        self.d['tipo'].keywords_obligatorias = ['inscripcion']
        self.d['tipo'].save()
        doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/10.pdf', pagina_numero=1,
            texto_extraido='certificado de nacimiento del menor',
            estado='pendiente',
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado tipoDocumento { id } }',
                          documentoId=doc.id)
        # Las dos palabras matchean, pero falta la obligatoria: no clasifica.
        self.assertIs(r['success'], False)
        self.assertEqual(r['documento']['estado'], 'sin_clasificar')
        doc.refresh_from_db()
        self.assertIsNone(doc.tipo_documento)

    def test_keywords_obligatorias_presentes_no_descartan(self):
        self.d['tipo'].palabras_clave = 'certificado,nacimiento'
        self.d['tipo'].keywords_obligatorias = ['REGISTRO CIVIL']
        self.d['tipo'].save()
        doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/11.pdf', pagina_numero=1,
            texto_extraido='certificado de nacimiento del registro civil',
            estado='pendiente',
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado }', documentoId=doc.id)
        self.assertIs(r['success'], True)
        self.assertEqual(r['documento']['estado'], 'clasificado')

    def test_una_obligatoria_ya_presente_no_penaliza(self):
        """Las obligatorias son puerta, no puntuan: el score no las suma."""
        self.d['tipo'].palabras_clave = 'certificado'
        self.d['tipo'].keywords_obligatorias = ['nacimiento']
        self.d['tipo'].save()
        doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/12.pdf', pagina_numero=1,
            texto_extraido='certificado de nacimiento',
            estado='pendiente',
        )
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { estado score }', documentoId=doc.id)
        self.assertIs(r['success'], True)
        self.assertEqual(r['documento']['estado'], 'clasificado')
        doc.refresh_from_db()
        # Solo 'certificado' 1*2=2; 'nacimiento' abrio la puerta y nada mas.
        self.assertEqual(doc.score, 2.0)
        self.assertEqual(doc.keywords_matcheadas, ['certificado'])

    def test_clasificar_documento_inexistente(self):
        r = self.mutacion('clasificarDocumento', 'success', 'message',
                          'documento { id }', documentoId=999999)
        self.assertIs(r['success'], False)

    def test_crear_y_asignar_tipo_reutiliza_slug_existente(self):
        antes = TipoDocumento.objects.count()
        r = self.mutacion('crearYAsignarTipo', 'success', 'message',
                          'tipoDocumento { id nombre slug }',
                          'documento { id estado tipoDocumento { slug } }',
                          documentoId=self.d['pendiente'].id,
                          nombre='certificado de nacimiento',
                          palabrasClave='certificado')
        self.assertIs(r['success'], True)
        self.assertEqual(r['tipoDocumento']['id'], str(self.d['tipo'].id))
        self.assertEqual(TipoDocumento.objects.count(), antes)
        self.assertEqual(r['documento']['estado'], 'clasificado')

    def test_crear_y_asignar_tipo_crea_tipo_nuevo(self):
        r = self.mutacion('crearYAsignarTipo', 'success', 'message',
                          'tipoDocumento { nombre slug activo }',
                          'documento { estado tipoDocumento { slug } }',
                          documentoId=self.d['pendiente'].id,
                          nombre='Acta de Examen',
                          palabrasClave='acta,examen')
        self.assertIs(r['success'], True)
        self.assertEqual(r['tipoDocumento']['slug'], 'acta-de-examen')
        self.assertEqual(r['documento']['tipoDocumento']['slug'], 'acta-de-examen')
        self.assertEqual(r['documento']['estado'], 'clasificado')

    def test_crear_y_asignar_tipo_documento_inexistente(self):
        r = self.mutacion('crearYAsignarTipo', 'success', 'message',
                          'tipoDocumento { id }', 'documento { id }',
                          documentoId=999999, nombre='X', palabrasClave='x')
        self.assertIs(r['success'], False)
        self.assertIsNone(r['tipoDocumento'])
        self.assertIsNone(r['documento'])


class MutacionUsuariosTests(GraphQLTestCase):
    def test_login_exitoso(self):
        User.objects.create_user(username='jperez', password='secreto123',
                                 email='jperez@um.edu.py', first_name='Juan',
                                 last_name='Perez', role='admin')
        r = self.mutacion('loginUser', 'success', 'message', 'token',
                          'user { username email firstName lastName role telefono }',
                          username='jperez', password='secreto123')
        self.assertIs(r['success'], True)
        self.assertEqual(r['user']['username'], 'jperez')
        # `role` es String: llega el valor de la base, no el nombre del enum.
        self.assertEqual(r['user']['role'], 'admin')
        user_validado = validar_token(r['token'])
        self.assertIsNotNone(user_validado)
        self.assertEqual(user_validado.username, 'jperez')

    def test_login_credenciales_incorrectas(self):
        User.objects.create_user(username='jperez', password='secreto123')
        r = self.mutacion('loginUser', 'success', 'message', 'token', 'user { id }',
                          username='jperez', password='incorrecta')
        self.assertIs(r['success'], False)
        self.assertIn('Credenciales incorrectas', r['message'])
        self.assertIsNone(r['user'])
        self.assertIsNone(r['token'])

    def test_login_usuario_inexistente(self):
        r = self.mutacion('loginUser', 'success', 'message', 'token',
                          username='nadie', password='x')
        self.assertIs(r['success'], False)

    def test_create_user_defaults(self):
        r = self.mutacion('createUser', 'success', 'message',
                          'user { username email firstName lastName role telefono }',
                          username='nuevo', password='clave123',
                          email='nuevo@um.edu.py', firstName='Nuevo', lastName='Usuario')
        self.assertIs(r['success'], True)
        self.assertEqual(r['user']['role'], 'operador')
        self.assertEqual(r['user']['telefono'], '')
        self.assertTrue(User.objects.get(username='nuevo').check_password('clave123'))

    def test_create_user_con_role_explicito(self):
        r = self.mutacion('createUser', 'success', 'message', 'user { role telefono }',
                          username='admin2', password='clave123',
                          email='a@b.com', firstName='A', lastName='B',
                          role='admin', telefono='0981234567')
        self.assertEqual(r['user']['role'], 'admin')
        self.assertEqual(r['user']['telefono'], '0981234567')

    def test_create_user_username_duplicado(self):
        User.objects.create_user(username='dup', password='x')
        r = self.mutacion('createUser', 'success', 'message', 'user { id }',
                          username='dup', password='clave123', email='a@b.com',
                          firstName='A', lastName='B')
        self.assertIs(r['success'], False)
        self.assertIsNone(r['user'])


class ErroresBlandoTests(GraphQLTestCase):
    """Ninguna mutacion de negocio debe levantar un error de GraphQL."""

    def setUp(self):
        self.d = DatosGraphQL.crear()

    def test_todas_las_mutaciones_devuelven_success_y_message(self):
        casos = [
            ('createPersona', {'codigo': '310000001',
                               'nombres': 'X', 'apellidos': 'Y'}),
            ('updatePersona', {'id': 999999}),
            ('deletePersona', {'id': 999999}),
            ('createTipoDocumento', {'nombre': 'Certificado de Nacimiento',
                                     'palabrasClave': 'x'}),
            ('updateTipoDocumento', {'id': 999999}),
            ('deleteTipoDocumento', {'id': 999999}),
            ('asignarDocumento', {'documentoId': 999999, 'tipoDocumentoId': 1}),
            ('clasificarDocumento', {'documentoId': 999999}),
            ('crearYAsignarTipo', {'documentoId': 999999, 'nombre': 'X',
                                      'palabrasClave': 'x'}),
            ('loginUser', {'username': 'nadie', 'password': 'x'}),
            ('createUser', {'username': 'x', 'password': 'y', 'email': 'a@b.c',
                             'firstName': 'A', 'lastName': 'B'}),
            ('aceptarSugerencia', {'id': 999999, 'peso': 1}),
            ('descartarSugerencia', {'id': 999999}),
        ]
        self.assertEqual(len(casos), 13)

        User.objects.create_user(username='x', password='y')

        for raiz, variables in casos:
            with self.subTest(raiz=raiz):
                # `self.mutacion` ya falla el test si aparecen errores GraphQL.
                r = self.mutacion(raiz, 'success', 'message', **variables)
                self.assertIs(r['success'], False, msg=raiz)
                self.assertTrue(r['message'], msg=raiz)


class SugerenciasKeywordMutacionTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()
        from apps.documentos.models import SugerenciaKeyword
        self.sug = SugerenciaKeyword.objects.create(
            tipo_documento=self.d['tipo'],
            palabra='reniec',
            ratio=4.0,
            frecuencia=8,
            aceptada=None,
        )

    def test_aceptar_sugerencia_agrega_palabra_a_tipo_y_marca_aceptada(self):
        r = self.mutacion(
            'aceptarSugerencia', 'success', 'message',
            'sugerencia { id aceptada } tipoDocumento { id palabrasClave }',
            id=self.sug.id, peso=3,
        )
        self.assertIs(r['success'], True)
        self.assertIs(r['sugerencia']['aceptada'], True)
        self.assertIn('reniec:3', r['tipoDocumento']['palabrasClave'])
        self.sug.refresh_from_db()
        self.assertIs(self.sug.aceptada, True)

    def test_descartar_sugerencia_marca_como_descartada(self):
        r = self.mutacion(
            'descartarSugerencia', 'success', 'message',
            'sugerencia { id aceptada }',
            id=self.sug.id,
        )
        self.assertIs(r['success'], True)
        self.assertIs(r['sugerencia']['aceptada'], False)
        self.sug.refresh_from_db()
        self.assertIs(self.sug.aceptada, False)

    def test_generar_sugerencias_keywords_ejecuta_y_retorna_payload(self):
        # Crear documentos verificados con texto
        Documento.objects.create(
            persona=self.d['persona'],
            tipo_documento=self.d['tipo'],
            archivo_original='doc1.pdf',
            pagina_numero=1,
            texto_extraido='certificado oficialia civil bolivia nacimiento menor partida',
            estado='verificado',
        )
        r = self.mutacion(
            'generarSugerenciasKeywords', 'success', 'message', 'totalGeneradas', 'totalVerificados',
            minDocs=1, top=3, limpiar=True,
        )
        self.assertIs(r['success'], True)
        self.assertGreaterEqual(r['totalVerificados'], 1)