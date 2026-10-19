"""Tests de la FASE 4: Detección y gestión de documentos de doble cara.

Criterios a validar:
1. `detectar_parejas_consecutivas()` devuelve parejas sugeridas para páginas consecutivas
   del mismo PDF, misma unidad, similitud > 0.5 y al menos una con < 200 caracteres.
2. Páginas no consecutivas o de distintos PDFs no se emparejan.
3. Páginas de distintas unidades NUNCA se emparejan.
4. Mutation `crearDocumentoConPaginas` guarda correctamente las páginas, setea `es_doble_cara=True`
   cuando son 2 páginas y genera advertencia si son más de 2 páginas.
5. Mutation `agregarPaginaADocumento` permite agregar manualmente un reverso/página y genera
   advertencia si supera 2 páginas.
6. Mutation `quitarPaginaDeDocumento` desvincula la página y actualiza `es_doble_cara`.
7. Aislamiento estricto multi-tenant por unidad en todas las operaciones.
"""

import json
import jwt
from django.conf import settings
from django.test import Client, TestCase

from apps.core.models import Unidad
from apps.documentos import agrupador
from apps.documentos.models import Documento, Grupo, Lote, Pagina, TipoDocumento
from apps.users.models import User


class DetectarParejasConsecutivasUnitTests(TestCase):
    def setUp(self):
        self.unidad_a = Unidad.objects.create(codigo="U1001", nombre="Unidad A")
        self.unidad_b = Unidad.objects.create(codigo="U1002", nombre="Unidad B")

    def test_detecta_pareja_consecutiva_anverso_reverso(self):
        """Páginas consecutivas (1 y 2) del mismo PDF con similitud > 0.5 y una < 200 caracteres."""
        lote = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="certificado_u1.pdf", total_paginas=2)
        p1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="certificado_u1.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="CERTIFICADO DE NACIMIENTO OFICIAL REPUBLICA DE BOLIVIA REGISTRO CIVIL OFICIALIA " * 5,  # > 200 chars
        )
        p2 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="certificado_u1.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="CERTIFICADO DE NACIMIENTO OFICIAL NOTAS Y REVERSO REGISTRO",  # < 200 chars, alta similitud
        )

        agrupador.extraer_firma(p1)
        agrupador.extraer_firma(p2)

        parejas = agrupador.detectar_parejas_consecutivas([p1, p2])
        self.assertEqual(len(parejas), 1)
        self.assertEqual(parejas[0][0].id, p1.id)
        self.assertEqual(parejas[0][1].id, p2.id)

    def test_no_empareja_paginas_no_consecutivas(self):
        """Páginas 1 y 3 del mismo PDF no deben emparejarse."""
        lote = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="doc.pdf", total_paginas=2)
        p1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="doc.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="TITULO DIPLOMA ACADEMICO UNIVERSITARIO " * 4,
        )
        p3 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="doc.pdf",
            nro_pagina_en_pdf=3,
            texto_ocr="TITULO DIPLOMA ACADEMICO SELLOS",
        )
        agrupador.extraer_firma(p1)
        agrupador.extraer_firma(p3)

        parejas = agrupador.detectar_parejas_consecutivas([p1, p3])
        self.assertEqual(len(parejas), 0)

    def test_no_empareja_paginas_de_distintos_pdfs(self):
        """Páginas consecutivas en número pero de distintos archivos no se emparejan."""
        lote = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="lote.pdf", total_paginas=2)
        p1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="archivo_a.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="FACTURA DE COMPRAVENTA DE BIENES FISCAL NIT AUTORIZACION " * 4,
        )
        p2 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="archivo_b.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="FACTURA DE COMPRAVENTA DETALLE",
        )
        agrupador.extraer_firma(p1)
        agrupador.extraer_firma(p2)

        parejas = agrupador.detectar_parejas_consecutivas([p1, p2])
        self.assertEqual(len(parejas), 0)

    def test_no_empareja_si_ambas_tienen_mas_de_200_caracteres(self):
        """Si ambas páginas son documentos densos (> 200 caracteres), no son anverso/reverso simple."""
        lote = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="doc_largo.pdf", total_paginas=2)
        p1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="doc_largo.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="RESOLUCION ADMINISTRATIVA MINISTERIAL NUMERO DIEZ DEPARTAMENTO JURIDICO " * 10,
        )
        p2 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote,
            pdf_origen="doc_largo.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="RESOLUCION ADMINISTRATIVA MINISTERIAL CONSIDERANDO DISPOSICIONES FINALES " * 10,
        )
        agrupador.extraer_firma(p1)
        agrupador.extraer_firma(p2)

        parejas = agrupador.detectar_parejas_consecutivas([p1, p2])
        self.assertEqual(len(parejas), 0)

    def test_paginas_de_distintas_unidades_nunca_se_emparejan(self):
        """CRITERIO CRÍTICO: Páginas de distintas unidades NUNCA se emparejan."""
        lote_a = Lote.objects.create(unidad=self.unidad_a, nombre_archivo_original="mismo_nombre.pdf")
        lote_b = Lote.objects.create(unidad=self.unidad_b, nombre_archivo_original="mismo_nombre.pdf")

        p_u1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=lote_a,
            pdf_origen="mismo_nombre.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="CARNET DE IDENTIDAD REPUBLICA DE BOLIVIA " * 5,
        )
        p_u2 = Pagina.objects.create(
            unidad=self.unidad_b,
            lote=lote_b,
            pdf_origen="mismo_nombre.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="CARNET DE IDENTIDAD REVERSO FIRMA",
        )
        agrupador.extraer_firma(p_u1)
        agrupador.extraer_firma(p_u2)

        parejas = agrupador.detectar_parejas_consecutivas([p_u1, p_u2])
        self.assertEqual(len(parejas), 0)


class GraphQLFase4DobleCaraTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.unidad_a = Unidad.objects.create(codigo="02031", nombre="Carrera de Derecho")
        self.unidad_b = Unidad.objects.create(codigo="02032", nombre="Carrera de Medicina")

        self.user_a = User.objects.create(
            username="operador_derecho",
            email="derecho@umsa.bo",
            first_name="Juan",
            last_name="Perez",
            unidad=self.unidad_a,
            role="operador",
        )

        self.token_a = jwt.encode(
            {
                "sub": "user-derecho-id",
                "username": self.user_a.username,
                "email": self.user_a.email,
                "cod_unidad": self.unidad_a.codigo,
                "role": "operador",
                "iss": "admincentral",
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )

        self.lote_a = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="lote_derecho.pdf",
            total_paginas=4,
        )

        self.pag1 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            pdf_origen="lote_derecho.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="CERTIFICADO DE CALIFICACIONES NOTAS DERECHO " * 5,
        )
        self.pag2 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            pdf_origen="lote_derecho.pdf",
            nro_pagina_en_pdf=2,
            texto_ocr="CERTIFICADO DE CALIFICACIONES REVERSO TIMBRES",
        )
        self.pag3 = Pagina.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            pdf_origen="lote_derecho.pdf",
            nro_pagina_en_pdf=3,
            texto_ocr="ANEXO LEGAL ADICIONAL CONVALIDACION",
        )
        agrupador.extraer_firma(self.pag1)
        agrupador.extraer_firma(self.pag2)
        agrupador.extraer_firma(self.pag3)

        self.tipo_certificado = TipoDocumento.objects.create(
            unidad=self.unidad_a,
            nombre="Certificado",
            slug="certificado",
            palabras_clave="certificado,calificaciones",
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

    def test_schema_expone_parejas_sugeridas_en_lote(self):
        """Query `lote` incluye el campo `parejasSugeridas`."""
        query = """
        query GetLote($id: ID!) {
            lote(id: $id) {
                id
                parejasSugeridas {
                    paginaAnversoId
                    paginaReversoId
                }
            }
        }
        """
        resp = self._post_graphql(query, {"id": str(self.lote_a.id)}, token=self.token_a)
        data = resp.json()
        self.assertNotIn("errors", data)
        lote_data = data["data"]["lote"]
        parejas = lote_data["parejasSugeridas"]
        self.assertEqual(len(parejas), 1)
        self.assertEqual(parejas[0]["paginaAnversoId"], str(self.pag1.id))
        self.assertEqual(parejas[0]["paginaReversoId"], str(self.pag2.id))

    def test_mutation_crear_documento_con_paginas_doble_cara(self):
        """Crear documento con 2 páginas marca `es_doble_cara=True` y vincula ambas."""
        mutation = """
        mutation CrearDoc($loteId: ID!, $paginaIds: [ID!]!, $tipoDocumentoId: Int, $nombreFinal: String) {
            crearDocumentoConPaginas(
                loteId: $loteId,
                paginaIds: $paginaIds,
                tipoDocumentoId: $tipoDocumentoId,
                nombreFinal: $nombreFinal
            ) {
                success
                message
                advertencia
                documento {
                    id
                    esDobleCara
                    nombreFinal
                    totalPaginas
                    paginas {
                        id
                    }
                }
            }
        }
        """
        vars_payload = {
            "loteId": str(self.lote_a.id),
            "paginaIds": [str(self.pag1.id), str(self.pag2.id)],
            "tipoDocumentoId": self.tipo_certificado.id,
            "nombreFinal": "Certificado Calificaciones Juan",
        }
        resp = self._post_graphql(mutation, vars_payload, token=self.token_a)
        data = resp.json()
        self.assertNotIn("errors", data)
        resultado = data["data"]["crearDocumentoConPaginas"]
        self.assertTrue(resultado["success"])
        self.assertIsNone(resultado["advertencia"])

        doc_data = resultado["documento"]
        self.assertTrue(doc_data["esDobleCara"])
        self.assertEqual(doc_data["totalPaginas"], 2)
        self.assertEqual(len(doc_data["paginas"]), 2)

        # Verificar en base de datos
        doc = Documento.objects.get(id=int(doc_data["id"]))
        self.assertTrue(doc.es_doble_cara)
        self.assertEqual(doc.paginas.count(), 2)
        self.assertEqual(doc.unidad_id, self.unidad_a.id)

    def test_mutation_crear_documento_con_mas_de_dos_paginas_emite_advertencia(self):
        """Regla de negocio: crear documento con 3 páginas devuelve advertencia pero permite continuar."""
        mutation = """
        mutation CrearDoc($loteId: ID!, $paginaIds: [ID!]!) {
            crearDocumentoConPaginas(loteId: $loteId, paginaIds: $paginaIds) {
                success
                advertencia
                documento {
                    id
                    esDobleCara
                    totalPaginas
                }
            }
        }
        """
        vars_payload = {
            "loteId": str(self.lote_a.id),
            "paginaIds": [str(self.pag1.id), str(self.pag2.id), str(self.pag3.id)],
        }
        resp = self._post_graphql(mutation, vars_payload, token=self.token_a)
        data = resp.json()
        self.assertNotIn("errors", data)
        resultado = data["data"]["crearDocumentoConPaginas"]
        self.assertTrue(resultado["success"])
        self.assertIsNotNone(resultado["advertencia"])
        self.assertIn("más de 2 páginas por defecto", resultado["advertencia"])

        doc = Documento.objects.get(id=int(resultado["documento"]["id"]))
        self.assertEqual(doc.paginas.count(), 3)

    def test_agregar_y_quitar_pagina_de_documento(self):
        """Agregar manualmente un reverso/página y quitarla después."""
        # 1. Crear documento inicial de 1 página
        doc = Documento.objects.create(
            unidad=self.unidad_a,
            lote=self.lote_a,
            tipo_documento=self.tipo_certificado,
            es_doble_cara=False,
            nombre_final="Certificado Individual",
        )
        doc.paginas.add(self.pag1)
        self.assertFalse(doc.es_doble_cara)

        # 2. Agregar pag2 manualmente ("+ Agregar reverso")
        mutation_add = """
        mutation AgregarPag($documentoId: ID!, $paginaId: ID!) {
            agregarPaginaADocumento(documentoId: $documentoId, paginaId: $paginaId) {
                success
                advertencia
                documento {
                    id
                    esDobleCara
                    totalPaginas
                }
            }
        }
        """
        resp = self._post_graphql(
            mutation_add,
            {"documentoId": str(doc.id), "paginaId": str(self.pag2.id)},
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)
        res_add = data["data"]["agregarPaginaADocumento"]
        self.assertTrue(res_add["success"])
        self.assertTrue(res_add["documento"]["esDobleCara"])
        self.assertEqual(res_add["documento"]["totalPaginas"], 2)

        doc.refresh_from_db()
        self.assertTrue(doc.es_doble_cara)
        self.assertEqual(doc.paginas.count(), 2)

        # 3. Quitar pag2
        mutation_remove = """
        mutation QuitarPag($documentoId: ID!, $paginaId: ID!) {
            quitarPaginaDeDocumento(documentoId: $documentoId, paginaId: $paginaId) {
                success
                documento {
                    id
                    esDobleCara
                    totalPaginas
                }
            }
        }
        """
        resp_rem = self._post_graphql(
            mutation_remove,
            {"documentoId": str(doc.id), "paginaId": str(self.pag2.id)},
            token=self.token_a,
        )
        data_rem = resp_rem.json()
        self.assertNotIn("errors", data_rem)
        res_rem = data_rem["data"]["quitarPaginaDeDocumento"]
        self.assertTrue(res_rem["success"])
        self.assertFalse(res_rem["documento"]["esDobleCara"])
        self.assertEqual(res_rem["documento"]["totalPaginas"], 1)

        doc.refresh_from_db()
        self.assertFalse(doc.es_doble_cara)
        self.assertEqual(doc.paginas.count(), 1)

    def test_aislamiento_unidad_no_permite_emparejar_o_agregar_paginas_ajenas(self):
        """Un usuario de la unidad A no puede crear documentos con páginas de la unidad B."""
        lote_b = Lote.objects.create(unidad=self.unidad_b, nombre_archivo_original="medicina.pdf")
        pag_b = Pagina.objects.create(
            unidad=self.unidad_b,
            lote=lote_b,
            pdf_origen="medicina.pdf",
            nro_pagina_en_pdf=1,
            texto_ocr="HISTORIAL CLINICO FACULTAD DE MEDICINA",
        )

        mutation = """
        mutation CrearDoc($loteId: ID!, $paginaIds: [ID!]!) {
            crearDocumentoConPaginas(loteId: $loteId, paginaIds: $paginaIds) {
                success
                message
                documento {
                    id
                }
            }
        }
        """
        # Intento de mezclar pag1 (Unidad A) con pag_b (Unidad B) en lote_a (Unidad A)
        resp = self._post_graphql(
            mutation,
            {"loteId": str(self.lote_a.id), "paginaIds": [str(self.pag1.id), str(pag_b.id)]},
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)
        self.assertFalse(data["data"]["crearDocumentoConPaginas"]["success"])
        self.assertIn("no existen o pertenecen a otra unidad", data["data"]["crearDocumentoConPaginas"]["message"])
