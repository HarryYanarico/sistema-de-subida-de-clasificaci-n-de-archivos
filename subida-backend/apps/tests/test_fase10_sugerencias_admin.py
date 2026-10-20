"""Tests de la FASE 10: Sugerencias al admin (sin jerga técnica).

Criterios a validar:
1. Menos de 3 ejemplos_paginas: devuelve `suficientes_ejemplos=False` y mensaje claro.
2. Al menos 3 ejemplos_paginas: categoriza palabras en `siempre` (> 80%), `suelen` (30-80%) y `ya_no_aparecen` (< 30%).
3. Mutation `guardarPalabrasAdmin`:
   - Traduce internamente a `palabras_clave` (palabra:peso) y `keywords_obligatorias`.
   - El admin no ve ni maneja pesos ni terminología técnica.
4. Aislamiento multi-tenant:
   - Solo se pueden consultar sugerencias o actualizar tipos de la unidad del usuario (404 si es de otra unidad).
"""

import json
import jwt
from django.conf import settings
from django.test import Client, TestCase

from apps.core.models import Unidad
from apps.documentos.models import Lote, Pagina, TipoDocumento
from apps.users.models import User


class Fase10SugerenciasAdminBackendTests(TestCase):
    def setUp(self):
        self.client = Client()

        self.unidad_a = Unidad.objects.create(codigo="02031", nombre="Carrera de Derecho")
        self.unidad_b = Unidad.objects.create(codigo="02032", nombre="Carrera de Medicina")

        self.user_a = User.objects.create(
            username="admin_a",
            email="admin_a@umsa.bo",
            first_name="Admin",
            last_name="Derecho",
            unidad=self.unidad_a,
            role="admin",
        )
        self.user_b = User.objects.create(
            username="admin_b",
            email="admin_b@umsa.bo",
            first_name="Admin",
            last_name="Medicina",
            unidad=self.unidad_b,
            role="admin",
        )

        self.token_a = jwt.encode(
            {
                "sub": "admin-a-id",
                "username": self.user_a.username,
                "email": self.user_a.email,
                "cod_unidad": self.unidad_a.codigo,
                "role": "admin",
                "iss": "admincentral",
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        self.token_b = jwt.encode(
            {
                "sub": "admin-b-id",
                "username": self.user_b.username,
                "email": self.user_b.email,
                "cod_unidad": self.unidad_b.codigo,
                "role": "admin",
                "iss": "admincentral",
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )

        self.tipo_a = TipoDocumento.objects.create(
            unidad=self.unidad_a,
            nombre="Diploma de Bachiller",
            slug="diploma-de-bachiller",
            palabras_clave="diploma:3, bachiller:3, obsoleto:1",
            keywords_obligatorias=["diploma"],
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

    def test_sugerencias_con_menos_de_3_ejemplos(self):
        """Con menos de 3 ejemplos informa que aún no hay suficientes documentos."""
        query = """
        query Sugerencias($tipoId: ID!) {
            sugerenciasAdmin(tipoId: $tipoId) {
                suficientesEjemplos
                totalEjemplos
                mensaje
                siempre { palabra }
                suelen { palabra }
                yaNoAparecen { palabra }
            }
        }
        """
        resp = self._post_graphql(query, {"tipoId": str(self.tipo_a.id)}, token=self.token_a)
        data = resp.json()

        self.assertNotIn("errors", data)
        info = data["data"]["sugerenciasAdmin"]
        self.assertFalse(info["suficientesEjemplos"])
        self.assertEqual(info["totalEjemplos"], 0)
        self.assertIn("no hay suficientes", info["mensaje"].lower())

    def test_sugerencias_con_3_o_mas_ejemplos_categoriza_correctamente(self):
        """Categoriza en siempre (>80%), suelen (30-80%) y ya_no_aparecen (<30%)."""
        lote = Lote.objects.create(
            unidad=self.unidad_a,
            nombre_archivo_original="titulos.pdf",
            total_paginas=4,
            estado="confirmado",
        )

        # 4 páginas:
        # "diploma" y "bachiller" en las 4 páginas (100% -> siempre)
        # "sellos" en 2 de 4 páginas (50% -> suelen)
        # "obsoleto" en 0 páginas (0% -> yaNoAparecen)
        for i in range(1, 5):
            texto = "DIPLOMA DE BACHILLER EN HUMANIDADES REPUBLICA"
            if i in (1, 2):
                texto += " SELLOS DEPARTAMENTALES"
            pag = Pagina.objects.create(
                unidad=self.unidad_a,
                lote=lote,
                pdf_origen="titulos.pdf",
                nro_pagina_en_pdf=i,
                texto_ocr=texto,
                estado="confirmada",
                descartable=False,
            )
            self.tipo_a.ejemplos_paginas.add(pag)

        query = """
        query Sugerencias($tipoId: ID!) {
            sugerenciasAdmin(tipoId: $tipoId) {
                suficientesEjemplos
                totalEjemplos
                siempre {
                    palabra
                    esObligatoria
                    seleccionada
                }
                suelen {
                    palabra
                    esObligatoria
                    seleccionada
                }
                yaNoAparecen {
                    palabra
                    seleccionada
                }
            }
        }
        """
        resp = self._post_graphql(query, {"tipoId": str(self.tipo_a.id)}, token=self.token_a)
        data = resp.json()
        self.assertNotIn("errors", data)

        info = data["data"]["sugerenciasAdmin"]
        self.assertTrue(info["suficientesEjemplos"])
        self.assertEqual(info["totalEjemplos"], 4)

        palabras_siempre = [item["palabra"] for item in info["siempre"]]
        self.assertIn("diploma", palabras_siempre)
        self.assertIn("bachiller", palabras_siempre)

        palabras_suelen = [item["palabra"] for item in info["suelen"]]
        self.assertIn("sellos", palabras_suelen)

        palabras_ya_no = [item["palabra"] for item in info["yaNoAparecen"]]
        self.assertIn("obsoleto", palabras_ya_no)

    def test_guardar_palabras_admin(self):
        """Guarda palabras seleccionadas y obligatorias traduciéndolas internamente a pesos."""
        mutation = """
        mutation Guardar($tipoId: ID!, $seleccionadas: [String!]!, $obligatorias: [String!]!) {
            guardarPalabrasAdmin(
                tipoId: $tipoId,
                palabrasSeleccionadas: $seleccionadas,
                palabrasObligatorias: $obligatorias
            ) {
                id
                palabrasClave
                keywordsObligatorias
            }
        }
        """
        resp = self._post_graphql(
            mutation,
            {
                "tipoId": str(self.tipo_a.id),
                "seleccionadas": ["diploma", "bachiller", "ministerio"],
                "obligatorias": ["diploma"],
            },
            token=self.token_a,
        )
        data = resp.json()
        self.assertNotIn("errors", data)

        res = data["data"]["guardarPalabrasAdmin"]
        self.assertIn("diploma:5", res["palabrasClave"])
        self.assertIn("bachiller:3", res["palabrasClave"])
        self.assertEqual(res["keywordsObligatorias"], ["diploma"])

        # Verificar en BD
        self.tipo_a.refresh_from_db()
        self.assertIn("diploma:5", self.tipo_a.palabras_clave)
        self.assertEqual(self.tipo_a.keywords_obligatorias, ["diploma"])

    def test_aislamiento_multitenant(self):
        """Usuario de Unidad B no puede consultar ni modificar tipos de Unidad A."""
        query = """
        query Sugerencias($tipoId: ID!) {
            sugerenciasAdmin(tipoId: $tipoId) {
                totalEjemplos
            }
        }
        """
        resp = self._post_graphql(query, {"tipoId": str(self.tipo_a.id)}, token=self.token_b)
        data = resp.json()
        self.assertIn("errors", data)
        self.assertIn("no encontrado", data["errors"][0]["message"])
