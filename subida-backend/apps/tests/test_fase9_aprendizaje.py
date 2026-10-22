"""Tests de la FASE 9: Aprendizaje incremental de firmas.

Criterios a validar:
1. Al confirmar un documento (Fase 5 o Fase 7), la `firma_consolidada` del tipo se actualiza.
2. Al confirmar 5 documentos del mismo tipo, la firma consolidada es coherente y acumula las palabras más frecuentes.
3. El número de `ejemplos_paginas` respeta el límite FIFO de 20 páginas.
4. El cálculo incremental es eficiente y rápido (< 200ms).
"""

import json
import time
import jwt
from django.conf import settings
from django.test import Client, TestCase

from apps.core.models import Unidad
from apps.documentos.models import Documento, Grupo, Lote, Pagina, TipoDocumento
from apps.users.models import User


class Fase9AprendizajeBackendTests(TestCase):
    def setUp(self):
        self.client = Client()

        self.unidad_a = Unidad.objects.create(codigo="02031", nombre="Carrera de Derecho")
        self.user_a = User.objects.create(
            username="operador_a",
            email="operador_a@umsa.bo",
            first_name="Juan",
            last_name="Perez",
            unidad=self.unidad_a,
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

        self.tipo_recibo = TipoDocumento.objects.create(
            unidad=self.unidad_a,
            nombre="Recibo de Caja",
            slug="recibo-de-caja",
            palabras_clave="recibo,caja",
            firma_consolidada={"palabras": ["recibo", "caja"]},
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

    def test_actualizacion_firma_al_confirmar_documentos(self):
        """Confirmar documentos actualiza progresivamente la firma consolidada."""
        lote = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="recibo_01.pdf",
            total_paginas=1,
            estado="pendiente_nombres",
        )
        pag = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="recibo_01.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="RECIBO OFICIAL DE CAJA POR CONCEPTO DE MATRICULA UNIVERSITARIA",
            estado="sin_agrupar",
            descartable=False,
            firma_palabras=["recibo", "oficial", "caja", "matricula", "universitaria"],
        )

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
            {"paginaId": str(pag.id), "tipoDocumentoId": str(self.tipo_recibo.id)},
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)

        self.tipo_recibo.refresh_from_db()
        self.assertEqual(self.tipo_recibo.ejemplos_paginas.count(), 1)
        palabras_firma = self.tipo_recibo.firma_consolidada.get("palabras", [])
        self.assertIn("recibo", palabras_firma)
        self.assertIn("matricula", palabras_firma)

    def test_confirmar_5_documentos_coherencia_y_rendimiento(self):
        """Con 5 documentos confirmados, la firma consolidada es coherente y el cálculo < 200ms."""
        tiempos = []

        for i in range(1, 6):
            lote = Lote.objects.create(
                unidad=self.unidad_a,
                nombre_archivo_original=f"recibo_lote_{i}.pdf",
                total_paginas=1,
                estado="pendiente_nombres",
            )
            pag = Pagina.objects.create(
                unidad=self.unidad_a,
                lote=lote,
                pdf_origen=f"recibo_lote_{i}.pdf",
                nro_pagina_en_pdf=1,
                texto_ocr=f"RECIBO DE CAJA COBRO ARANCEL VALORADO NUMERO {1000 + i} BOLIVIANOS MATRICULA",
                estado="sin_agrupar",
                descartable=False,
                firma_palabras=["recibo", "caja", "cobro", "arancel", "matricula", f"numero_{i}"],
            )

            t0 = time.time()
            mutation = """
            mutation Asignar($paginaId: ID!, $tipoDocumentoId: ID!) {
                asignarPaginaATipo(paginaId: $paginaId, tipoDocumentoId: $tipoDocumentoId) {
                    id
                }
            }
            """
            resp = self._post_graphql(
                mutation,
                {"paginaId": str(pag.id), "tipoDocumentoId": str(self.tipo_recibo.id)},
                token=self.token_a,
            )
            t1 = time.time()
            tiempos.append(t1 - t0)

            data = resp.json()
            self.assertNotIn("errors", data)

        self.tipo_recibo.refresh_from_db()
        # Tiene 5 ejemplos
        self.assertEqual(self.tipo_recibo.ejemplos_paginas.count(), 5)

        firma = self.tipo_recibo.firma_consolidada
        palabras = firma.get("palabras", [])

        # Palabras comunes en los 5 recibos deben liderar la firma
        self.assertIn("recibo", palabras)
        self.assertIn("caja", palabras)
        self.assertIn("matricula", palabras)

        # Rendimiento: todas las confirmaciones se procesaron en menos de 200ms
        for t in tiempos:
            self.assertLess(t, 0.2, f"Confirmación tardó {t}s, excediendo los 200ms")

    def test_limite_fifo_25_paginas_se_acota_a_20(self):
        """Al confirmar más de 20 páginas, ejemplos_paginas mantiene un máximo de 20 (FIFO)."""
        lote = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="lote_masivo.pdf",
            total_paginas=25,
            estado="pendiente_nombres",
        )

        for i in range(1, 26):
            pag = Pagina.objects.create(
                unidad=self.unidad_a,
                lote=lote,
                pdf_origen="lote_masivo.pdf",
                nro_pagina_en_pdf=i,
                texto_ocr=f"DOCUMENTO RECIBO CAJA FOLIO {i}",
                estado="sin_agrupar",
                descartable=False,
            )
            mutation = """
            mutation Asignar($paginaId: ID!, $tipoDocumentoId: ID!) {
                asignarPaginaATipo(paginaId: $paginaId, tipoDocumentoId: $tipoDocumentoId) {
                    id
                }
            }
            """
            self._post_graphql(
                mutation,
                {"paginaId": str(pag.id), "tipoDocumentoId": str(self.tipo_recibo.id)},
                token=self.token_a,
            )

        self.tipo_recibo.refresh_from_db()
        self.assertEqual(self.tipo_recibo.ejemplos_paginas.count(), 20)
