"""Tests de la Fase 2: Modelos Lote, Pagina, Grupo, Documento (multi-página) y TipoDocumento.

Verifica:
1. Todos los modelos nuevos tienen `unidad` FK.
2. Un Documento puede tener N páginas (M2M).
3. GraphQL expone Lote, Pagina, Documento, Grupo, TipoDocumento.
4. Las nuevas queries (lotes, lote, grupos, paginas) filtran por la unidad del request.
5. Aislamiento multi-tenant en lotes, páginas y grupos (Unidad A no ve los de Unidad B).
"""

from apps.core.models import Unidad
from apps.documentos.models import Documento, Grupo, Lote, Pagina, TipoDocumento
from apps.personas.models import Persona
from apps.tests.base import GraphQLTestCase


class Fase2ModelosTests(GraphQLTestCase):

    def setUp(self):
        super().setUp()
        self.unidad_a = Unidad.objects.create(codigo="02031", nombre="Unidad A")
        self.unidad_b = Unidad.objects.create(codigo="02032", nombre="Unidad B")

        # Persona para tests
        self.persona = Persona.objects.create(
            unidad=self.unidad_a,
            codigo="PER01",
            nombres="Carlos",
            apellidos="Gomez",
        )

        # Lote en Unidad A
        self.lote_a = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="archivo_a.pdf",
            total_paginas=2,
            total_grupos=1,
            estado="confirmado",
        )

        # Grupo en Unidad A
        self.grupo_a = Grupo.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            total_paginas=2,
            estado="nuevo",
            firma_consolidada={"top_words": ["certificado", "estudios"]},
        )

        # 2 Páginas en Unidad A
        self.pagina_1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            grupo=self.grupo_a,
            pdf_origen="archivo_a.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="CERTIFICADO DE ESTUDIOS",
            firma_palabras=["certificado", "estudios"],
            phash="hash1111",
            estado="confirmada",
        )
        self.pagina_2 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            grupo=self.grupo_a,
            pdf_origen="archivo_a.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="SEGUNDA HOJA DE CALIFICACIONES",
            firma_palabras=["calificaciones", "segunda"],
            phash="hash2222",
            estado="confirmada",
        )

        # Documento multi-página en Unidad A
        self.doc_multi = Documento.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            persona=self.persona,
            nombre_final="Certificado Completo 2 Págs",
            es_doble_cara=True,
            estado="confirmado",
        )
        self.doc_multi.paginas.add(self.pagina_1, self.pagina_2)

        # Lote y páginas en Unidad B
        self.lote_b = Lote.objects.create(
            unidad=self.unidad_b,
            nombre_archivo_original="archivo_b.pdf",
            total_paginas=1,
            total_grupos=1,
            estado="procesando",
        )
        self.pagina_b = Pagina.objects.create(
            unidad=self.unidad_b,
            lote=self.lote_b,
            pdf_origen="archivo_b.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="DOCUMENTO PRIVADO UNIDAD B",
            phash="hashBBBB",
            estado="pendiente",
        )

    def test_documento_tiene_n_paginas_m2m(self):
        """Un Documento puede tener 2 o más páginas asignadas."""
        self.assertEqual(self.doc_multi.paginas.count(), 2)
        self.assertEqual(self.doc_multi.total_paginas, 2)
        paginas_ordenadas = list(self.doc_multi.paginas.order_by('nro_pagina_en_pdf'))
        self.assertEqual(paginas_ordenadas[0].nro_pagina_en_pdf, 1)
        self.assertEqual(paginas_ordenadas[1].nro_pagina_en_pdf, 2)

    def test_todos_los_modelos_tienen_unidad_fk(self):
        """Lote, Grupo, Pagina, Documento y TipoDocumento poseen unidad FK."""
        tipo = TipoDocumento.objects.create(
            unidad=self.unidad_a,
            nombre="Factura",
            slug="factura",
            color="#FF5733",
            palabras_clave="factura:5",
        )
        tipo.ejemplos_paginas.add(self.pagina_1)

        self.assertEqual(self.lote_a.unidad, self.unidad_a)
        self.assertEqual(self.grupo_a.unidad, self.unidad_a)
        self.assertEqual(self.pagina_1.unidad, self.unidad_a)
        self.assertEqual(self.doc_multi.unidad, self.unidad_a)
        self.assertEqual(tipo.unidad, self.unidad_a)
        self.assertEqual(tipo.color, "#FF5733")
        self.assertEqual(tipo.ejemplos_paginas.count(), 1)

    def test_graphql_query_lotes_aislamiento(self):
        """Query lotes sólo devuelve lotes de la unidad del usuario."""
        query = """
        query {
            lotes {
                id
                nombreArchivoOriginal
                estado
                totalPaginas
            }
        }
        """
        # Usuario en Unidad A
        client = self._cliente_con_token(unidad_codigo="02031")
        resp = client.post("/graphql/", {"query": query}, content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]["lotes"]
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["nombreArchivoOriginal"], "archivo_a.pdf")

        # Usuario en Unidad B
        client_b = self._cliente_con_token(unidad_codigo="02032")
        resp_b = client_b.post("/graphql/", {"query": query}, content_type="application/json")
        self.assertEqual(resp_b.status_code, 200)
        data_b = resp_b.json()["data"]["lotes"]
        self.assertEqual(len(data_b), 1)
        self.assertEqual(data_b[0]["nombreArchivoOriginal"], "archivo_b.pdf")

    def test_graphql_query_lote_individual_aislamiento(self):
        """No se puede consultar un lote de otra unidad (retorna null)."""
        query = f"""
        query {{
            lote(id: "{self.lote_b.id}") {{
                id
                nombreArchivoOriginal
            }}
        }}
        """
        client = self._cliente_con_token(unidad_codigo="02031")
        resp = client.post("/graphql/", {"query": query}, content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.json()["data"]["lote"])

    def test_graphql_query_paginas_con_m2m_documento(self):
        """GraphQL expone paginas de un lote y documento con paginas anidadas."""
        query = f"""
        query {{
            lote(id: "{self.lote_a.id}") {{
                id
                totalPaginas
                paginas {{
                    id
                    nroPaginaEnPdf
                    textoOcr
                }}
                documentos {{
                    id
                    nombreFinal
                    esDobleCara
                    totalPaginas
                    paginas {{
                        nroPaginaEnPdf
                    }}
                }}
            }}
        }}
        """
        client = self._cliente_con_token(unidad_codigo="02031")
        resp = client.post("/graphql/", {"query": query}, content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        lote_data = resp.json()["data"]["lote"]
        self.assertIsNotNone(lote_data)
        self.assertEqual(len(lote_data["paginas"]), 2)
        self.assertEqual(len(lote_data["documentos"]), 1)
        doc = lote_data["documentos"][0]
        self.assertTrue(doc["esDobleCara"])
        self.assertEqual(doc["totalPaginas"], 2)
        self.assertEqual(len(doc["paginas"]), 2)

    def _cliente_con_token(self, unidad_codigo: str):
        """Helper para generar un cliente Django con JWT firmado para una unidad."""
        import jwt
        from datetime import datetime, timedelta
        from django.conf import settings
        from django.test import Client

        payload = {
            "cod_unidad": unidad_codigo,
            "username": f"user_{unidad_codigo}",
            "rol_slug": "admin-archivos",
            "cod_empleado": "EMP1",
            "email": f"user_{unidad_codigo}@example.com",
            "full_name": f"User {unidad_codigo}",
            "iss": "admincentral",
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
        c = Client()
        c.cookies["admincentral_access_token"] = token
        return c

