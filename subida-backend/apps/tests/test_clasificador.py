"""Clasificador local: normalizacion, fuzzy y scoring.

Es logica pura, asi que estos tests no tocan la base de datos: los tipos son
dobles con la misma forma que `TipoDocumento` (`nombre`, `palabras_clave`,
`keywords_obligatorias`).
"""

from django.test import SimpleTestCase

from apps.storage.clasificador import (
    ResultadoClasificacion,
    clasificar,
    coincide,
    estado_desde_resultado,
    normalizar,
    parsear_palabras_clave,
)


class TipoFalso:
    def __init__(self, nombre, palabras_clave, keywords_obligatorias=None):
        self.nombre = nombre
        self.palabras_clave = palabras_clave
        self.keywords_obligatorias = keywords_obligatorias or []

    def __str__(self):
        return self.nombre


CERTIFICADO = TipoFalso('Certificado de Nacimiento', 'certificado:3,nacimiento:3,partida:3')
COMPROBANTE = TipoFalso('Comprobante de Pago', 'comprobante:3,pago:3,recibo:3')
LIBRETA = TipoFalso('Libreta de Notas', 'libreta:3,notas:3,calificaciones:3')


class NormalizarTests(SimpleTestCase):

    def test_quita_acentos_y_puntuacion(self):
        self.assertEqual(normalizar('Certificado de Nacimiento'), 'certificado de nacimiento')
        self.assertEqual(normalizar('ACTA, CERTIFICADO.'), 'acta certificado')

    def test_conserva_digitos(self):
        self.assertEqual(normalizar('Total: 4.500 Bs'), 'total 4 500 bs')

    def test_colapsa_espacios(self):
        self.assertEqual(normalizar('  libreta   \n  de\n notas '), 'libreta de notas')

    def test_texto_vacio_o_nulo(self):
        self.assertEqual(normalizar(''), '')
        self.assertEqual(normalizar(None), '')

    def test_todo_puntuacion(self):
        self.assertEqual(normalizar('--- /// ...'), '')


class ParsearPalabrasClaveTests(SimpleTestCase):

    def test_formato_con_peso(self):
        self.assertEqual(
            parsear_palabras_clave('certificado:3, acta de nacimiento'),
            [('certificado', 3), ('acta de nacimiento', 1)],
        )

    def test_peso_se_acota_a_1_5(self):
        self.assertEqual(parsear_palabras_clave('a:99,b:0'), [('a', 5), ('b', 1)])

    def test_peso_ilegible_usa_el_defecto(self):
        self.assertEqual(parsear_palabras_clave('a:xyz'), [('a', 1)])

    def test_ignora_entradas_vacias(self):
        self.assertEqual(parsear_palabras_clave(' a:2 , , b:1 ,'), [('a', 2), ('b', 1)])

    def test_texto_vacio(self):
        self.assertEqual(parsear_palabras_clave(''), [])
        self.assertEqual(parsear_palabras_clave(None), [])


class CoincideTests(SimpleTestCase):

    def test_match_exacto(self):
        self.assertTrue(coincide('certificado', 'certificado de nacimiento'))

    def test_ocr_sucio(self):
        self.assertTrue(coincide('factura', 'f4ctur4 de venta'))
        self.assertTrue(coincide('total', 't0tal a pagar'))

    def test_sin_acentos(self):
        self.assertTrue(coincide('nacimiento', 'naclmiento'))

    def test_palabra_ausente(self):
        self.assertFalse(coincide('certificado', 'comprobante de pago'))

    def test_keyword_vacia(self):
        self.assertFalse(coincide('', 'cualquier cosa'))

    def test_el_guardia_de_longitud_descarta_sufijos_comunes(self):
        # Sin el guardia, 'total' puntua 80 contra 'estatal' y entraria como
        # match. El error de OCR no alarga la palabra, asi que se descarta.
        self.assertTrue(coincide('total', 'estatal total'))  # match por 'total'
        self.assertFalse(coincide('total', 'piso documental estatal'))
        self.assertFalse(coincide('factura', 'documento de manufactura'))
        self.assertFalse(coincide('notas', 'la noticia del dia'))


class KeywordCompuestaTests(SimpleTestCase):
    """Las keywords pueden ser varias palabras ('acta de nacimiento')."""

    def test_frase_exacta(self):
        tipo = TipoFalso('Acta', 'acta de nacimiento:3')
        r = clasificar('se adjunta el acta de nacimiento del menor', [tipo])
        self.assertEqual(r.tipo_ganador.nombre, 'Acta')
        self.assertEqual(r.score_ganador, 6.0)

    def test_frase_no_encaja_como_palabra_suelta(self):
        """Una frase no puede matchear contra un token suelto."""
        tipo = TipoFalso('Acta', 'acta de nacimiento:3')
        self.assertIsNone(clasificar('el acta fue firmada', [tipo]).tipo_ganador)

    def test_la_exacta_no_matchea_dentro_de_otra_palabra(self):
        tipo = TipoFalso('Pago', 'total:3')
        r = clasificar('el estado total de la cuenta', [tipo])
        self.assertIsNotNone(r)
        # 'total' esta como token propio, asi que si matchea.
        self.assertEqual(r.score_ganador, 6.0)
        # En cambio 'estatal' no debe hacer matchear 'total'.
        self.assertIsNone(clasificar('documento estatal', [tipo]).tipo_ganador)


class TextoLimpioTests(SimpleTestCase):
    """Caso 1: OCR decente, el clasificador local debe resolver solo."""

    def test_elige_el_tipo_con_mas_matchs(self):
        texto = (
            'UNIVERSIDAD NACIONAL\n'
            'CERTIFICADO DE NACIMIENTO\n'
            'La oficina de registro civil inscribe el nacimiento del menor, '
            'con la correspondiente partida de nacimiento registrada.'
        )
        r = clasificar(texto, [COMPROBANTE, CERTIFICADO, LIBRETA])
        self.assertEqual(r.tipo_ganador.nombre, 'Certificado de Nacimiento')
        self.assertTrue(r.hay_match)
        self.assertEqual(r.score_segundo, 0.0)
        self.assertFalse(r.es_dudosa)
        self.assertIn('certificado', r.keywords_matcheadas)

    def test_exacta_punta_doble_que_el_fuzzy(self):
        """Con el mismo peso, el texto limpio tiene que ganar por exacto."""
        texto = 'certificado de nacimiento'
        # certificado:3 y nacimiento:3 matchean exacto -> 2*3 + 2*3.
        r = clasificar(texto, [TipoFalso('N', 'certificado:3,nacimiento:3')])
        self.assertEqual(r.score_ganador, 12.0)

    def test_la_exacta_gana_a_la_aproximada_con_el_mismo_peso(self):
        tipo = TipoFalso('N', 'total:3')
        # 'T0tal' solo puede entrar por fuzzy (peso 3); 'total' exacto pesa 6.
        self.assertEqual(clasificar('t0tal a pagar', [tipo]).score_ganador, 3.0)
        self.assertEqual(clasificar('total a pagar', [tipo]).score_ganador, 6.0)

    def test_sin_match_devuelve_vacio(self):
        r = clasificar('documento sin relacion con nada', [CERTIFICADO])
        self.assertIsNone(r.tipo_ganador)
        self.assertFalse(r.hay_match)


class TextoSucioTests(SimpleTestCase):
    """Caso 2: OCR con errores. Antes fallaba porque el match era `substring`."""

    def test_ocr_con_digitos_por_letras(self):
        texto = 'C0MPROBANTE DE P4G0\nRECIBO N 004512 con sello de la unidad'
        r = clasificar(texto, [CERTIFICADO, COMPROBANTE])
        self.assertEqual(r.tipo_ganador.nombre, 'Comprobante de Pago')

    def test_ocr_con_acentos_perdidos(self):
        texto = 'CERTIFIC4D0 DE N4C1M1ENT0 partida de nacimiento'
        r = clasificar(texto, [CERTIFICADO, COMPROBANTE])
        self.assertEqual(r.tipo_ganador.nombre, 'Certificado de Nacimiento')

    def test_normalizacion_no_es_suficiente_por_si_sola(self):
        """Deja constancia de por que hace falta fuzzy y no solo normalizar."""
        texto = 'c0mprobante'
        self.assertNotIn('comprobante', normalizar(texto).split())
        self.assertTrue(coincide('comprobante', normalizar(texto)))


class TextoAmbiguoTests(SimpleTestCase):
    """Caso 3: dos tipos empatan. El resultado debe marcarse como dudoso."""

    def test_empate_se_marca_como_dudoso(self):
        texto = 'comprobante de pago y certificado de nacimiento'
        r = clasificar(texto, [CERTIFICADO, COMPROBANTE])
        self.assertIsNotNone(r.tipo_ganador)
        self.assertEqual(r.score_ganador, r.score_segundo)
        self.assertTrue(r.es_dudosa)

    def test_ventaja_minima_ya_no_es_dudosa(self):
        # CERTIFICADO 3+3+3=9 exacto -> 18; COMPROBANTE 3+3=6 exacto -> 12.
        # Diferencia 6 contra un margen de 0.15*18 = 2.7.
        texto = 'certificado de nacimiento partida, con un comprobante de pago'
        r = clasificar(texto, [CERTIFICADO, COMPROBANTE])
        self.assertEqual(r.tipo_ganador.nombre, 'Certificado de Nacimiento')
        self.assertEqual(r.score_ganador, 18.0)
        self.assertEqual(r.score_segundo, 12.0)
        self.assertFalse(r.es_dudosa)

    def test_ventaja_insuficiente_sigue_siendo_dudosa(self):
        # Mismos tipos pero sin 'partida': 12 contra 12, empate.
        texto = 'certificado de nacimiento y comprobante de pago'
        r = clasificar(texto, [CERTIFICADO, COMPROBANTE])
        self.assertTrue(r.es_dudosa)

    def test_desempate_es_determinista(self):
        texto = 'comprobante y pago'
        nombres = {clasificar(texto, [COMPROBANTE, LIBRETA]).tipo_ganador.nombre for _ in range(5)}
        self.assertEqual(len(nombres), 1)

    def test_sin_segundo_no_es_dudosa(self):
        r = clasificar('certificado de nacimiento', [CERTIFICADO, LIBRETA])
        self.assertEqual(r.score_segundo, 0.0)
        self.assertFalse(r.es_dudosa)


class TextoVacioTests(SimpleTestCase):
    """Caso 4: nada que clasificar."""

    def test_texto_vacio_o_solo_espacios(self):
        for texto in ['', '   ', '\n\t', None]:
            with self.subTest(texto=repr(texto)):
                r = clasificar(texto, [CERTIFICADO])
                self.assertIsNone(r.tipo_ganador)
                self.assertEqual(r.score_ganador, 0)
                self.assertEqual(r.keywords_matcheadas, [])

    def test_texto_solo_puntuacion(self):
        r = clasificar('--- ... ***', [CERTIFICADO])
        self.assertIsNone(r.tipo_ganador)

    def test_sin_tipos_que_evaluar(self):
        r = clasificar('certificado de nacimiento', [])
        self.assertIsNone(r.tipo_ganador)
        self.assertFalse(r.es_dudosa)


class GateDeObligatoriasTests(SimpleTestCase):
    """`keywords_obligatorias` descarta el tipo si alguna no matchea."""

    def test_se_descarta_el_tipo_sin_la_obligatoria(self):
        tipo = TipoFalso('Titulo', 'bachillerato:3', keywords_obligatorias=['registro oficial'])
        r = clasificar('diploma de bachillerato', [tipo])
        self.assertIsNone(r.tipo_ganador)

    def test_pasa_si_cumple_todas(self):
        tipo = TipoFalso('Titulo', 'bachillerato:3', keywords_obligatorias=['registro oficial'])
        r = clasificar('diploma bachillerato con registro oficial', [tipo])
        self.assertEqual(r.tipo_ganador.nombre, 'Titulo')

    def test_varias_obligatorias_se_evaluan_todas(self):
        tipo = TipoFalso('Titulo', 'diploma:3', keywords_obligatorias=['registro', 'oficial'])
        self.assertIsNone(clasificar('diploma con registro', [tipo]).tipo_ganador)
        self.assertIsNotNone(clasificar('diploma con registro oficial', [tipo]).tipo_ganador)


class EstadoDesdeResultadoTests(SimpleTestCase):

    def test_sin_match_es_sin_clasificar(self):
        r = ResultadoClasificacion()
        self.assertEqual(estado_desde_resultado(r), 'sin_clasificar')

    def test_match_ganador_es_clasificado(self):
        r = ResultadoClasificacion(tipo_ganador=CERTIFICADO, score_ganador=8)
        self.assertEqual(estado_desde_resultado(r), 'clasificado')

    def test_match_dudoso_es_dudosa(self):
        r = ResultadoClasificacion(tipo_ganador=CERTIFICADO, score_ganador=8, es_dudosa=True)
        self.assertEqual(estado_desde_resultado(r), 'dudosa')

    def test_tipo_explicito_tiene_precedencia(self):
        r = ResultadoClasificacion(tipo_ganador=CERTIFICADO, es_dudosa=True)
        self.assertEqual(estado_desde_resultado(r, tipo=COMPROBANTE), 'dudosa')
