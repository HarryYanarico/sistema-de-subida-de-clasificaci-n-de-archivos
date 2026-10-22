"""Deteccion de duplicados durante la ingesta.

`apps/storage/ingesta.py` marca cada pagina como `duplicado` si ya existe otra
pagina con el mismo `pHash`. Aqui se ejercita esa rama con un `processor`
inyectado: el resto del pipeline (MinIO, PyMuPDF) queda
fuera y el test se concentra en la decision de persistencia.

Los `phash` usados son de verdad los que produce `imagehash` sobre imagenes
sinteticas, para que el umbral de `deduplicacion.py` sea el real y no una
constante inventada.
"""

from apps.documentos.models import Documento, TipoDocumento
from apps.personas.models import Persona
from apps.storage.ingesta import procesar_ingesta
from apps.tests.base import GraphQLTestCase

CODIGO = '310000011'
ARCHIVO = f'Certificado_{CODIGO}.pdf'
# (El archivo solo aporta el codigo en el nombre; el contenido va simulado.)


def _phash_de_figura(figura: str) -> str:
    """pHash real de una imagen dibujada, para no codificar hashes a mano."""
    import io

    import imagehash
    from PIL import Image, ImageDraw

    img = Image.new('L', (300, 400), 'white')
    d = ImageDraw.Draw(img)
    if figura == 'rayas':
        for y in range(0, 400, 12):
            d.line([(0, y), (300, y + 60)], fill='black', width=3)
    elif figura == 'circulos':
        for y in range(30, 400, 60):
            d.ellipse([40, y, 260, y + 45], outline='black', width=3)
    else:
        raise ValueError(figura)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return str(imagehash.phash(Image.open(buf)))


class DeteccionDuplicadosEnIngestaTests(GraphQLTestCase):
    def setUp(self):
        self.persona = Persona.objects.create(
            codigo=CODIGO,
            nombres='Juan', apellidos='Perez', ci='1111111',
        )

        self.tipo = TipoDocumento.objects.create(
            nombre='Certificado de Nacimiento',
            slug='certificado-de-nacimiento', palabras_clave='certificado,nacimiento',
        )

    def _procesar(self, hashes, persona=None):
        """Ingesta un PDF simulado cuyas paginas tienen los hashes dados."""
        paginas = [
            {
                'tipo_documento': self.tipo,
                'archivo_original': 'docs/310000011/certificado.pdf',
                'pagina_numero': i + 1,
                'texto_extraido': 'CERTIFICADO DE NACIMIENTO',
                'score': 100.0,
                'keywords_matcheadas': ['certificado'],
                'phash': h,
            }
            for i, h in enumerate(hashes)
        ]
        ok, detalle = procesar_ingesta(
            ARCHIVO, b'%PDF-1.4 falso',
            usuario=None, processor=_Processor(paginas),
        )
        self.assertTrue(ok, detalle)
        return detalle

    def test_primera_ingesta_no_marca_duplicado(self):
        self._procesar([_phash_de_figura('rayas')])

        doc = Documento.objects.get()
        self.assertIsNotNone(doc.phash)
        self.assertIsNone(doc.duplicado_de)
        self.assertNotEqual(doc.estado, 'duplicado')

    def test_misma_pagina_otra_vez_marca_duplicado_con_enlace_al_original(self):
        hash_rayas = _phash_de_figura('rayas')

        self._procesar([hash_rayas])
        original = Documento.objects.get()

        detalle = self._procesar([hash_rayas])
        self.assertEqual(detalle['duplicados'], 1)

        duplicado = Documento.objects.exclude(id=original.id).get()
        self.assertEqual(duplicado.estado, 'duplicado')
        self.assertEqual(duplicado.duplicado_de_id, original.id)
        # La segunda copia conserva su hash: por eso se puede volver a enlazar.
        self.assertEqual(duplicado.phash, original.phash)

    def test_pagina_distinta_no_se_marca_como_duplicado(self):
        self._procesar([_phash_de_figura('rayas')])
        self._procesar([_phash_de_figura('circulos')])

        self.assertEqual(Documento.objects.filter(estado='duplicado').count(), 0)
        for doc in Documento.objects.all():
            self.assertIsNone(doc.duplicado_de_id)

    def test_duplicados_dentro_del_mismo_pdf(self):
        """Las paginas repetidas dentro de un mismo archivo tambien se marcan."""
        hash_rayas = _phash_de_figura('rayas')
        detalle = self._procesar([hash_rayas, _phash_de_figura('circulos'), hash_rayas])

        self.assertEqual(detalle['paginas'], 3)
        self.assertEqual(detalle['duplicados'], 1)

        docs = list(Documento.objects.order_by('id'))
        # La tercera pagina repite la primera, no la segunda.
        self.assertEqual(docs[2].duplicado_de_id, docs[0].id)

    def test_sin_phash_no_se_rompe_la_ingesta(self):
        """Una pagina que no se pudo hashear sigue entrando como normal."""
        self._procesar([None])

        doc = Documento.objects.get()
        self.assertIsNone(doc.phash)
        self.assertIsNone(doc.duplicado_de)
        self.assertNotEqual(doc.estado, 'duplicado')

    def test_confirmar_tipo_saca_el_duplicado_de_la_cola(self):
        """La correccion humana es la via de salida de la cola de duplicados.

        Si el revisor confirma que la pagina si es el documento que esperaba,
        tiene que quedar `verificado` y sin enlace al original: si no, volveria
        a la cola en la siguiente consulta.
        """
        hash_rayas = _phash_de_figura('rayas')
        self._procesar([hash_rayas])
        self._procesar([hash_rayas])
        duplicado = Documento.objects.get(estado='duplicado')

        r = self.mutacion(
            'reclasificarDocumento', 'success', 'message',
            'documento { id estado historialClasificacion }',
            documentoId=duplicado.id, tipoDocumentoId=self.tipo.id,
        )

        self.assertIs(r['success'], True)
        self.assertEqual(r['documento']['estado'], 'verificado')
        self.assertEqual(len(r['documento']['historialClasificacion']), 1)
        self.assertEqual(r['documento']['historialClasificacion'][0]['estado_anterior'],
                         'duplicado')

        duplicado.refresh_from_db()
        self.assertIsNone(duplicado.duplicado_de_id)
        self.assertEqual(Documento.objects.filter(estado='duplicado').count(), 0)


class _Processor:
    """Doble de PDFProcessor: devuelve paginas prefabricadas, sin MinIO."""

    def __init__(self, paginas):
        self._paginas = paginas

    def process_pdf(self, persona_codigo, filename, contenido, persona=None, **kwargs):
        return list(self._paginas)


class IngestaLoteWorkflowTests(GraphQLTestCase):
    def setUp(self):
        super().setUp()
        from apps.core.models import Unidad
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.unidad = Unidad.objects.create(codigo="TEST_U", nombre="Unidad Test")
        self.user = User.objects.create_user(username="test_user", password="password")
        self.persona = Persona.objects.create(
            codigo='216013731',
            nombres='Carlos',
            apellidos='Montes',
            ci='8888888',
            unidad=self.unidad,
        )

    def test_procesar_ingesta_lote_crea_lote_y_grupos(self):
        from apps.storage.ingesta import procesar_ingesta_lote
        import fitz
        from unittest.mock import patch

        doc = fitz.open()
        p1 = doc.new_page()
        p1.insert_text((50, 50), "Certificado de notas del alumno con materias y calificaciones aprobadas")
        p2 = doc.new_page()
        p2.insert_text((50, 50), "Reverso del certificado con firmas de rectorado y sellos oficiales")
        p3 = doc.new_page()
        p3.insert_text((50, 50), "Factura de pago de matricula bolivianos monto bs 350 nit 123456789")
        pdf_bytes = doc.tobytes()
        doc.close()

        with patch('apps.storage.services.MinIOService.upload_pdf', return_value='personas/216013731/original/test.pdf'):
            ok, res = procesar_ingesta_lote(
                '216013731_documentos.pdf',
                pdf_bytes,
                usuario=self.user,
                unidad=self.unidad,
            )

        self.assertTrue(ok)
        self.assertIn('lote_id', res)
        self.assertEqual(res['persona_codigo'], '216013731')
        self.assertEqual(res['total_paginas'], 3)
        self.assertGreaterEqual(res['total_grupos'], 1)

        from apps.documentos.models import Lote, Grupo, Pagina
        lote = Lote.objects.get(id=res['lote_id'])
        self.assertEqual(lote.estado, 'pendiente_nombres')
        self.assertEqual(lote.persona, self.persona)
        self.assertEqual(lote.total_paginas, 3)
        self.assertEqual(Pagina.objects.filter(lote=lote).count(), 3)
        self.assertEqual(Grupo.objects.filter(lote=lote).count(), res['total_grupos'])
