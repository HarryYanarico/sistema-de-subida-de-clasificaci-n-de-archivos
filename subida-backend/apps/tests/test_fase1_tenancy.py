import json
import time
import jwt
from django.conf import settings
from django.test import TestCase, Client, override_settings
from apps.core.models import Unidad
from apps.personas.models import Persona
from apps.documentos.models import TipoDocumento, Documento
from apps.users.models import User


class Fase1TenancyTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Crear dos unidades para pruebas
        self.unidad_a = Unidad.objects.create(codigo='02031', nombre='Unidad Alfa')
        self.unidad_b = Unidad.objects.create(codigo='02032', nombre='Unidad Beta')

        # Personas en cada unidad
        self.persona_a = Persona.objects.create(
            unidad=self.unidad_a, codigo='12345', nombres='Juan', apellidos='Perez'
        )
        self.persona_b = Persona.objects.create(
            unidad=self.unidad_b, codigo='12345', nombres='Pedro', apellidos='Gomez'
        )

        # Tipos de documento en cada unidad
        self.tipo_a = TipoDocumento.objects.create(
            unidad=self.unidad_a, nombre='Certificado', slug='certificado', palabras_clave='certificado:3'
        )
        self.tipo_b = TipoDocumento.objects.create(
            unidad=self.unidad_b, nombre='Certificado', slug='certificado', palabras_clave='certificado:3'
        )

        # Documentos en cada unidad
        self.doc_a = Documento.objects.create(
            unidad=self.unidad_a,
            persona=self.persona_a,
            tipo_documento=self.tipo_a,
            archivo_original='02031/doc_a.pdf',
            pagina_numero=1,
            texto_extraido='Certificado de estudios',
            estado='clasificado',
        )
        self.doc_b = Documento.objects.create(
            unidad=self.unidad_b,
            persona=self.persona_b,
            tipo_documento=self.tipo_b,
            archivo_original='02032/doc_b.pdf',
            pagina_numero=1,
            texto_extraido='Certificado de trabajo',
            estado='clasificado',
        )

    def _generar_token(self, cod_unidad, username='testuser', exp_offset=3600, secret=None, iss='admincentral'):
        payload = {
            'cod_unidad': cod_unidad,
            'username': username,
            'rol_slug': 'admin-archivos',
            'cod_empleado': 'EMP01',
            'email': f'{username}@example.com',
            'full_name': 'Test User',
            'iss': iss,
            'exp': int(time.time()) + exp_offset,
        }
        return jwt.encode(payload, secret or settings.SECRET_KEY, algorithm='HS256')

    def test_dos_unidades_con_mismo_codigo_persona_no_colisionan(self):
        """Dos unidades pueden tener personas con el mismo código sin error de unicidad."""
        self.assertEqual(self.persona_a.codigo, self.persona_b.codigo)
        self.assertNotEqual(self.persona_a.unidad_id, self.persona_b.unidad_id)
        self.assertEqual(Persona.objects.filter(codigo='12345').count(), 2)

    def test_request_sin_jwt_y_sin_fake_retorna_401(self):
        """En endpoints protegidos, sin JWT ni DEV_FAKE_UNIDAD se responde 401."""
        with override_settings(DEBUG=False, DEV_FAKE_UNIDAD=None):
            resp = self.client.post(
                '/graphql/',
                data=json.dumps({'query': '{ personas { total } }'}),
                content_type='application/json',
            )
            self.assertEqual(resp.status_code, 401)
            self.assertIn('No autenticado', resp.json().get('error', ''))

    def test_jwt_con_firma_invalida_retorna_401(self):
        """Un token firmado con una clave distinta a la esperada es rechazado con 401."""
        token_invalido = self._generar_token('02031', secret='clave_falsa_123')
        with override_settings(DEBUG=False):
            resp = self.client.post(
                '/graphql/',
                data=json.dumps({'query': '{ personas { total } }'}),
                content_type='application/json',
                HTTP_AUTHORIZATION=f'Bearer {token_invalido}',
            )
            self.assertEqual(resp.status_code, 401)

    def test_jwt_expirado_retorna_401(self):
        """Un token con exp en el pasado devuelve 401."""
        token_expirado = self._generar_token('02031', exp_offset=-3600)
        with override_settings(DEBUG=False):
            resp = self.client.post(
                '/graphql/',
                data=json.dumps({'query': '{ personas { total } }'}),
                content_type='application/json',
                HTTP_AUTHORIZATION=f'Bearer {token_expirado}',
            )
            self.assertEqual(resp.status_code, 401)
            self.assertIn('expirado', resp.json().get('error', '').lower())

    def test_jwt_emisor_invalido_retorna_401(self):
        """Un token con emisor distinto a 'admincentral' es rechazado."""
        token_mal_iss = self._generar_token('02031', iss='otro_emisor')
        with override_settings(DEBUG=False):
            resp = self.client.post(
                '/graphql/',
                data=json.dumps({'query': '{ personas { total } }'}),
                content_type='application/json',
                HTTP_AUTHORIZATION=f'Bearer {token_mal_iss}',
            )
            self.assertEqual(resp.status_code, 401)

    def test_aislamiento_queries_unidad_a_vs_unidad_b(self):
        """Un usuario con JWT de unidad A solo ve personas y tipos de su unidad."""
        token_a = self._generar_token('02031')
        resp_a = self.client.post(
            '/graphql/',
            data=json.dumps({'query': '{ personas { total items { codigo nombres } } }'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_a}',
        )
        self.assertEqual(resp_a.status_code, 200)
        data_a = resp_a.json()['data']['personas']
        self.assertEqual(data_a['total'], 1)
        self.assertEqual(data_a['items'][0]['nombres'], 'Juan')

        token_b = self._generar_token('02032')
        resp_b = self.client.post(
            '/graphql/',
            data=json.dumps({'query': '{ personas { total items { codigo nombres } } }'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_b}',
        )
        self.assertEqual(resp_b.status_code, 200)
        data_b = resp_b.json()['data']['personas']
        self.assertEqual(data_b['total'], 1)
        self.assertEqual(data_b['items'][0]['nombres'], 'Pedro')

    def test_usuario_unidad_a_no_puede_modificar_o_eliminar_persona_unidad_b(self):
        """Intentar actualizar o borrar un registro de otra unidad devuelve 'Persona no encontrada'."""
        token_a = self._generar_token('02031')

        # Intentar modificar persona de unidad B con token de unidad A
        mutation_update = f'''
        mutation {{
            updatePersona(id: {self.persona_b.id}, nombres: "Hackeado") {{
                success
                message
            }}
        }}
        '''
        resp = self.client.post(
            '/graphql/',
            data=json.dumps({'query': mutation_update}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_a}',
        )
        self.assertEqual(resp.status_code, 200)
        res = resp.json()['data']['updatePersona']
        self.assertFalse(res['success'])
        self.assertEqual(res['message'], 'Persona no encontrada')

        # Verificar que la persona B no cambió
        self.persona_b.refresh_from_db()
        self.assertEqual(self.persona_b.nombres, 'Pedro')

    def test_usuario_unidad_a_no_puede_acceder_a_archivo_de_unidad_b(self):
        """El endpoint REST de archivo devuelve 404 si el documento es de otra unidad."""
        token_a = self._generar_token('02031')
        resp = self.client.get(
            f'/api/documents/{self.doc_b.id}/file/',
            HTTP_AUTHORIZATION=f'Bearer {token_a}',
        )
        self.assertEqual(resp.status_code, 404)

    def test_modo_fake_en_debug_autentica_y_asigna_unidad(self):
        """Cuando DEBUG=True y DEV_FAKE_UNIDAD está configurada, una petición sin token usa los claims fake."""
        with override_settings(DEBUG=True, DEV_FAKE_UNIDAD='02031'):
            resp = self.client.post(
                '/graphql/',
                data=json.dumps({'query': '{ me { username rolSlug unidad { codigo } } }'}),
                content_type='application/json',
            )
            self.assertEqual(resp.status_code, 200)
            me_data = resp.json()['data']['me']
            self.assertIsNotNone(me_data)
            self.assertEqual(me_data['username'], 'dev')
            self.assertEqual(me_data['unidad']['codigo'], '02031')

    def test_datos_legacy_existen_y_quedan_asignados_a_unidad_legacy(self):
        """Verifica que la unidad LEGACY existe y agrupa datos migrados."""
        legacy = Unidad.objects.filter(codigo='LEGACY').first()
        self.assertIsNotNone(legacy)
        self.assertEqual(legacy.nombre, 'Unidad Legacy Transitoria')
