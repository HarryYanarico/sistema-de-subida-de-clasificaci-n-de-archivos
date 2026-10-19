"""Tests de la FASE 5: Confirmación de agrupamiento y persistencia transaccional.

Criterios a validar:
1. `confirmarAgrupamiento` crea `TipoDocumento` nuevos con su firma_consolidada poblada.
2. Actualiza o enlaza tipos existentes cuando se confirma coincidencia.
3. Crea `Documento` por cada grupo con sus páginas y unidad correcta.
4. Soporta documentos de doble cara (es_doble_cara=True) para grupos de 2 páginas.
5. Marca `Lote.estado='confirmado'` y grupos/páginas como 'confirmado'/'confirmada'.
6. Aislamiento multi-tenant: un usuario no puede confirmar lotes de otra unidad.
"""

import json
import jwt
from django.conf import settings
from django.test import Client, TestCase

from apps.core.models import Unidad
from apps.documentos.models import Documento, Grupo, Lote, Pagina, TipoDocumento
from apps.users.models import User


class Fase5AgrupamientoBackendTests(TestCase):
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

        # Lote en Unidad A
        self.lote_a = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="lote_subida_general.pdf",
            total_paginas=3,
            estado="pendiente_nombres",
        )

        # Grupo 1: Factura (coincide con tipo existente)
        self.tipo_factura = TipoDocumento.objects.create(
            unidad=self.unidad_a,
            nombre="Factura Comercial",
            slug="factura-comercial",
            palabras_clave="factura,comercial,nit",
            firma_consolidada={"palabras": ["factura", "comercial", "nit"]},
        )
        self.grupo1 = Grupo.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            total_paginas=1,
            firma_consolidada={"palabras": ["factura", "comercial", "nit", "monto"]},
            tipo_documento_sugerido=self.tipo_factura,
            estado="coincide_con_tipo",
        )
        self.pag1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            grupo=self.grupo1,
            pdf_origen="lote_subida_general.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="FACTURA COMERCIAL DE VENTA FISCAL NUMERO 100 NIT 12345 MONTO BS 500",
        )

        # Grupo 2: Documento nuevo de 2 páginas (anverso y reverso)
        self.grupo2 = Grupo.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            total_paginas=2,
            firma_consolidada={"palabras": ["titulo", "diploma", "rector", "bachiller"]},
            estado="nuevo",
        )
        self.pag2 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            grupo=self.grupo2,
            pdf_origen="lote_subida_general.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="TITULO DE BACHILLER EN HUMANIDADES REPUBLICA DE BOLIVIA",
        )
        self.pag3 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            grupo=self.grupo2,
            pdf_origen="lote_subida_general.pdf",
            nro_pagina_en_pdf=3,
            texto_ocr="TITULO BACHILLER SELLOS REVERSO REGISTRO",
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

    def test_confirmar_agrupamiento_exitoso(self):
        """Confirma tipos existentes, crea tipo nuevo, persiste documentos y marca lote confirmado."""
        mutation = """
        mutation Confirmar($loteId: ID!, $asignaciones: [AsignacionGrupoInput!]!) {
            confirmarAgrupamiento(loteId: $loteId, asignaciones: $asignaciones) {
                id
                estado
                documentos {
                    id
                    nombreFinal
                    esDobleCara
                    totalPaginas
                    tipoDocumento {
                        id
                        nombre
                    }
                }
            }
        }
        """
        asignaciones = [
            {
                "grupoId": str(self.grupo1.id),
                "tipoDocumentoId": self.tipo_factura.id,
                "esDobleCara": False,
            },
            {
                "grupoId": str(self.grupo2.id),
                "nombreNuevoTipo": "Título de Bachiller",
                "esDobleCara": True,
            },
        ]

        resp = self._post_graphql(mutation, {"loteId": str(self.lote_a.id), "asignaciones": asignaciones}, token=self.token_a)
        data = resp.json()
        self.assertNotIn("errors", data)
        lote_res = data["data"]["confirmarAgrupamiento"]
        self.assertEqual(lote_res["estado"], "confirmado")

        # 1. Verificar Lote en BD
        self.lote_a.refresh_from_db()
        self.assertEqual(self.lote_a.estado, "confirmado")

        # 2. Verificar que se creó el nuevo TipoDocumento con firma consolidada
        nuevo_tipo = TipoDocumento.objects.filter(unidad=self.unidad_a, slug="titulo-de-bachiller").first()
        self.assertIsNotNone(nuevo_tipo)
        self.assertEqual(nuevo_tipo.nombre, "Título de Bachiller")
        self.assertTrue(len(nuevo_tipo.firma_consolidada.get("palabras", [])) > 0)

        # 3. Verificar Documentos creados
        docs = list(Documento.objects.filter(lote=self.lote_a).order_by("id"))
        self.assertEqual(len(docs), 2)

        # Doc 1: Factura (1 página)
        doc1 = docs[0]
        self.assertEqual(doc1.tipo_documento_id, self.tipo_factura.id)
        self.assertFalse(doc1.es_doble_cara)
        self.assertEqual(doc1.paginas.count(), 1)
        self.assertEqual(doc1.estado, "confirmado")
        self.assertEqual(doc1.unidad_id, self.unidad_a.id)

        # Doc 2: Título (2 páginas, doble cara)
        doc2 = docs[1]
        self.assertEqual(doc2.tipo_documento_id, nuevo_tipo.id)
        self.assertTrue(doc2.es_doble_cara)
        self.assertEqual(doc2.paginas.count(), 2)
        self.assertEqual(doc2.estado, "confirmado")
        self.assertEqual(doc2.unidad_id, self.unidad_a.id)

        # 4. Verificar estados de páginas y grupos
        self.grupo1.refresh_from_db()
        self.grupo2.refresh_from_db()
        self.assertEqual(self.grupo1.estado, "confirmado")
        self.assertEqual(self.grupo2.estado, "confirmado")

        self.pag1.refresh_from_db()
        self.pag2.refresh_from_db()
        self.pag3.refresh_from_db()
        self.assertEqual(self.pag1.estado, "confirmada")
        self.assertEqual(self.pag2.estado, "confirmada")
        self.assertEqual(self.pag3.estado, "confirmada")

    def test_usuario_de_otra_unidad_no_puede_confirmar_lote_ajeno(self):
        """Un usuario de la Unidad B no puede confirmar un lote de la Unidad A."""
        mutation = """
        mutation Confirmar($loteId: ID!, $asignaciones: [AsignacionGrupoInput!]!) {
            confirmarAgrupamiento(loteId: $loteId, asignaciones: $asignaciones) {
                id
                estado
            }
        }
        """
        asignaciones = [
            {
                "grupoId": str(self.grupo1.id),
                "tipoDocumentoId": self.tipo_factura.id,
            }
        ]
        resp = self._post_graphql(
            mutation,
            {"loteId": str(self.lote_a.id), "asignaciones": asignaciones},
            token=self.token_b,  # Usuario de Unidad B
        )
        data = resp.json()
        # Debe fallar con error de lote no encontrado / no autorizado
        self.assertIn("errors", data)
        self.assertIn("no encontrado", data["errors"][0]["message"])

        # Verificar que el lote sigue en su estado original sin cambios
        self.lote_a.refresh_from_db()
        self.assertEqual(self.lote_a.estado, "pendiente_nombres")
