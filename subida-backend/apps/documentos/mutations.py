import re
from typing import Optional

# pyrefly: ignore [missing-import]
import strawberry

from .models import TipoDocumento, Documento, SugerenciaKeyword, Lote, Pagina, Grupo
from .schema import TipoDocumentoType, DocumentoType, SugerenciaKeywordType, LoteType, PaginaType


def clasificar_documento(doc):
    """Reclasifica un documento con el clasificador local, filtrando por unidad.

    Delega en `apps.storage.clasificador` para que la ingesta y esta mutation
    compartan exactamente el mismo criterio: si divergen, los documentos
    reclasificados desde el admin quedan con un criterio distinto al automatico.
    """
    from apps.storage.clasificador import clasificar, estado_desde_resultado

    tipos = TipoDocumento.objects.filter(activo=True)
    if getattr(doc, 'unidad_id', None):
        tipos = tipos.filter(unidad_id=doc.unidad_id)

    resultado = clasificar(doc.texto_extraido, tipos)

    doc.tipo_documento = resultado.tipo_ganador
    doc.estado = estado_desde_resultado(resultado)
    doc.score = resultado.score_ganador or None
    doc.keywords_matcheadas = resultado.keywords_matcheadas
    doc.save()


def reclasificar_todos(unidad=None):
    # Los duplicados se saltan: reclasificarlos no cambia el hecho de que son
    # una copia, y hacerlos reaparecer en la cola seria revisar dos veces lo mismo.
    qs = Documento.objects.exclude(texto_extraido='').exclude(estado='duplicado')
    if unidad is not None:
        qs = qs.filter(unidad=unidad)
    for doc in qs:
        clasificar_documento(doc)


def registrar_reclasificacion(doc, tipo_anterior, tipo_nuevo, usuario=None):
    """Deja rastro de una correccion humana en `historial_clasificacion`.

    Es lo unico que permite reconstruir por que un documento quedo como quedo:
    el estado actual no distingue "el clasificador lo dijo" de "alguien lo confirmo".
    """
    from django.utils import timezone

    entrada = {
        'fecha': timezone.now().isoformat(),
        'usuario': getattr(usuario, 'username', None),
        'estado_anterior': doc.estado,
        'tipo_anterior': tipo_anterior.nombre if tipo_anterior else None,
        'tipo_nuevo': tipo_nuevo.nombre if tipo_nuevo else None,
        'score_anterior': doc.score,
        'keywords_anteriores': doc.keywords_matcheadas,
    }

    historial = list(doc.historial_clasificacion or [])
    historial.append(entrada)
    doc.historial_clasificacion = historial
    return entrada


def _usuario_de(info):
    """Usuario autenticado de la petición, o None si no hay usuario autenticado."""
    if info is None:
        return None

    context = getattr(info, 'context', None)
    if context is None:
        return None

    # context puede ser un objeto (StrawberryDjangoContext/HttpRequest) o un dict
    if isinstance(context, dict):
        request = context.get('request', context)
        user = context.get('user')
    else:
        request = getattr(context, 'request', context)
        user = getattr(context, 'user', None)

    if user is None:
        if isinstance(request, dict):
            user = request.get('user')
        else:
            user = getattr(request, 'user', None)

    if user is not None and getattr(user, 'is_authenticated', False):
        return user

    # Fallback directo al header Authorization: Bearer <token>
    if not isinstance(request, dict):
        meta = getattr(request, 'META', {})
        auth_header = meta.get('HTTP_AUTHORIZATION') or getattr(getattr(request, 'headers', {}), 'get', lambda k, default='': '')('Authorization', '')
        if auth_header and auth_header.startswith('Bearer '):
            from apps.users.tokens import validar_token
            return validar_token(auth_header.split(' ', 1)[1].strip())

    return None


def _limpiar_obligatorias(valores):
    """Normaliza la lista de obligatorias: strings limpios, sin vacios, sin repetidos."""
    if not valores:
        return []
    return sorted({v.strip() for v in valores if v and v.strip()})


def _slug_de(nombre):
    import unicodedata
    limpio = unicodedata.normalize('NFKD', nombre).encode('ASCII', 'ignore').decode('utf-8').lower()
    return re.sub(r'[^a-z0-9]+', '-', limpio).strip('-')


@strawberry.type
class CreateTipoDocumento:
    tipo_documento: Optional[TipoDocumentoType]
    success: bool
    message: str


@strawberry.type
class UpdateTipoDocumento:
    tipo_documento: Optional[TipoDocumentoType]
    success: bool
    message: str


@strawberry.type
class DeleteTipoDocumento:
    success: bool
    message: str


@strawberry.type
class AsignarDocumento:
    documento: Optional[DocumentoType]
    success: bool
    message: str


@strawberry.type
class ClasificarDocumento:
    documento: Optional[DocumentoType]
    success: bool
    message: str


@strawberry.type
class CrearYAsignarTipo:
    tipo_documento: Optional[TipoDocumentoType]
    documento: Optional[DocumentoType]
    success: bool
    message: str


@strawberry.type
class ReclasificarDocumento:
    documento: Optional[DocumentoType]
    success: bool
    message: str


@strawberry.type
class AceptarSugerencia:
    sugerencia: Optional[SugerenciaKeywordType]
    tipo_documento: Optional[TipoDocumentoType]
    success: bool
    message: str


@strawberry.type
class DescartarSugerencia:
    sugerencia: Optional[SugerenciaKeywordType]
    success: bool
    message: str


@strawberry.type
class GenerarSugerenciasKeywords:
    success: bool
    message: str
    total_generadas: int
    total_verificados: int


@strawberry.type
class CrearDocumentoConPaginas:
    documento: Optional[DocumentoType]
    advertencia: Optional[str]
    success: bool
    message: str


@strawberry.type
class AgregarPaginaADocumento:
    documento: Optional[DocumentoType]
    advertencia: Optional[str]
    success: bool
    message: str


@strawberry.type
class QuitarPaginaDeDocumento:
    documento: Optional[DocumentoType]
    success: bool
    message: str


@strawberry.input
class AsignacionGrupoInput:
    grupo_id: strawberry.ID
    tipo_documento_id: Optional[int] = None
    nombre_nuevo_tipo: Optional[str] = None
    es_doble_cara: Optional[bool] = None
    pagina_ids: Optional[list[strawberry.ID]] = None
    estructura_paginas: Optional[strawberry.scalars.JSON] = None
    modo_estructura: Optional[str] = None
    slots_esperados: Optional[int] = None
    esta_incompleto: Optional[bool] = None
    alerta_origen_mixto: Optional[bool] = None


@strawberry.type
class OperacionDocumentoResponse:
    success: bool
    message: str
    documento: Optional[DocumentoType] = None


@strawberry.type
class GuardarBorradorResponse:
    success: bool
    message: str


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_tipo_documento(
        self,
        info: strawberry.types.Info,
        nombre: str,
        palabras_clave: str,
        keywords_obligatorias: Optional[list[str]] = None,
    ) -> CreateTipoDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            slug = _slug_de(nombre)
            if TipoDocumento.objects.filter(slug=slug, unidad=unidad).exists():
                return CreateTipoDocumento(tipo_documento=None, success=False, message="Ya existe un tipo con ese nombre en esta unidad")
            tipo = TipoDocumento.objects.create(
                unidad=unidad,
                nombre=nombre,
                slug=slug,
                palabras_clave=palabras_clave,
                keywords_obligatorias=_limpiar_obligatorias(keywords_obligatorias),
            )
            reclasificar_todos(unidad=unidad)
            return CreateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo de documento creado")
        except Exception as e:
            return CreateTipoDocumento(tipo_documento=None, success=False, message=str(e))

    @strawberry.mutation
    def update_tipo_documento(
        self,
        info: strawberry.types.Info,
        id: int,
        nombre: Optional[str] = None,
        palabras_clave: Optional[str] = None,
        keywords_obligatorias: Optional[list[str]] = None,
        activo: Optional[bool] = None,
    ) -> UpdateTipoDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            tipo = TipoDocumento.objects.filter(id=id, unidad=unidad).first()
            if not tipo:
                return UpdateTipoDocumento(tipo_documento=None, success=False, message="Tipo no encontrado")
            if nombre is not None:
                slug = _slug_de(nombre)
                if TipoDocumento.objects.filter(slug=slug, unidad=unidad).exclude(id=id).exists():
                    return UpdateTipoDocumento(tipo_documento=None, success=False, message="Ya existe otro tipo con ese nombre en esta unidad")
                tipo.nombre = nombre
                tipo.slug = slug
            if palabras_clave is not None:
                tipo.palabras_clave = palabras_clave
            if keywords_obligatorias is not None:
                tipo.keywords_obligatorias = _limpiar_obligatorias(keywords_obligatorias)
            if activo is not None:
                tipo.activo = activo
            tipo.save()
            reclasificar_todos(unidad=unidad)
            return UpdateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo actualizado")
        except Exception as e:
            return UpdateTipoDocumento(tipo_documento=None, success=False, message=str(e))

    @strawberry.mutation
    def delete_tipo_documento(self, info: strawberry.types.Info, id: int) -> DeleteTipoDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            tipo = TipoDocumento.objects.filter(id=id, unidad=unidad).first()
            if not tipo:
                return DeleteTipoDocumento(success=False, message="Tipo no encontrado")
            Documento.objects.filter(tipo_documento=tipo, unidad=unidad).update(tipo_documento=None, estado='pendiente')
            tipo.delete()
            return DeleteTipoDocumento(success=True, message="Tipo eliminado")
        except Exception as e:
            return DeleteTipoDocumento(success=False, message=str(e))

    @strawberry.mutation
    def asignar_documento(self, info: strawberry.types.Info, documento_id: int, tipo_documento_id: int) -> AsignarDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            doc = Documento.objects.filter(id=documento_id, unidad=unidad).first()
            if not doc:
                return AsignarDocumento(documento=None, success=False, message="Documento no encontrado")
            tipo = TipoDocumento.objects.filter(id=tipo_documento_id, unidad=unidad).first()
            if not tipo:
                return AsignarDocumento(documento=None, success=False, message="Tipo de documento no encontrado")
            doc.tipo_documento = tipo
            doc.estado = 'clasificado'
            doc.save()
            return AsignarDocumento(documento=doc, success=True, message="Documento asignado correctamente")
        except Exception as e:
            return AsignarDocumento(documento=None, success=False, message=str(e))

    @strawberry.mutation
    def clasificar_documento(self, info: strawberry.types.Info, documento_id: int) -> ClasificarDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            doc = Documento.objects.filter(id=documento_id, unidad=unidad).first()
            if not doc:
                return ClasificarDocumento(documento=None, success=False, message="Documento no encontrado")

            if not doc.texto_extraido:
                return ClasificarDocumento(documento=None, success=False, message="No hay texto extraído para clasificar")

            clasificar_documento(doc)

            if doc.tipo_documento:
                return ClasificarDocumento(documento=doc, success=True, message=f"Clasificado como {doc.tipo_documento.nombre}")
            else:
                return ClasificarDocumento(documento=doc, success=False, message="No se pudo clasificar automáticamente")
        except Exception as e:
            return ClasificarDocumento(documento=None, success=False, message=str(e))

    @strawberry.mutation
    def reclasificar_documento(
        self, info: strawberry.types.Info, documento_id: int, tipo_documento_id: int
    ) -> ReclasificarDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            doc = Documento.objects.filter(id=documento_id, unidad=unidad).first()
            if not doc:
                return ReclasificarDocumento(
                    documento=None, success=False, message="Documento no encontrado")

            tipo = TipoDocumento.objects.filter(id=tipo_documento_id, unidad=unidad).first()
            if not tipo:
                return ReclasificarDocumento(
                    documento=None, success=False, message="Tipo de documento no encontrado")

            usuario = _usuario_de(info)

            registrar_reclasificacion(doc, doc.tipo_documento, tipo, usuario)

            doc.tipo_documento = tipo
            doc.estado = 'verificado'
            doc.score = None
            doc.keywords_matcheadas = []
            doc.duplicado_de = None
            doc.save()

            return ReclasificarDocumento(
                documento=doc, success=True,
                message=f"Verificado como {tipo.nombre}")
        except Exception as e:
            return ReclasificarDocumento(
                documento=None, success=False, message=str(e))

    @strawberry.mutation
    def crear_y_asignar_tipo(self, info: strawberry.types.Info, documento_id: int, nombre: str, palabras_clave: str) -> CrearYAsignarTipo:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            doc = Documento.objects.filter(id=documento_id, unidad=unidad).first()
            if not doc:
                return CrearYAsignarTipo(
                    tipo_documento=None, documento=None, success=False, message="Documento no encontrado"
                )

            slug = _slug_de(nombre)

            tipo = TipoDocumento.objects.filter(slug=slug, unidad=unidad).first()
            if not tipo:
                tipo = TipoDocumento.objects.create(
                    unidad=unidad,
                    nombre=nombre,
                    slug=slug,
                    palabras_clave=palabras_clave,
                )
                reclasificar_todos(unidad=unidad)

            doc.tipo_documento = tipo
            doc.estado = 'clasificado'
            doc.save()

            return CrearYAsignarTipo(
                tipo_documento=tipo,
                documento=doc,
                success=True,
                message=f"Tipo '{nombre}' creado y documento asignado correctamente",
            )
        except Exception as e:
            return CrearYAsignarTipo(tipo_documento=None, documento=None, success=False, message=str(e))

    @strawberry.mutation
    def aceptar_sugerencia(self, info: strawberry.types.Info, id: int, peso: int = 1) -> AceptarSugerencia:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            sug = SugerenciaKeyword.objects.filter(id=id, tipo_documento__unidad=unidad).first()
            if not sug:
                return AceptarSugerencia(
                    sugerencia=None, tipo_documento=None, success=False, message="Sugerencia no encontrada"
                )

            peso_acotado = max(1, min(5, int(peso)))
            tipo = sug.tipo_documento

            from apps.storage.clasificador import parsear_palabras_clave
            actuales = parsear_palabras_clave(tipo.palabras_clave)
            palabras_dict = {p: w for p, w in actuales}
            palabras_dict[sug.palabra] = peso_acotado
            tipo.palabras_clave = ', '.join(f"{p}:{w}" for p, w in palabras_dict.items())
            tipo.save()

            sug.aceptada = True
            sug.save()

            return AceptarSugerencia(
                sugerencia=sug,
                tipo_documento=tipo,
                success=True,
                message=f"Palabra '{sug.palabra}' agregada con peso {peso_acotado}",
            )
        except Exception as e:
            return AceptarSugerencia(sugerencia=None, tipo_documento=None, success=False, message=str(e))

    @strawberry.mutation
    def descartar_sugerencia(self, info: strawberry.types.Info, id: int) -> DescartarSugerencia:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            sug = SugerenciaKeyword.objects.filter(id=id, tipo_documento__unidad=unidad).first()
            if not sug:
                return DescartarSugerencia(sugerencia=None, success=False, message="Sugerencia no encontrada")
            sug.aceptada = False
            sug.save()
            return DescartarSugerencia(sugerencia=sug, success=True, message="Sugerencia descartada")
        except Exception as e:
            return DescartarSugerencia(sugerencia=None, success=False, message=str(e))

    @strawberry.mutation
    def generar_sugerencias_keywords(
        self, info: strawberry.types.Info, min_docs: int = 5, top: int = 5, limpiar: bool = False
    ) -> GenerarSugerenciasKeywords:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            from .services import generar_sugerencias_keywords
            res = generar_sugerencias_keywords(min_docs=min_docs, top=top, limpiar=limpiar, unidad=unidad)
            return GenerarSugerenciasKeywords(
                success=res['success'],
                message=res['message'],
                total_generadas=res['total_generadas'],
                total_verificados=res['total_verificados'],
            )
        except Exception as e:
            return GenerarSugerenciasKeywords(
                success=False,
                message=f"Error al generar sugerencias: {str(e)}",
                total_generadas=0,
                total_verificados=0,
            )

    @strawberry.mutation
    def crear_documento_con_paginas(
        self,
        info: strawberry.types.Info,
        lote_id: strawberry.ID,
        pagina_ids: list[strawberry.ID],
        tipo_documento_id: Optional[int] = None,
        nombre_final: Optional[str] = None,
        es_doble_cara: Optional[bool] = None,
    ) -> CrearDocumentoConPaginas:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            lote = Lote.objects.filter(id=lote_id, unidad=unidad).first()
            if not lote:
                return CrearDocumentoConPaginas(
                    documento=None, advertencia=None, success=False, message="Lote no encontrado o acceso no autorizado"
                )

            clean_ids = [int(str(pid)) for pid in pagina_ids]
            paginas = list(Pagina.objects.filter(id__in=clean_ids, unidad=unidad).order_by('nro_pagina_en_pdf'))
            if len(paginas) != len(clean_ids):
                return CrearDocumentoConPaginas(
                    documento=None, advertencia=None, success=False, message="Una o más páginas no existen o pertenecen a otra unidad"
                )

            tipo_doc = None
            if tipo_documento_id:
                tipo_doc = TipoDocumento.objects.filter(id=tipo_documento_id, unidad=unidad).first()

            es_doble = bool(es_doble_cara) if es_doble_cara is not None else (len(paginas) == 2)
            advertencia = None
            if len(paginas) > 2:
                advertencia = f"El documento tiene más de 2 páginas por defecto ({len(paginas)} páginas asignadas)"

            nombre = (nombre_final or '').strip()
            if not nombre and tipo_doc:
                nombre = tipo_doc.nombre
            elif not nombre:
                nombre = lote.nombre_archivo_original

            doc = Documento.objects.create(
                unidad=unidad,
                lote=lote,
                tipo_documento=tipo_doc,
                es_doble_cara=es_doble,
                nombre_final=nombre,
                estado='pendiente',
            )
            doc.paginas.set(paginas)

            for p in paginas:
                p.estado = 'confirmada'
                p.save(update_fields=['estado'])

            return CrearDocumentoConPaginas(
                documento=doc,
                advertencia=advertencia,
                success=True,
                message="Documento creado exitosamente con sus páginas",
            )
        except Exception as e:
            return CrearDocumentoConPaginas(
                documento=None, advertencia=None, success=False, message=str(e)
            )

    @strawberry.mutation
    def agregar_pagina_a_documento(
        self,
        info: strawberry.types.Info,
        documento_id: strawberry.ID,
        pagina_id: strawberry.ID,
    ) -> AgregarPaginaADocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            doc = Documento.objects.filter(id=documento_id, unidad=unidad).first()
            if not doc:
                return AgregarPaginaADocumento(
                    documento=None, advertencia=None, success=False, message="Documento no encontrado o no pertenece a la unidad"
                )

            pagina = Pagina.objects.filter(id=pagina_id, unidad=unidad).first()
            if not pagina:
                return AgregarPaginaADocumento(
                    documento=None, advertencia=None, success=False, message="Página no encontrada o no pertenece a la unidad"
                )

            if doc.paginas.filter(id=pagina.id).exists():
                return AgregarPaginaADocumento(
                    documento=doc, advertencia=None, success=False, message="La página ya está vinculada a este documento"
                )

            doc.paginas.add(pagina)
            total = doc.paginas.count()
            doc.es_doble_cara = (total >= 2)
            doc.save(update_fields=['es_doble_cara'])

            pagina.estado = 'confirmada'
            pagina.save(update_fields=['estado'])

            advertencia = None
            if total > 2:
                advertencia = f"El documento tiene más de 2 páginas por defecto ({total} páginas asignadas)"

            return AgregarPaginaADocumento(
                documento=doc,
                advertencia=advertencia,
                success=True,
                message="Página agregada al documento exitosamente",
            )
        except Exception as e:
            return AgregarPaginaADocumento(
                documento=None, advertencia=None, success=False, message=str(e)
            )

    @strawberry.mutation
    def quitar_pagina_de_documento(
        self,
        info: strawberry.types.Info,
        documento_id: strawberry.ID,
        pagina_id: strawberry.ID,
    ) -> QuitarPaginaDeDocumento:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            doc = Documento.objects.filter(id=documento_id, unidad=unidad).first()
            if not doc:
                return QuitarPaginaDeDocumento(
                    documento=None, success=False, message="Documento no encontrado o no pertenece a la unidad"
                )

            pagina = Pagina.objects.filter(id=pagina_id, unidad=unidad).first()
            if not pagina:
                return QuitarPaginaDeDocumento(
                    documento=None, success=False, message="Página no encontrada o no pertenece a la unidad"
                )

            if not doc.paginas.filter(id=pagina.id).exists():
                return QuitarPaginaDeDocumento(
                    documento=doc, success=False, message="La página no pertenece a este documento"
                )

            doc.paginas.remove(pagina)
            total = doc.paginas.count()
            doc.es_doble_cara = (total == 2)
            doc.save(update_fields=['es_doble_cara'])

            pagina.estado = 'pendiente'
            pagina.save(update_fields=['estado'])

            return QuitarPaginaDeDocumento(
                documento=doc,
                success=True,
                message="Página removida del documento exitosamente",
            )
        except Exception as e:
            return QuitarPaginaDeDocumento(
                documento=None, success=False, message=str(e)
            )

    @strawberry.mutation
    def confirmar_agrupamiento(
        self,
        info: strawberry.types.Info,
        lote_id: strawberry.ID,
        asignaciones: list[AsignacionGrupoInput],
    ) -> LoteType:
        from django.db import transaction
        from apps.core.tenancy import get_unidad_from_info

        unidad = get_unidad_from_info(info)
        if not unidad:
            raise PermissionError("Usuario no autenticado o unidad no válida")

        lote = Lote.objects.filter(id=int(str(lote_id)), unidad=unidad).first()
        if not lote:
            raise ValueError(f"Lote {lote_id} no encontrado en la unidad actual")

        with transaction.atomic():
            for asig in asignaciones:
                grupo = None
                if str(asig.grupo_id).isdigit():
                    grupo = Grupo.objects.filter(id=int(str(asig.grupo_id)), lote=lote, unidad=unidad).first()

                # Prioridad a las páginas exactas enviadas por el frontend
                if asig.pagina_ids:
                    clean_pids = [int(str(pid)) for pid in asig.pagina_ids]
                    pags_dict = {p.id: p for p in Pagina.objects.filter(id__in=clean_pids, unidad=unidad)}
                    pags_grupo = [pags_dict[pid] for pid in clean_pids if pid in pags_dict]
                elif grupo:
                    pags_grupo = list(grupo.paginas.all().order_by('nro_pagina_en_pdf'))
                else:
                    pags_grupo = []

                if not pags_grupo:
                    continue

                tipo = None
                if asig.tipo_documento_id:
                    tipo = TipoDocumento.objects.filter(id=asig.tipo_documento_id, unidad=unidad).first()
                    if tipo and not tipo.firma_consolidada and grupo and grupo.firma_consolidada:
                        tipo.firma_consolidada = grupo.firma_consolidada
                        tipo.save(update_fields=['firma_consolidada'])
                elif asig.nombre_nuevo_tipo and asig.nombre_nuevo_tipo.strip():
                    nombre_tipo = asig.nombre_nuevo_tipo.strip()
                    slug_tipo = _slug_de(nombre_tipo)
                    tipo = TipoDocumento.objects.filter(slug=slug_tipo, unidad=unidad).first()
                    if not tipo:
                        from .agrupador import _obtener_palabras
                        firma_init = (grupo.firma_consolidada if grupo else None) or {}
                        palabras = _obtener_palabras(firma_init) if firma_init else []
                        palabras_str = ', '.join(palabras[:10]) if palabras else nombre_tipo.lower()
                        tipo = TipoDocumento.objects.create(
                            unidad=unidad,
                            nombre=nombre_tipo,
                            slug=slug_tipo,
                            palabras_clave=palabras_str,
                            firma_consolidada=firma_init,
                            color="#4F46E5",
                        )
                        tipo.ejemplos_paginas.set(pags_grupo[:20])

                nombre_final_doc = tipo.nombre if tipo else (lote.nombre_archivo_original or f"Documento")
                es_doble = bool(asig.es_doble_cara) if asig.es_doble_cara is not None else (len(pags_grupo) == 2)

                archivo_origen = pags_grupo[0].pdf_origen if (pags_grupo and getattr(pags_grupo[0], 'pdf_origen', None)) else lote.nombre_archivo_original
                p_num = pags_grupo[0].nro_pagina_en_pdf if pags_grupo else 1
                p_hash = pags_grupo[0].phash if pags_grupo else None
                txt_extraido = '\n'.join(p.texto_ocr for p in pags_grupo if p.texto_ocr)

                if asig.estructura_paginas and isinstance(asig.estructura_paginas, list):
                    orden_dict = {}
                    for idx, item in enumerate(asig.estructura_paginas):
                        if isinstance(item, dict) and 'pagina_id' in item:
                            try:
                                orden_dict[int(item['pagina_id'])] = item.get('orden', idx + 1)
                            except (ValueError, TypeError):
                                pass
                    pags_grupo.sort(key=lambda p: orden_dict.get(p.id, 999))

                es_incompleto = bool(asig.esta_incompleto)
                if asig.modo_estructura == 'ANVERSO_REVERSO' and len(pags_grupo) < 2:
                    es_incompleto = True
                elif asig.slots_esperados and len(pags_grupo) < asig.slots_esperados:
                    es_incompleto = True

                estado_doc = 'incompleto' if es_incompleto else 'confirmado'

                historial = []
                if asig.estructura_paginas:
                    historial.append({'accion': 'estructura_caras', 'detalle': asig.estructura_paginas})
                if asig.alerta_origen_mixto:
                    historial.append({'accion': 'alerta_origen_mixto', 'detalle': 'Páginas provienen de PDFs distintos confirmadas por el usuario'})
                if es_incompleto:
                    historial.append({'accion': 'estado_incompleto', 'motivo': 'Documento confirmado con slots vacíos o incompletos'})

                doc = Documento.objects.create(
                    unidad=unidad,
                    lote=lote,
                    persona=getattr(lote, 'persona', None),
                    tipo_documento=tipo,
                    es_doble_cara=es_doble,
                    nombre_final=nombre_final_doc,
                    estado=estado_doc,
                    archivo_original=archivo_origen,
                    subido_por=lote.subido_por,
                    pagina_numero=p_num,
                    texto_extraido=txt_extraido,
                    phash=p_hash,
                    historial_clasificacion=historial,
                )
                doc.paginas.set(pags_grupo)

                # Compilar PDF único con las páginas asociadas en MinIO
                try:
                    import fitz
                    from apps.storage.services import MinIOService
                    storage = MinIOService()
                    nuevo_pdf = fitz.open()

                    for p in pags_grupo:
                        if getattr(p, 'pdf_origen', None):
                            pdf_bytes = storage.get_file(p.pdf_origen)
                            src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                            p_idx = (p.nro_pagina_en_pdf or 1) - 1
                            if 0 <= p_idx < len(src_doc):
                                nuevo_pdf.insert_pdf(src_doc, from_page=p_idx, to_page=p_idx)
                            src_doc.close()

                    if len(nuevo_pdf) > 0:
                        compilado_bytes = nuevo_pdf.tobytes()
                        cod_folder = getattr(getattr(lote, 'persona', None), 'codigo', None) or f"unidad_{getattr(unidad, 'codigo', 'general')}"
                        nombre_pdf_salida = f"doc_{doc.id}_{tipo.slug if tipo else 'general'}.pdf"
                        key_compilado = storage.upload_pdf(cod_folder, nombre_pdf_salida, compilado_bytes)
                        doc.archivo_original = key_compilado
                        doc.save(update_fields=['archivo_original'])
                    nuevo_pdf.close()
                except Exception:
                    pass

                for p in pags_grupo:
                    p.estado = 'confirmada'
                    if grupo:
                        p.grupo = grupo
                        p.save(update_fields=['estado', 'grupo'])
                    else:
                        p.save(update_fields=['estado'])

                if tipo and pags_grupo:
                    from .agrupador import actualizar_firma_tipo_documento
                    actualizar_firma_tipo_documento(tipo, pags_grupo)

                if grupo:
                    grupo.estado = 'confirmado'
                    if tipo:
                        grupo.tipo_documento_sugerido = tipo
                    grupo.save(update_fields=['estado', 'tipo_documento_sugerido'])

            lote.estado = 'confirmado'
            lote.save(update_fields=['estado'])

        return lote

    @strawberry.mutation
    def asignar_pagina_a_tipo(
        self,
        info: strawberry.types.Info,
        pagina_id: strawberry.ID,
        tipo_documento_id: strawberry.ID,
    ) -> PaginaType:
        from django.db import transaction
        from apps.core.tenancy import get_unidad_from_info

        unidad = get_unidad_from_info(info)
        if not unidad:
            raise PermissionError("Usuario no autenticado o unidad no válida")

        pagina = Pagina.objects.filter(id=int(str(pagina_id)), unidad=unidad).first()
        if not pagina:
            raise ValueError(f"Página {pagina_id} no encontrada en la unidad actual")

        tipo = TipoDocumento.objects.filter(id=int(str(tipo_documento_id)), unidad=unidad).first()
        if not tipo:
            raise ValueError(f"Tipo de documento {tipo_documento_id} no encontrado en la unidad actual")

        with transaction.atomic():
            doc = Documento.objects.create(
                unidad=unidad,
                lote=pagina.lote,
                tipo_documento=tipo,
                es_doble_cara=False,
                nombre_final=tipo.nombre,
                estado='confirmado',
            )
            doc.paginas.set([pagina])

            pagina.estado = 'confirmada'
            pagina.save(update_fields=['estado'])

            from .agrupador import actualizar_firma_tipo_documento
            actualizar_firma_tipo_documento(tipo, [pagina])

        return pagina

    @strawberry.mutation
    def crear_tipo_y_asignar(
        self,
        info: strawberry.types.Info,
        pagina_id: strawberry.ID,
        nombre: str,
    ) -> PaginaType:
        from django.db import transaction
        from apps.core.tenancy import get_unidad_from_info

        unidad = get_unidad_from_info(info)
        if not unidad:
            raise PermissionError("Usuario no autenticado o unidad no válida")

        nombre_limpio = (nombre or "").strip()
        if not nombre_limpio:
            raise ValueError("El nombre del tipo de documento es requerido")

        pagina = Pagina.objects.filter(id=int(str(pagina_id)), unidad=unidad).first()
        if not pagina:
            raise ValueError(f"Página {pagina_id} no encontrada en la unidad actual")

        slug_tipo = _slug_de(nombre_limpio)

        with transaction.atomic():
            tipo = TipoDocumento.objects.filter(slug=slug_tipo, unidad=unidad).first()
            if not tipo:
                palabras = pagina.firma_palabras if isinstance(pagina.firma_palabras, list) else []
                palabras_str = ', '.join(palabras[:10]) if palabras else nombre_limpio.lower()
                firma = {"palabras": palabras} if palabras else {}
                tipo = TipoDocumento.objects.create(
                    unidad=unidad,
                    nombre=nombre_limpio,
                    slug=slug_tipo,
                    palabras_clave=palabras_str,
                    firma_consolidada=firma,
                    color="#4F46E5",
                )

            tipo.ejemplos_paginas.add(pagina)

            doc = Documento.objects.create(
                unidad=unidad,
                lote=pagina.lote,
                tipo_documento=tipo,
                es_doble_cara=False,
                nombre_final=tipo.nombre,
                estado='confirmado',
            )
            doc.paginas.set([pagina])

            pagina.estado = 'confirmada'
            pagina.save(update_fields=['estado'])

            from .agrupador import actualizar_firma_tipo_documento
            actualizar_firma_tipo_documento(tipo, [pagina])

        return pagina

    @strawberry.mutation
    def descartar_pagina(
        self,
        info: strawberry.types.Info,
        pagina_id: strawberry.ID,
    ) -> PaginaType:
        from apps.core.tenancy import get_unidad_from_info

        unidad = get_unidad_from_info(info)
        if not unidad:
            raise PermissionError("Usuario no autenticado o unidad no válida")

        pagina = Pagina.objects.filter(id=int(str(pagina_id)), unidad=unidad).first()
        if not pagina:
            raise ValueError(f"Página {pagina_id} no encontrada en la unidad actual")

        pagina.estado = 'descartada'
        pagina.descartable = True
        pagina.save(update_fields=['estado', 'descartable'])

        return pagina

    @strawberry.mutation
    def guardar_palabras_admin(
        self,
        info: strawberry.types.Info,
        tipo_id: strawberry.ID,
        palabras_seleccionadas: list[str],
        palabras_obligatorias: list[str],
    ) -> TipoDocumentoType:
        """Guarda las palabras clave y obligatorias traducidas internamente sin que el admin vea pesos numéricos (Fase 10)."""
        from apps.core.tenancy import get_unidad_from_info
        from .agrupador import normalizar

        unidad = get_unidad_from_info(info)
        if not unidad:
            raise PermissionError("Usuario no autenticado o unidad no válida")

        tipo = TipoDocumento.objects.filter(id=int(str(tipo_id)), unidad=unidad).first()
        if not tipo:
            raise ValueError(f"Tipo de documento {tipo_id} no encontrado en la unidad actual")

        obligatorias_limpias = sorted({
            normalizar(w) for w in palabras_obligatorias if w and w.strip()
        })
        seleccionadas_limpias = {
            normalizar(w) for w in palabras_seleccionadas if w and w.strip()
        }
        seleccionadas_limpias.update(obligatorias_limpias)

        items_pesos = []
        for w in sorted(seleccionadas_limpias):
            if w in obligatorias_limpias:
                items_pesos.append(f"{w}:5")
            else:
                items_pesos.append(f"{w}:3")

        tipo.palabras_clave = ", ".join(items_pesos)
        tipo.keywords_obligatorias = obligatorias_limpias
        tipo.save(update_fields=['palabras_clave', 'keywords_obligatorias'])

        return tipo

    @strawberry.mutation
    def guardar_borrador_agrupamiento(
        self,
        info: strawberry.types.Info,
        lote_id: strawberry.ID,
        borrador: strawberry.scalars.JSON,
    ) -> GuardarBorradorResponse:
        from apps.core.tenancy import get_unidad_from_info
        unidad = get_unidad_from_info(info)
        if not unidad:
            return GuardarBorradorResponse(success=False, message="No autenticado o unidad no válida")

        lote = Lote.objects.filter(id=int(str(lote_id)), unidad=unidad).first()
        if not lote:
            return GuardarBorradorResponse(success=False, message=f"Lote {lote_id} no encontrado")

        lote.borrador_agrupamiento = borrador or {}
        lote.save(update_fields=['borrador_agrupamiento'])
        return GuardarBorradorResponse(success=True, message="Borrador guardado exitosamente")

    @strawberry.mutation
    def asignar_pagina_a_documento_incompleto(
        self,
        info: strawberry.types.Info,
        documento_id: strawberry.ID,
        pagina_id: strawberry.ID,
        slot: Optional[str] = None,
    ) -> OperacionDocumentoResponse:
        from django.db import transaction
        from apps.core.tenancy import get_unidad_from_info

        unidad = get_unidad_from_info(info)
        if not unidad:
            return OperacionDocumentoResponse(success=False, message="No autenticado")

        doc = Documento.objects.filter(id=int(str(documento_id)), unidad=unidad).first()
        if not doc:
            return OperacionDocumentoResponse(success=False, message="Documento no encontrado")

        pagina = Pagina.objects.filter(id=int(str(pagina_id)), unidad=unidad).first()
        if not pagina:
            return OperacionDocumentoResponse(success=False, message="Página no encontrada")

        with transaction.atomic():
            doc.paginas.add(pagina)
            pagina.estado = 'confirmada'
            pagina.save(update_fields=['estado'])

            # Registrar en historial
            hist = list(doc.historial_clasificacion or [])
            hist.append({
                'accion': 'asignar_slot_revision',
                'pagina_id': pagina.id,
                'slot': slot or f'Pág. {doc.paginas.count()}',
            })
            doc.historial_clasificacion = hist
            doc.estado = 'confirmado'  # Al completar slot, pasa a confirmado
            doc.save(update_fields=['historial_clasificacion', 'estado'])

            # Recompilar PDF con las páginas asociadas
            try:
                import fitz
                from apps.storage.services import MinIOService
                storage = MinIOService()
                nuevo_pdf = fitz.open()

                for p in doc.paginas.all().order_by('nro_pagina_en_pdf'):
                    if getattr(p, 'pdf_origen', None):
                        pdf_bytes = storage.get_file(p.pdf_origen)
                        src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                        p_idx = (p.nro_pagina_en_pdf or 1) - 1
                        if 0 <= p_idx < len(src_doc):
                            nuevo_pdf.insert_pdf(src_doc, from_page=p_idx, to_page=p_idx)
                        src_doc.close()

                if len(nuevo_pdf) > 0:
                    compilado_bytes = nuevo_pdf.tobytes()
                    persona = getattr(doc.lote, 'persona', None)
                    cod_folder = getattr(persona, 'codigo', None) or f"unidad_{getattr(unidad, 'codigo', 'general')}"
                    nombre_pdf_salida = f"doc_{doc.id}_{doc.tipo_documento.slug if doc.tipo_documento else 'general'}.pdf"
                    key_compilado = storage.upload_pdf(cod_folder, nombre_pdf_salida, compilado_bytes)
                    doc.archivo_original = key_compilado
                    doc.save(update_fields=['archivo_original'])
                nuevo_pdf.close()
            except Exception:
                pass

        return OperacionDocumentoResponse(success=True, message="Página asignada correctamente", documento=doc)

    @strawberry.mutation
    def marcar_documento_completo(
        self,
        info: strawberry.types.Info,
        documento_id: strawberry.ID,
    ) -> OperacionDocumentoResponse:
        from apps.core.tenancy import get_unidad_from_info
        unidad = get_unidad_from_info(info)
        if not unidad:
            return OperacionDocumentoResponse(success=False, message="No autenticado")

        doc = Documento.objects.filter(id=int(str(documento_id)), unidad=unidad).first()
        if not doc:
            return OperacionDocumentoResponse(success=False, message="Documento no encontrado")

        doc.estado = 'confirmado'
        hist = list(doc.historial_clasificacion or [])
        hist.append({'accion': 'marcar_completo_manual', 'detalle': 'Aceptado como completo por operador'})
        doc.historial_clasificacion = hist
        doc.save(update_fields=['estado', 'historial_clasificacion'])

        return OperacionDocumentoResponse(success=True, message="Documento marcado como completo", documento=doc)

    @strawberry.mutation
    def descartar_documento_incompleto(
        self,
        info: strawberry.types.Info,
        documento_id: strawberry.ID,
    ) -> OperacionDocumentoResponse:
        from apps.core.tenancy import get_unidad_from_info
        unidad = get_unidad_from_info(info)
        if not unidad:
            return OperacionDocumentoResponse(success=False, message="No autenticado")

        doc = Documento.objects.filter(id=int(str(documento_id)), unidad=unidad).first()
        if not doc:
            return OperacionDocumentoResponse(success=False, message="Documento no encontrado")

        # Devolver sus páginas al estado sin_agrupar para no perderlas
        for p in doc.paginas.all():
            p.estado = 'sin_agrupar'
            p.save(update_fields=['estado'])

        doc.estado = 'descartado'
        hist = list(doc.historial_clasificacion or [])
        hist.append({'accion': 'descartar_incompleto', 'detalle': 'Documento descartado en revisión de lote'})
        doc.historial_clasificacion = hist
        doc.save(update_fields=['estado', 'historial_clasificacion'])

        return OperacionDocumentoResponse(success=True, message="Documento descartado", documento=doc)