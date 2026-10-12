"""Colas de revision y correccion humana (Fase 5)."""

from apps.documentos.models import Documento, TipoDocumento
from apps.tests.base import GraphQLTestCase
from apps.tests.datos import DatosGraphQL


class ColaRevisionTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()
        self.persona = self.d['persona']

    def _doc(self, **kwargs):
        kwargs.setdefault('persona', self.persona)
        kwargs.setdefault('archivo_original', 'originales/rev.pdf')
        kwargs.setdefault('pagina_numero', 1)
        return Documento.objects.create(**kwargs)

    def _ids_de(self, raiz, **variables):
        """Ids de una cola, como strings.

        El fixture compartido deja un 'pendiente' que tambien pertenece a la
        cola `sin_clasificar`, asi que las aserciones comparan contra los ids
        que el test creo y no contra un total absoluto.
        """
        return [x['id'] for x in self.consulta(raiz, 'id', **variables)]

    # --- documentosDudosos -------------------------------------------

    def test_las_dudosas_aparecen_en_su_cola(self):
        doc = self._doc(estado='dudosa', score=4.0, texto_extraido='a')
        self.assertIn(str(doc.id), self._ids_de('documentosDudosos'))

    def test_las_dudosas_no_se_mezclan_con_las_otras_colas(self):
        dudosa = self._doc(estado='dudosa', texto_extraido='a', pagina_numero=1)
        clasificado = self._doc(estado='clasificado',
                                tipo_documento=self.d['tipo'],
                                texto_extraido='b', pagina_numero=2)
        sin_clasificar = self._doc(estado='sin_clasificar', texto_extraido='c',
                                   pagina_numero=3)
        duplicado = self._doc(estado='duplicado', texto_extraido='d', pagina_numero=4)

        cola = set(self._ids_de('documentosDudosos'))
        self.assertEqual(cola, {str(dudosa.id)})
        for ajeno in (clasificado, sin_clasificar, duplicado):
            self.assertNotIn(str(ajeno.id), cola)

    def test_las_mas_dudosas_van_primero(self):
        """Ordenar por score ascendente pone al frente lo que mas duele."""
        for i, score in enumerate([9.0, 2.0, 5.0]):
            self._doc(estado='dudosa', score=score, texto_extraido='x',
                      pagina_numero=i + 1)

        d = self.consulta('documentosDudosos', 'id score')
        self.assertEqual([x['score'] for x in d], [2.0, 5.0, 9.0])

    def test_paginacion_de_las_dudosas(self):
        for i in range(5):
            self._doc(estado='dudosa', score=float(i), texto_extraido='x',
                      pagina_numero=i + 1)

        primera = self.consulta('documentosDudosos', 'id', limit=2)
        segunda = self.consulta('documentosDudosos', 'id', limit=2, offset=2)
        self.assertEqual(len(primera), 2)
        self.assertEqual(len(segunda), 2)
        # La segunda tanda no repite la primera.
        self.assertFalse({x['id'] for x in primera} & {x['id'] for x in segunda})

    def test_sin_limit_devuelve_todo(self):
        for i in range(3):
            self._doc(estado='dudosa', score=float(i), texto_extraido='x',
                      pagina_numero=i + 1)
        self.assertEqual(len(self._ids_de('documentosDudosos')), 3)

    # --- documentosSinClasificar ------------------------------------

    def test_las_sin_clasificar_aparecen_en_su_cola(self):
        doc = self._doc(estado='sin_clasificar', texto_extraido='a', pagina_numero=1)
        self.assertIn(str(doc.id), self._ids_de('documentosSinClasificar'))

    def test_las_pendientes_tambien_entran_en_su_cola(self):
        """'pendiente' historico y 'sin_clasificar' son la misma cola de trabajo."""
        pendiente = self._doc(estado='pendiente', texto_extraido='a', pagina_numero=1)
        sin_clasificar = self._doc(estado='sin_clasificar', texto_extraido='b',
                                   pagina_numero=2)

        d = self.consulta('documentosSinClasificar', 'id estado')
        por_id = {x['id']: x['estado'] for x in d}
        self.assertEqual(por_id[str(pendiente.id)], 'pendiente')
        self.assertEqual(por_id[str(sin_clasificar.id)], 'sin_clasificar')

    def test_lo_ya_clasificado_no_entra_en_su_cola(self):
        clasificado = self._doc(estado='clasificado',
                                tipo_documento=self.d['tipo'],
                                texto_extraido='a', pagina_numero=1)
        dudosa = self._doc(estado='dudosa', tipo_documento=self.d['tipo'],
                           texto_extraido='b', pagina_numero=2)

        cola = set(self._ids_de('documentosSinClasificar'))
        self.assertNotIn(str(clasificado.id), cola)
        self.assertNotIn(str(dudosa.id), cola)

    # --- documentosDuplicados ---------------------------------------

    def test_los_duplicados_aparecen_en_su_cola(self):
        original = self.d['clasificado']
        dup = self._doc(estado='duplicado', texto_extraido='a', pagina_numero=1,
                        phash='a3f2c1d0b5e67890', duplicado_de=original)

        d = self.consulta('documentosDuplicados', 'id duplicadoDe')
        por_id = {x['id']: x for x in d}
        self.assertEqual(d[0]['id'], str(dup.id))
        self.assertEqual(por_id[str(dup.id)]['duplicadoDe'], str(original.id))

    def test_los_duplicados_no_entran_en_las_colas_de_revision(self):
        """Una copia no es trabajo pendiente: ya hay otra pagina por revisar."""
        duplicado = self._doc(estado='duplicado', texto_extraido='a',
                              pagina_numero=1, duplicado_de=self.d['clasificado'])
        cola = set(self._ids_de('documentosSinClasificar'))
        self.assertNotIn(str(duplicado.id), cola)

class ReclasificarDocumentoTests(GraphQLTestCase):
    def setUp(self):
        self.d = DatosGraphQL.crear()
        self.doc = Documento.objects.create(
            persona=self.d['persona'],
            archivo_original='originales/rev.pdf',
            pagina_numero=1,
            texto_extraido='certificado de nacimiento',
            estado='dudosa',
            score=6.0,
            keywords_matcheadas=['certificado', 'nacimiento'],
        )
        self.tipo = TipoDocumento.objects.create(
            nombre='Constancia de Estudios',
            slug='constancia-de-estudios',
            palabras_clave='constancia,estudios',
        )

    def _mutar(self, **kwargs):
        variables = {
            'documentoId': kwargs.pop('documentoId', self.doc.id),
            'tipoDocumentoId': kwargs.pop('tipoDocumentoId', self.tipo.id),
        }
        variables.update(kwargs)
        return self.mutacion(
            'reclasificarDocumento', 'success', 'message',
            'documento { id estado score keywordsMatcheadas '
            'tipoDocumento { id nombre } historialClasificacion }',
            **variables
        )

    def test_verifica_el_documento(self):
        r = self._mutar()
        self.assertIs(r['success'], True)
        self.assertEqual(r['documento']['estado'], 'verificado')
        self.assertEqual(r['documento']['tipoDocumento']['nombre'],
                         'Constancia de Estudios')

    def test_limpia_el_score_local(self):
        """'verificado' ya no lo decidio el clasificador, asi que el score sobra."""
        self._mutar()
        self.doc.refresh_from_db()
        self.assertIsNone(self.doc.score)

    def test_limpia_las_keywords_del_intento_fallido(self):
        """Dejarlas seria afirmar que el clasificador encontro esas palabras."""
        self._mutar()
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.keywords_matcheadas, [])

    def test_persiste_el_documento(self):
        self._mutar()
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.estado, 'verificado')
        self.assertEqual(self.doc.tipo_documento_id, self.tipo.id)

    def test_deja_rastro_en_el_historial(self):
        r = self._mutar()
        historial = r['documento']['historialClasificacion']
        self.assertEqual(len(historial), 1)
        entrada = historial[0]
        self.assertEqual(entrada['estado_anterior'], 'dudosa')
        self.assertEqual(entrada['tipo_nuevo'], 'Constancia de Estudios')
        self.assertEqual(entrada['score_anterior'], 6.0)
        self.assertIn('fecha', entrada)

    def test_el_historial_registra_tipo_anterior(self):
        """Saber que tipo tinha antes es la mitad del valor del log."""
        self.doc.tipo_documento = self.d['tipo']
        self.doc.save()
        r = self._mutar()
        self.assertEqual(r['documento']['historialClasificacion'][0]['tipo_anterior'],
                         'Certificado de Nacimiento')

    def test_el_historial_acepta_un_tipo_nulo_anterior(self):
        self._mutar()
        historial = self.doc.__class__.objects.get(id=self.doc.id).historial_clasificacion
        self.assertIsNone(historial[0]['tipo_anterior'])

    def test_el_historial_acumula_varias_correcciones(self):
        self._mutar()
        self.doc.refresh_from_db()
        otro = TipoDocumento.objects.create(
            nombre='Titulo', slug='titulo',
            palabras_clave='titulo',
        )
        self._mutar(tipoDocumentoId=otro.id)

        historial = Documento.objects.get(id=self.doc.id).historial_clasificacion
        self.assertEqual(len(historial), 2)
        self.assertEqual(historial[1]['tipo_anterior'], 'Constancia de Estudios')
        self.assertEqual(historial[1]['tipo_nuevo'], 'Titulo')

    def test_saca_el_duplicado_al_verificar(self):
        """Si el revisor confirma un duplicado, deja de serlo: su veredicto manda."""
        self.doc.estado = 'duplicado'
        self.doc.phash = 'a3f2c1d0b5e67890'
        self.doc.duplicado_de = self.d['clasificado']
        self.doc.save()

        self._mutar()
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.estado, 'verificado')
        self.assertIsNone(self.doc.duplicado_de)

    def test_error_si_el_documento_no_existe(self):
        r = self._mutar(documentoId=999999)
        self.assertIs(r['success'], False)
        self.assertIn('no encontrado', r['message'])

    def test_error_si_el_tipo_no_existe(self):
        r = self._mutar(tipoDocumentoId=999999)
        self.assertIs(r['success'], False)
        self.assertIn('no encontrado', r['message'])

    def test_un_documento_verificado_no_reaparece_en_las_colas(self):
        self._mutar()
        d = self.consulta('documentosDudosos', 'id')
        self.assertNotIn(str(self.doc.id), [x['id'] for x in d])
