"""Tests exhaustivos del motor de agrupamiento por firmas (sin IA) - FASE 3.

Valida:
1. `agrupador.py` no importa modelos de Django a nivel de módulo.
2. `normalizar()` limpia acentos, caracteres especiales, mayúsculas y espacios.
3. Dos páginas de factura distintas terminan en el mismo grupo.
4. Una factura y un recibo terminan en grupos distintos.
5. Páginas con len(texto_normalizado) < 10 se marcan descartable=True y no se agrupan.
6. Grupo de facturas comparado contra tipo 'Factura' devuelve el tipo.
7. Grupo de recibos comparado contra tipo 'Factura' devuelve None.
8. Páginas de dos unidades distintas nunca se agrupan juntas.
9. `agrupar()` agrupa coherentemente un lote de 20 páginas de 3 tipos distintos.
10. `comparar_con_tipos()` respeta el aislamiento por unidad.
"""

import unittest
from apps.documentos import agrupador


class MockPagina:
    """Objeto liviano duck-typed para representar una página sin base de datos."""

    def __init__(self, id: int, texto_ocr: str, unidad_id: str = "02031", phash: str = None):
        self.id = id
        self.texto_ocr = texto_ocr
        self.unidad_id = unidad_id
        self.phash = phash
        self.descartable = False
        self.firma_palabras = []
        self.firma_estructura = {}


class MockTipoDocumento:
    """Objeto liviano para representar un tipo de documento sin base de datos."""

    def __init__(self, id: int, nombre: str, slug: str, palabras_clave: str, firma_consolidada: dict = None, unidad_id: str = "02031"):
        self.id = id
        self.nombre = nombre
        self.slug = slug
        self.palabras_clave = palabras_clave
        self.firma_consolidada = firma_consolidada or {}
        self.unidad_id = unidad_id


class AgrupadorFase3Tests(unittest.TestCase):

    def test_agrupador_no_importa_modelos_de_django(self):
        """El archivo agrupador.py no debe importar modelos de Django directamente."""
        import inspect
        source = inspect.getsource(agrupador)
        self.assertNotIn("from django.db import models", source)
        self.assertNotIn("from apps.documentos.models", source)
        self.assertNotIn("from apps.personas.models", source)

    def test_normalizar_texto(self):
        """Limpia acentos, caracteres raros, mayúsculas y colapsa espacios."""
        texto = " ¡FACTURA N° 1234! -- Señor: RAMÓN PÉREZ, Monto: Bs. 450,50.   "
        resultado = agrupador.normalizar(texto)
        self.assertEqual(resultado, "factura n 1234 senor ramon perez monto bs 450 50")

    def test_hoja_en_blanco_se_marca_descartable(self):
        """Páginas con menos de 10 caracteres normalizados se marcan descartable=True y no se agrupan."""
        hoja_blanco = MockPagina(1, "   \n\t  ... ")
        firma = agrupador.extraer_firma(hoja_blanco)
        self.assertTrue(firma.descartable)
        self.assertTrue(hoja_blanco.descartable)

        hoja_corta = MockPagina(2, "Hola")
        firma_corta = agrupador.extraer_firma(hoja_corta)
        self.assertTrue(firma_corta.descartable)

        # Al agrupar, no debe generar grupos para páginas descartables
        grupos = agrupador.agrupar([hoja_blanco, hoja_corta])
        self.assertEqual(len(grupos), 0)

    def test_dos_facturas_distintas_van_al_mismo_grupo(self):
        """Dos páginas con contenido de factura deben agruparse juntas."""
        f1 = MockPagina(
            1,
            "FACTURA COMERCIAL DE VENTA N° 1001 NIT 1029384756 SEÑOR JUAN PEREZ FECHA 15/05/2026 MONTO BS. 1500.00 AUTORIZACION 987654321",
        )
        f2 = MockPagina(
            2,
            "FACTURA DE VENTA ORIGINAL N° 1002 NIT 1029384756 CLIENTE MARIA LOPEZ FECHA 18/05/2026 MONTO BS. 2300.00 AUTORIZACION 987654321",
        )
        grupos = agrupador.agrupar([f1, f2], umbral=0.55)
        self.assertEqual(len(grupos), 1)
        self.assertEqual(grupos[0].total_paginas, 2)
        self.assertIn(f1, grupos[0].paginas)
        self.assertIn(f2, grupos[0].paginas)

    def test_factura_y_recibo_van_a_grupos_distintos(self):
        """Una factura y un recibo deben separarse en grupos distintos."""
        factura = MockPagina(
            1,
            "FACTURA COMERCIAL FISCAL N° 4589 NIT 8746352011 CODIGO AUTORIZACION CUF BS. 5000 VENTA DE SUMINISTROS",
        )
        recibo = MockPagina(
            2,
            "RECIBO DE CAJA CHICA EGRESO POR CONCEPTO DE PASAJES Y VIATICOS ENTREGADO A CONDUCTOR VEHICULO FIRMA CONFORME",
        )
        grupos = agrupador.agrupar([factura, recibo], umbral=0.55)
        self.assertEqual(len(grupos), 2)
        self.assertEqual(grupos[0].total_paginas, 1)
        self.assertEqual(grupos[1].total_paginas, 1)

    def test_paginas_de_dos_unidades_distintas_nunca_se_agrupan_juntas(self):
        """Incluso si tienen texto idéntico, páginas de unidades distintas no se mezclan."""
        p_u1 = MockPagina(
            1,
            "CERTIFICADO DE NACIMIENTO OFICIAL REPUBLICA DE BOLIVIA REGISTRO CIVIL OFICIALIA FECHA",
            unidad_id="02031",
        )
        p_u2 = MockPagina(
            2,
            "CERTIFICADO DE NACIMIENTO OFICIAL REPUBLICA DE BOLIVIA REGISTRO CIVIL OFICIALIA FECHA",
            unidad_id="02032",
        )
        grupos = agrupador.agrupar([p_u1, p_u2])
        self.assertEqual(len(grupos), 2)
        unidades_grupos = {g.unidad_id for g in grupos}
        self.assertEqual(unidades_grupos, {"02031", "02032"})

    def test_comparar_con_tipos_coincidencia_y_discrepancia(self):
        """Grupo de facturas hace match con TipoDocumento Factura, pero recibo no."""
        f1 = MockPagina(1, "FACTURA ORIGINAL VENTA PRODUCTOS NIT 12345 MONTO BS 100 AUTORIZACION FECHA")
        f2 = MockPagina(2, "FACTURA DE VENTA FISCAL NIT 12345 MONTO BS 200 AUTORIZACION FECHA")
        grupos_factura = agrupador.agrupar([f1, f2])
        self.assertEqual(len(grupos_factura), 1)

        tipo_factura = MockTipoDocumento(
            id=10,
            nombre="Factura",
            slug="factura",
            palabras_clave="factura,venta,nit,autorizacion,fiscal,monto,bs",
            firma_consolidada={
                "palabras": ["factura", "venta", "nit", "autorizacion", "fiscal", "monto", "bs"],
                "estructura": {"largo": "corto", "ratio_numeros": 0.15, "patrones": ["fecha", "monto_bs", "nit"]},
            },
            unidad_id="02031",
        )

        match = agrupador.comparar_con_tipos(grupos_factura[0], [tipo_factura], umbral=0.6)
        self.assertEqual(match, tipo_factura)

        # Ahora con un grupo de recibos
        recibo = MockPagina(3, "RECIBO CAJA CHICA VIATICOS PASAJES ENTREGA EFECTIVO FIRMA")
        grupos_recibo = agrupador.agrupar([recibo])
        match_recibo = agrupador.comparar_con_tipos(grupos_recibo[0], [tipo_factura], umbral=0.6)
        self.assertIsNone(match_recibo)

    def test_comparar_con_tipos_respeta_unidad(self):
        """Un tipo de documento de la unidad B no debe asignarse a un grupo de la unidad A."""
        f1 = MockPagina(1, "FACTURA ORIGINAL VENTA NIT 12345 MONTO BS 100", unidad_id="02031")
        grupos = agrupador.agrupar([f1])

        tipo_unidad_b = MockTipoDocumento(
            id=20,
            nombre="Factura",
            slug="factura",
            palabras_clave="factura,venta,nit,monto,bs",
            firma_consolidada={"palabras": ["factura", "venta", "nit", "monto", "bs"]},
            unidad_id="02032",
        )

        match = agrupador.comparar_con_tipos(grupos[0], [tipo_unidad_b], umbral=0.5)
        self.assertIsNone(match)

    def test_agrupar_lote_20_paginas_3_tipos(self):
        """Prueba con 20 páginas de 3 tipos distintos (Facturas, Certificados, Planillas)."""
        paginas = []
        # 7 Facturas
        for i in range(7):
            paginas.append(
                MockPagina(
                    i,
                    f"FACTURA COMERCIAL DE VENTA FISCAL NUMERO {1000 + i} NIT 1029384756 CLIENTE EMPRESA "
                    f"MONTO BS {500 * (i + 1)}.00 AUTORIZACION CUF 987654321 FECHA 10/05/2026",
                )
            )
        # 7 Certificados de Estudios
        for i in range(7, 14):
            paginas.append(
                MockPagina(
                    i,
                    f"CERTIFICADO DE ESTUDIOS Y CALIFICACIONES ACADEMICAS UNIVERSIDAD REPUBLICA "
                    f"EL SUSCRITO DECANO CERTIFICA QUE EL ESTUDIANTE {i} APROBO LAS ASIGNATURAS PLAN DE ESTUDIOS",
                )
            )
        # 6 Planillas de Sueldos
        for i in range(14, 20):
            paginas.append(
                MockPagina(
                    i,
                    f"PLANILLA DE SUELDOS Y SALARIOS PERSONAL PERMANENTE MES MAYO CARGO EMPLEADO "
                    f"HABER BASICO DESCUENTO AFP APORTE CAJA NACIONAL LIQUIDO PAGABLE FIRMA PLANILLA",
                )
            )

        grupos = agrupador.agrupar(paginas, umbral=0.55)
        # Debe formar exactamente 3 grupos coherentes
        self.assertEqual(len(grupos), 3)

        # Verificar tamaños de los grupos
        tamanos = sorted([g.total_paginas for g in grupos])
        self.assertEqual(tamanos, [6, 7, 7])


if __name__ == "__main__":
    unittest.main()
