"""Deteccion de duplicados y colas de revision (Fases 5 y 6).

La parte de deduplicacion se prueba con pHashes sinteticos: son 64 bits y la
distancia Hamming es aritmetica pura, no hace falta un PDF real. Lo que si
necesita base de datos es la parte de consulta y la de las colas.
"""

from django.test import SimpleTestCase

from apps.documentos.deduplicacion import (
    UMBRAL_HAMMING,
    buscar_duplicado,
    distancia_hamming,
    son_duplicados,
)
from apps.documentos.models import Documento
from apps.tests.datos import DatosGraphQL
from apps.tests.base import GraphQLTestCase


class DistanciaHammingTests(SimpleTestCase):
    def test_identicos_valen_cero(self):
        h = 'a3f2c1d0b5e67890'
        self.assertEqual(distancia_hamming(h, h), 0)
        self.assertTrue(son_duplicados(h, h))

    def test_calcula_los_bits_correctos(self):
        # 0 ^ f = f -> 4 bits. 1 ^ 1 = 0 -> 0 bits.
        self.assertEqual(distancia_hamming('0', 'f'), 4)
        self.assertEqual(distancia_hamming('1', '1'), 0)
        # Un bit del nibble bajo: 8 ^ 1 = 9 -> 2 bits.
        self.assertEqual(distancia_hamming('0', '1'), 1)

    def test_es_simétrica(self):
        a, b = 'deadbeefcafebabe', '0badf00d12345678'
        self.assertEqual(distancia_hamming(a, b), distancia_hamming(b, a))

    def test_no_lee_mayusculas_como_distintas(self):
        self.assertEqual(distancia_hamming('ABCDEF', 'abcdef'), 0)

    def test_un_hash_vacio_no_puede_coincidir(self):
        # Sin hash no hay nada que comparar: se devuelve la distancia maxima
        # para que nunca sea "duplicado" por accidente.
        self.assertEqual(distancia_hamming('', 'a3f2c1d0b5e67890'), 64)
        self.assertFalse(son_duplicados('', 'a3f2c1d0b5e67890'))
        self.assertFalse(son_duplicados('a3f2c1d0b5e67890', ''))
        self.assertFalse(son_duplicados(None, 'a3f2c1d0b5e67890'))

    def test_el_umbral_es_uno_estricto(self):
        # 5 bits de diferencia: duplicado. 6: ya es otra pagina.
        # 'f' son 4 bits y '1' es 1 bit -> 5 en total.
        # 'f' + '3' -> 4 + 2 = 6 bits.
        a = '0' * 16
        b5 = 'f1' + '0' * 14
        b6 = 'f3' + '0' * 14
        self.assertEqual(distancia_hamming(a, b5), UMBRAL_HAMMING)
        self.assertTrue(son_duplicados(a, b5))
        self.assertEqual(distancia_hamming(a, b6), UMBRAL_HAMMING + 1)
        self.assertFalse(son_duplicados(a, b6))

    def test_se_puede_ajustar_el_umbral(self):
        a, b = '0' * 16, 'f3' + '0' * 14
        self.assertFalse(son_duplicados(a, b))
        self.assertTrue(son_duplicados(a, b, umbral=6))


class BuscarDuplicadoTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()

    def _doc(self, phash, **kwargs):
        kwargs.setdefault('persona', self.d['persona'])
        kwargs.setdefault('archivo_original', 'originales/dup.pdf')
        kwargs.setdefault('pagina_numero', 1)
        return Documento.objects.create(phash=phash, **kwargs)

    def test_encuentra_el_original_perceptual(self):
        original = self._doc('a3f2c1d0b5e67890')
        # 3 bits de diferencia: mismo documento reescaneado.
        self.assertEqual(buscar_duplicado('a3f2c1d0b5e67888'),
                         original.id)

    def test_devuelve_none_si_no_hay_match(self):
        self._doc('a3f2c1d0b5e67890')
        self.assertIsNone(buscar_duplicado('ffffffffffffffff'))

    def test_devuelve_none_sin_hash(self):
        self._doc('a3f2c1d0b5e67890')
        self.assertIsNone(buscar_duplicado(None))
        self.assertIsNone(buscar_duplicado(''))

    def test_ignora_documentos_sin_hash(self):
        """Un historico sin pHash no puede ser el original de nadie."""
        self._doc(None)
        self.assertIsNone(buscar_duplicado('a3f2c1d0b5e67890'))

    def test_puede_excluir_un_documento(self):
        """Al recalcular el hash de un documento, no se compara consigo mismo."""
        doc = self._doc('a3f2c1d0b5e67890')
        self.assertIsNone(
            buscar_duplicado('a3f2c1d0b5e67890',
                             excluir_id=doc.id)
        )

    def test_con_varias_coincidencias_devuelve_el_primero(self):
        """El original es el que ya existia, no el que se acaba de crear."""
        original = self._doc('a3f2c1d0b5e67890')
        self._doc('a3f2c1d0b5e67891', pagina_numero=2)
        self.assertEqual(
            buscar_duplicado('a3f2c1d0b5e67890'), original.id
        )
