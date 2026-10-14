"""Resolucion de persona en el pipeline de ingesta (single-tenant).

`Persona.codigo` es unico global. Estos tests ejercitan solo la resolucion
de persona por codigo, sin tocar MinIO.
"""

from django.test import TestCase

from apps.personas.models import Persona
from apps.storage.ingesta import resolver_persona
from apps.storage.pdf_processor import PDFProcessor

CODIGO = '310000010'


class ResolverPersonaTests(TestCase):
    def setUp(self):
        self.persona = Persona.objects.create(
            codigo=CODIGO,
            nombres='Juan', apellidos='Perez', ci='1111111',
        )

    def test_devuelve_la_persona_por_codigo(self):
        persona, codigo, error = resolver_persona(f'Documento_{CODIGO}.pdf')
        self.assertIsNone(error)
        self.assertEqual(codigo, CODIGO)
        self.assertEqual(persona.id, self.persona.id)

    def test_codigo_inexistente_devuelve_error(self):
        persona, codigo, error = resolver_persona('Documento_99999999.pdf')
        self.assertIsNone(persona)
        self.assertEqual(codigo, '99999999')
        self.assertIn('No se encontró persona', error)

    def test_nombre_invalido_devuelve_error(self):
        persona, codigo, error = resolver_persona('sin-numeros.pdf')
        self.assertIsNone(persona)
        self.assertIn('inválido', error)

    def test_nombre_con_anio_extra_resuelve_persona_correctamente(self):
        persona, codigo, error = resolver_persona(f'{CODIGO} JUAN PEREZ 2024.pdf')
        self.assertIsNone(error)
        self.assertEqual(codigo, CODIGO)
        self.assertEqual(persona.id, self.persona.id)

    def test_nombre_con_tomo_y_espacios_resuelve_persona(self):
        persona, codigo, error = resolver_persona(f'{CODIGO}_PEREZ_TOMO_1.pdf')
        self.assertIsNone(error)
        self.assertEqual(codigo, CODIGO)
        self.assertEqual(persona.id, self.persona.id)

    def test_anio_al_inicio_encuentra_persona_por_smart_matching(self):
        persona, codigo, error = resolver_persona(f'2024 - {CODIGO} JUAN PEREZ.pdf')
        self.assertIsNone(error)
        self.assertEqual(codigo, CODIGO)
        self.assertEqual(persona.id, self.persona.id)



class ResolverPersonaInternaTests(TestCase):
    def setUp(self):
        self.persona = Persona.objects.create(
            codigo=CODIGO,
            nombres='Juan', apellidos='Perez', ci='1111111',
        )

    def test_resuelve_por_codigo(self):
        self.assertEqual(
            PDFProcessor._resolver_persona(CODIGO).id,
            self.persona.id,
        )

    def test_codigo_inexistente_devuelve_none(self):
        self.assertIsNone(PDFProcessor._resolver_persona('00000000'))
