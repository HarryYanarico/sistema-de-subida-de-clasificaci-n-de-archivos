"""Tests de la FASE 6: Deduplicación por pHash (perceptual hashing).

Criterios a validar:
1. Distancia de Hamming calcula correctamente diferencias de bits.
2. Cada Pagina nueva puede recibir su pHash calculado.
3. El agrupador excluye páginas con distancia Hamming <= 5 contra páginas confirmadas de la misma unidad
   y les asigna estado='duplicada'.
4. Aislamiento multi-tenant: páginas con idéntico pHash en distintas unidades NO se consideran duplicadas.
5. Thumbnails se almacenan en MinIO bajo `unidades/{codigo}/thumbs/{uuid}.png`.
6. GraphQL expone `paginasDuplicadas` filtrando por la unidad del request.
"""

import json
from unittest.mock import patch, MagicMock
import fitz
import jwt
from django.conf import settings
from django.test import Client, TestCase

from apps.core.models import Unidad
from apps.documentos import agrupador
from apps.documentos.deduplicacion import buscar_pagina_duplicada, distancia_hamming, son_duplicados
from apps.documentos.models import Lote, Pagina
from apps.storage.pdf_processor import PDFProcessor
from apps.users.models import User


class Fase6DeduplicacionBackendTests(TestCase):
    def setUp(self):
        self.client = Client()

        self.unidad_a = Unidad.objects.create(codigo="02031", nombre="Carrera de Derecho")
        self.unidad_b = Unidad.objects.create(codigo="02032", nombre="Carrera de Medicina")

        self.user_a = User.objects.create(
            username="operador_a",
            email="operador_a@umsa.bo",
            first_name="Juan",
            last_name="Perez",
            unidad=self.unidad_a,
            role="operador",
        )
        self.user_b = User.objects.create(
            username="operador_b",
            email="operador_b@umsa.bo",
            first_name="Carlos",
            last_name="Gomez",
            unidad=self.unidad_b,
            role="operador",
        )

        self.token_a = jwt.encode(
            {
                "sub": "user-a-id",
                "username": self.user_a.username,
                "email": self.user_a.email,
                "cod_unidad": self.unidad_a.codigo,
                "role": "operador",
                "iss": "admincentral",
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        self.token_b = jwt.encode(
            {
                "sub": "user-b-id",
                "username": self.user_b.username,
                "email": self.user_b.email,
                "cod_unidad": self.unidad_b.codigo,
                "role": "operador",
                "iss": "admincentral",
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )

    def test_distancia_hamming(self):
        """Calcula exactamente la cantidad de bits diferentes entre dos hashes."""
        h1 = "0000000000000000"
        h2 = "0000000000000001"  # 1 bit distinto
        h3 = "000000000000001f"  # 5 bits distintos (1f = 0001 1111)
        h4 = "000000000000003f"  # 6 bits distintos (3f = 0011 1111)

        self.assertEqual(distancia_hamming(h1, h1), 0)
        self.assertEqual(distancia_hamming(h1, h2), 1)
        self.assertTrue(son_duplicados(h1, h2, umbral=5))

        self.assertEqual(distancia_hamming(h1, h3), 5)
        self.assertTrue(son_duplicados(h1, h3, umbral=5))

        self.assertEqual(distancia_hamming(h1, h4), 6)
        self.assertFalse(son_duplicados(h1, h4, umbral=5))

        # Hashes vacíos o nulos
        self.assertEqual(distancia_hamming(None, h1), 64)
        self.assertEqual(distancia_hamming("", h1), 64)

    def test_agrupador_marca_duplicada_y_excluye(self):
        """Páginas con distancia Hamming <= 5 contra páginas confirmadas se marcan 'duplicada' y se excluyen."""
        lote = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="batch.pdf",
            total_paginas=2,
        )

        p_confirmada = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="confirmado.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="Certificado de notas del estudiante Juan Perez carrera de Derecho.",
            phash="a1b2c3d4e5f60000",
            estado="confirmada",
        )

        # Página duplicada (diferencia de 1 bit en phash)
        p_duplicada = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="batch.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="Certificado de notas del estudiante Juan Perez carrera de Derecho copia.",
            phash="a1b2c3d4e5f60001",
            estado="pendiente",
        )

        # Página nueva y diferente
        p_distinta = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="batch.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="Recibo de pago de matrícula de la universidad mayor de san andres.",
            phash="ffffffffffffffff",
            estado="pendiente",
        )

        # Ejecutar agrupar pasando p_confirmada en paginas_confirmadas
        grupos = agrupador.agrupar([p_duplicada, p_distinta], paginas_confirmadas=[p_confirmada])

        p_duplicada.refresh_from_db()
        self.assertEqual(p_duplicada.estado, "duplicada")

        # El grupo resultante sólo debe contener la página distinta
        self.assertEqual(len(grupos), 1)
        self.assertEqual(grupos[0].paginas, [p_distinta])

    def test_aislamiento_multitenant_deduplicacion(self):
        """Páginas con idéntico pHash de otra unidad NUNCA se marcan como duplicadas."""
        lote_b = Lote.objects.create(
            unidad=self.unidad_b,
            nombre_archivo_original="batch_b.pdf",
            total_paginas=1,
        )
        p_confirmada_b = Pagina.objects.create(
            unidad=self.unidad_b,
            lote=lote_b,
            pdf_origen="doc_medicina.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="Formulario oficial de inscripción facultad de medicina.",
            phash="1234567890abcdef",
            estado="confirmada",
        )

        lote_a = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="batch_a.pdf",
            total_paginas=1,
        )
        p_unidad_a = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote_a,
            pdf_origen="doc_derecho.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="Formulario oficial de inscripción facultad de derecho.",
            phash="1234567890abcdef",  # Mismo pHash pero Unidad A
            estado="pendiente",
        )

        # Agrupar p_unidad_a teniendo p_confirmada_b
        grupos = agrupador.agrupar([p_unidad_a], paginas_confirmadas=[p_confirmada_b])

        p_unidad_a.refresh_from_db()
        self.assertNotEqual(p_unidad_a.estado, "duplicada")
        self.assertEqual(len(grupos), 1)
        self.assertEqual(grupos[0].paginas, [p_unidad_a])

    def test_buscar_pagina_duplicada_en_bd(self):
        """buscar_pagina_duplicada busca únicamente en la unidad indicada y en páginas confirmadas."""
        lote_a = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="lote_a.pdf")
        lote_b = Lote.objects.create(unidad=self.unidad_b, nombre_archivo_original="lote_b.pdf")

        # Confirmada en Unidad A
        Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote_a,
            pdf_origen="conf.pdf",
            nro_pagina_en_pdf=1,
            phash="abcdef0123456789",
            estado="confirmada",
        )

        # Pendiente con mismo hash en Unidad A (no debe matchear porque no está confirmada)
        Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote_a,
            pdf_origen="pend.pdf",
            nro_pagina_en_pdf=2,
            phash="1111222233334444",
            estado="pendiente",
        )

        # Match en Unidad A
        res_a = buscar_pagina_duplicada("abcdef0123456789", unidad=self.unidad_a)
        self.assertIsNotNone(res_a)

        # Aislamiento: no hace match en Unidad B
        res_b = buscar_pagina_duplicada("abcdef0123456789", unidad=self.unidad_b)
        self.assertIsNone(res_b)

        # No hace match sobre páginas pendientes
        res_pend = buscar_pagina_duplicada("1111222233334444", unidad=self.unidad_a)
        self.assertIsNone(res_pend)

    def test_graphql_query_paginas_duplicadas(self):
        """Query paginasDuplicadas sólo retorna páginas con estado='duplicada' de la unidad autenticada."""
        lote_a = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="l_a.pdf")
        lote_b = Lote.objects.create(unidad=self.unidad_b, nombre_archivo_original="l_b.pdf")

        pag_dup_a = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote_a,
            pdf_origen="a.pdf",
            nro_pagina_en_pdf=1,
            phash="1111111111111111",
            estado="duplicada",
        )
        Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote_a,
            pdf_origen="a.pdf",
            nro_pagina_en_pdf=2,
            phash="2222222222222222",
            estado="confirmada",
        )
        pag_dup_b = Pagina.objects.create(
            unidad=self.unidad_b,
            lote=lote_b,
            pdf_origen="b.pdf",
            nro_pagina_en_pdf=1,
            phash="3333333333333333",
            estado="duplicada",
        )

        query = """
        query {
            paginasDuplicadas {
                id
                nroPaginaEnPdf
                phash
                estado
            }
        }
        """

        # Request desde Unidad A
        resp_a = self.client.post(
            "/graphql/",
            data=json.dumps({"query": query}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token_a}",
        )
        self.assertEqual(resp_a.status_code, 200)
        data_a = resp_a.json()["data"]["paginasDuplicadas"]
        self.assertEqual(len(data_a), 1)
        self.assertEqual(data_a[0]["id"], str(pag_dup_a.id))
        self.assertEqual(data_a[0]["estado"], "duplicada")

        # Request desde Unidad B
        resp_b = self.client.post(
            "/graphql/",
            data=json.dumps({"query": query}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token_b}",
        )
        self.assertEqual(resp_b.status_code, 200)
        data_b = resp_b.json()["data"]["paginasDuplicadas"]
        self.assertEqual(len(data_b), 1)
        self.assertEqual(data_b[0]["id"], str(pag_dup_b.id))

    @patch('apps.storage.pdf_processor.MinIOService')
    def test_pdf_processor_thumbnail_and_phash_generation(self, mock_minio_cls):
        """process_pdf genera miniatura a 150 DPI en unidades/{codigo}/thumbs/{uuid}.png y calcula pHash."""
        mock_storage = MagicMock()
        mock_minio_cls.return_value = mock_storage
        mock_storage.upload_pdf.return_value = "personas/P1/original/test.pdf"
        mock_storage.upload_thumbnail.side_effect = lambda cod, uid, content: f"unidades/{cod}/thumbs/{uid}.png"

        # Crear un PDF sintético de 1 página en memoria
        doc = fitz.open()
        page = doc.new_page(width=300, height=400)
        page.insert_text((50, 50), "Documento de prueba para thumbnail y phash.")
        pdf_bytes = doc.tobytes()
        doc.close()

        processor = PDFProcessor()
        results = processor.process_pdf(
            persona_codigo="P001",
            filename="test.pdf",
            file_content=pdf_bytes,
            unidad=self.unidad_a,
        )

        self.assertEqual(len(results), 1)
        res = results[0]
        self.assertIsNotNone(res["phash"])
        self.assertEqual(len(res["phash"]), 16)  # 64 bits = 16 hex chars
        self.assertIsNotNone(res["thumbnail_key"])
        self.assertTrue(res["thumbnail_key"].startswith(f"unidades/{self.unidad_a.codigo}/thumbs/"))
        self.assertTrue(res["thumbnail_key"].endswith(".png"))

        # Verificar que upload_thumbnail fue llamado con el código de unidad correcto
        mock_storage.upload_thumbnail.assert_called_once()
        args, _ = mock_storage.upload_thumbnail.call_args
        self.assertEqual(args[0], self.unidad_a.codigo)
        self.assertTrue(isinstance(args[2], bytes))
