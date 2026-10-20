"""Tests de la FASE 7: Cola residual: páginas que no se pudieron agrupar.

Criterios a validar:
1. Query GraphQL `paginasSinAgrupar` devuelve páginas con `estado='sin_agrupar'` y `descartable=False` de la unidad.
2. Páginas con `descartable=True` (hojas en blanco) NO aparecen en la cola.
3. Páginas de la Unidad B no aparecen en la cola de la Unidad A.
4. Mutation `asignarPaginaATipo`: crea Documento de 1 página confirmado y marca página confirmada.
5. Mutation `crearTipoYAsignar`: crea TipoDocumento y Documento de 1 página confirmado.
6. Mutation `descartarPagina`: marca la página como descartada y descartable=True, y no vuelve a aparecer.
7. Aislamiento multi-tenant: un usuario de otra unidad no puede actuar sobre páginas ajenas (error de no encontrado).
"""

import json
import jwt
from django.conf import settings
from django.test import Client, TestCase

from apps.core.models import Unidad
from apps.documentos.models import Documento, Lote, Pagina, TipoDocumento
from apps.users.models import User


class Fase7ResidualBackendTests(TestCase):
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

        # Lotes
        self.lote_a = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="expediente_derecho.pdf",
            total_paginas=3,
            estado="pendiente_nombres",
        )
        self.lote_b = Lote.objects.create(
            unidad=self.unidad_b,
            nombre_archivo_original="expediente_medicina.pdf",
            total_paginas=1,
            estado="pendiente_nombres",
        )

        # Páginas en Unidad A
        self.pag_sin_agrupar = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            pdf_origen="expediente_derecho.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="Certificado de notas parciales borroso e ilegible con sellos",
            estado="sin_agrupar",
            descartable=False,
            firma_palabras=["certificado", "notas", "parciales", "sellos"],
        )

        self.pag_en_blanco = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            pdf_origen="expediente_derecho.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="",
            estado="sin_agrupar",
            descartable=True,  # Hoja en blanco
        )

        self.pag_confirmada = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            pdf_origen="expediente_derecho.pdf",
            nro_pagina_en_pdf=3,
            texto_ocr="Documento ya procesado y confirmado",
            estado="confirmada",
            descartable=False,
        )

        # Página en Unidad B
        self.pag_unidad_b = Pagina.objects.create(
            unidad=self.unidad_b,
            lote=self.lote_b,
            pdf_origen="expediente_medicina.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="Receta medica ilegible sin agrupar",
            estado="sin_agrupar",
            descartable=False,
        )

        # Tipo existente en Unidad A
        self.tipo_certificado = TipoDocumento.objects.create(
            unidad=self.unidad_a,
            nombre="Certificado de Calificaciones",
            slug="certificado-de-calificaciones",
            palabras_clave="certificado,calificaciones,notas",
        )

    def _post_graphql(self, query: str, variables: dict = None, token: str = None):
        headers = {}
        if token:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return self.client.post(
            "/graphql/",
            data=json.dumps({"query": query, "variables": variables or {}}),
            content_type="application/json",
            **headers,
        )

    def test_query_paginas_sin_agrupar(self):
        """Devuelve páginas sin_agrupar no descartables de la unidad del usuario."""
        query = """
        query GetResiduales {
            paginasSinAgrupar {
                id
                loteId
                loteNombre
                pdfOrigen
                nroPaginaEnPdf
                textoOcr
                estado
                descartable
            }
        }
        """
        resp = self._post_graphql(query, token=self.token_a)
        data = resp.json()

        self.assertNotIn("errors", data)
        items = data["data"]["paginasSinAgrupar"]
        self.assertEqual(len(items), 1)

        item = items[0]
        self.assertEqual(int(item["id"]), self.pag_sin_agrupar.id)
        self.assertEqual(item["loteNombre"], "expediente_derecho.pdf")
        self.assertEqual(item["estado"], "sin_agrupar")
        self.assertFalse(item["descartable"])

        # No incluye hoja en blanco descartable
        ids = [int(p["id"]) for p in items]
        self.assertNotIn(self.pag_en_blanco.id, ids)
        self.assertNotIn(self.pag_confirmada.id, ids)
        self.assertNotIn(self.pag_unidad_b.id, ids)

    def test_asignar_pagina_a_tipo(self):
        """Asigna página residual a tipo existente, creando Documento de 1 página y confirmando."""
        mutation = """
        mutation Asignar($paginaId: ID!, $tipoDocumentoId: ID!) {
            asignarPaginaATipo(paginaId: $paginaId, tipoDocumentoId: $tipoDocumentoId) {
                id
                estado
            }
        }
        """
        resp = self._post_graphql(
            mutation,
            {
                "paginaId": str(self.pag_sin_agrupar.id),
                "tipoDocumentoId": str(self.tipo_certificado.id),
            },
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)
        self.assertEqual(data["data"]["asignarPaginaATipo"]["estado"], "confirmada")

        # Verificar BD
        self.pag_sin_agrupar.refresh_from_db()
        self.assertEqual(self.pag_sin_agrupar.estado, "confirmada")

        # Se creó el Documento lógico
        doc = Documento.objects.filter(unidad=self.unidad_a, tipo_documento=self.tipo_certificado).first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.estado, "confirmado")
        self.assertFalse(doc.es_doble_cara)
        self.assertEqual(doc.nombre_final, self.tipo_certificado.nombre)
        self.assertEqual(list(doc.paginas.all()), [self.pag_sin_agrupar])

        # Ya no debe aparecer en paginasSinAgrupar
        q_resp = self._post_graphql("query { paginasSinAgrupar { id } }", token=self.token_a)
        ids_restantes = [int(p["id"]) for p in q_resp.json()["data"]["paginasSinAgrupar"]]
        self.assertNotIn(self.pag_sin_agrupar.id, ids_restantes)

    def test_crear_tipo_y_asignar(self):
        """Crea tipo nuevo en la unidad y asigna la página residual a un Documento nuevo."""
        mutation = """
        mutation CrearYAsignar($paginaId: ID!, $nombre: String!) {
            crearTipoYAsignar(paginaId: $paginaId, nombre: $nombre) {
                id
                estado
            }
        }
        """
        resp = self._post_graphql(
            mutation,
            {"paginaId": str(self.pag_sin_agrupar.id), "nombre": "Formulario de Admisión"},
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)
        self.assertEqual(data["data"]["crearTipoYAsignar"]["estado"], "confirmada")

        # Verificar que se creó el TipoDocumento en Unidad A
        nuevo_tipo = TipoDocumento.objects.filter(unidad=self.unidad_a, slug="formulario-de-admision").first()
        self.assertIsNotNone(nuevo_tipo)
        self.assertEqual(nuevo_tipo.nombre, "Formulario de Admisión")

        # Se creó el Documento
        doc = Documento.objects.filter(unidad=self.unidad_a, tipo_documento=nuevo_tipo).first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.estado, "confirmado")
        self.assertEqual(list(doc.paginas.all()), [self.pag_sin_agrupar])

    def test_descartar_pagina(self):
        """Descarta la página y no vuelve a aparecer en la cola residual."""
        mutation = """
        mutation Descartar($paginaId: ID!) {
            descartarPagina(paginaId: $paginaId) {
                id
                estado
            }
        }
        """
        resp = self._post_graphql(
            mutation,
            {"paginaId": str(self.pag_sin_agrupar.id)},
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)
        self.assertEqual(data["data"]["descartarPagina"]["estado"], "descartada")

        self.pag_sin_agrupar.refresh_from_db()
        self.assertEqual(self.pag_sin_agrupar.estado, "descartada")
        self.assertTrue(self.pag_sin_agrupar.descartable)

        # Ya no aparece en la cola
        q_resp = self._post_graphql("query { paginasSinAgrupar { id } }", token=self.token_a)
        ids_restantes = [int(p["id"]) for p in q_resp.json()["data"]["paginasSinAgrupar"]]
        self.assertNotIn(self.pag_sin_agrupar.id, ids_restantes)

    def test_aislamiento_multitenant_no_permite_actuar_sobre_otra_unidad(self):
        """Usuario de Unidad B no puede actuar sobre páginas de Unidad A (responde no encontrado / error)."""
        mutation = """
        mutation Asignar($paginaId: ID!, $tipoDocumentoId: ID!) {
            asignarPaginaATipo(paginaId: $paginaId, tipoDocumentoId: $tipoDocumentoId) {
                id
            }
        }
        """
        resp = self._post_graphql(
            mutation,
            {
                "paginaId": str(self.pag_sin_agrupar.id),
                "tipoDocumentoId": str(self.tipo_certificado.id),
            },
            token=self.token_b,  # Token de Unidad B
        )
        data = resp.json()
        self.assertIn("errors", data)
        self.assertIn("no encontrada", data["errors"][0]["message"])

        # Estado en BD intacto
        self.pag_sin_agrupar.refresh_from_db()
        self.assertEqual(self.pag_sin_agrupar.estado, "sin_agrupar")
