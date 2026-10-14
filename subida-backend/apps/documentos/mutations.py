import re
from typing import Optional

# pyrefly: ignore [missing-import]
import strawberry

from .models import TipoDocumento, Documento, SugerenciaKeyword
from .schema import TipoDocumentoType, DocumentoType, SugerenciaKeywordType


def clasificar_documento(doc):
    """Reclasifica un documento con el clasificador local.

    Delega en `apps.storage.clasificador` para que la ingesta y esta mutation
    compartan exactamente el mismo criterio: si divergen, los documentos
    reclasificados desde el admin quedan con un criterio distinto al automatico.
    """
    from apps.storage.clasificador import clasificar, estado_desde_resultado

    tipos = TipoDocumento.objects.filter(activo=True)

    resultado = clasificar(doc.texto_extraido, tipos)

    doc.tipo_documento = resultado.tipo_ganador
    doc.estado = estado_desde_resultado(resultado)
    doc.score = resultado.score_ganador or None
    doc.keywords_matcheadas = resultado.keywords_matcheadas
    doc.save()


def reclasificar_todos():
    # Los duplicados se saltan: reclasificarlos no cambia el hecho de que son
    # una copia, y hacerlos reaparecer en la cola seria revisar dos veces lo mismo.
    qs = Documento.objects.exclude(texto_extraido='').exclude(estado='duplicado')
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
    return re.sub(r'[^a-z0-9]+', '-', nombre.lower()).strip('-')


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
class Mutation:
    @strawberry.mutation
    def create_tipo_documento(
        self,
        nombre: str,
        palabras_clave: str,
        keywords_obligatorias: Optional[list[str]] = None,
    ) -> CreateTipoDocumento:
        try:
            slug = _slug_de(nombre)
            if TipoDocumento.objects.filter(slug=slug).exists():
                return CreateTipoDocumento(tipo_documento=None, success=False, message="Ya existe un tipo con ese nombre")
            tipo = TipoDocumento.objects.create(
                nombre=nombre,
                slug=slug,
                palabras_clave=palabras_clave,
                keywords_obligatorias=_limpiar_obligatorias(keywords_obligatorias),
            )
            reclasificar_todos()
            return CreateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo de documento creado")
        except Exception as e:
            return CreateTipoDocumento(tipo_documento=None, success=False, message=str(e))

    @strawberry.mutation
    def update_tipo_documento(
        self,
        id: int,
        nombre: Optional[str] = None,
        palabras_clave: Optional[str] = None,
        keywords_obligatorias: Optional[list[str]] = None,
        activo: Optional[bool] = None,
    ) -> UpdateTipoDocumento:
        try:
            tipo = TipoDocumento.objects.filter(id=id).first()
            if not tipo:
                return UpdateTipoDocumento(tipo_documento=None, success=False, message="Tipo no encontrado")
            if nombre is not None:
                tipo.nombre = nombre
            if palabras_clave is not None:
                tipo.palabras_clave = palabras_clave
            if keywords_obligatorias is not None:
                tipo.keywords_obligatorias = _limpiar_obligatorias(keywords_obligatorias)
            if activo is not None:
                tipo.activo = activo
            tipo.save()
            # Cambiar las palabras cambia el resultado de clasificacion: hay que
            # reevaluar los documentos que quedaron 'sin_clasificar' o 'dudosa'.
            reclasificar_todos()
            return UpdateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo actualizado")
        except Exception as e:
            return UpdateTipoDocumento(tipo_documento=None, success=False, message=str(e))

    @strawberry.mutation
    def delete_tipo_documento(self, id: int) -> DeleteTipoDocumento:
        try:
            tipo = TipoDocumento.objects.filter(id=id).first()
            if not tipo:
                return DeleteTipoDocumento(success=False, message="Tipo no encontrado")
            Documento.objects.filter(tipo_documento=tipo).update(tipo_documento=None, estado='pendiente')
            tipo.delete()
            return DeleteTipoDocumento(success=True, message="Tipo eliminado")
        except Exception as e:
            return DeleteTipoDocumento(success=False, message=str(e))

    @strawberry.mutation
    def asignar_documento(self, documento_id: int, tipo_documento_id: int) -> AsignarDocumento:
        try:
            doc = Documento.objects.filter(id=documento_id).first()
            if not doc:
                return AsignarDocumento(documento=None, success=False, message="Documento no encontrado")
            tipo = TipoDocumento.objects.filter(id=tipo_documento_id).first()
            if not tipo:
                return AsignarDocumento(documento=None, success=False, message="Tipo de documento no encontrado")
            doc.tipo_documento = tipo
            doc.estado = 'clasificado'
            doc.save()
            return AsignarDocumento(documento=doc, success=True, message="Documento asignado correctamente")
        except Exception as e:
            return AsignarDocumento(documento=None, success=False, message=str(e))

    @strawberry.mutation
    def clasificar_documento(self, documento_id: int) -> ClasificarDocumento:
        try:
            doc = Documento.objects.filter(id=documento_id).first()
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
        self, info: strawberry.Info, documento_id: int, tipo_documento_id: int
    ) -> ReclasificarDocumento:
        """Correccion humana de una pagina mal clasificada.

        A diferencia de `asignarDocumento`, aqui el estado pasa a 'verificado':
        asignar es un pase automatico que el clasificador puede volver a
        deshacer en la proxima reclasificacion; verificar es la decision final
        de una persona, y por eso limpia el score local (que ya no describe el
        resultado) y deja el score anterior asentado en el log.
        """
        try:
            doc = Documento.objects.filter(id=documento_id).first()
            if not doc:
                return ReclasificarDocumento(
                    documento=None, success=False, message="Documento no encontrado")

            tipo = TipoDocumento.objects.filter(id=tipo_documento_id).first()
            if not tipo:
                return ReclasificarDocumento(
                    documento=None, success=False, message="Tipo de documento no encontrado")

            usuario = _usuario_de(info)

            registrar_reclasificacion(doc, doc.tipo_documento, tipo, usuario)

            doc.tipo_documento = tipo
            doc.estado = 'verificado'
            doc.score = None
            # Keywords y phash tambien son del intento fallido: dejarlos
            # mentiria sobre por que el documento esta en la cola.
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
    def crear_y_asignar_tipo(self, documento_id: int, nombre: str, palabras_clave: str) -> CrearYAsignarTipo:
        try:
            doc = Documento.objects.filter(id=documento_id).first()
            if not doc:
                return CrearYAsignarTipo(
                    tipo_documento=None, documento=None, success=False, message="Documento no encontrado"
                )

            slug = _slug_de(nombre)

            if TipoDocumento.objects.filter(slug=slug).exists():
                tipo = TipoDocumento.objects.filter(slug=slug).first()
            else:
                tipo = TipoDocumento.objects.create(
                    nombre=nombre,
                    slug=slug,
                    palabras_clave=palabras_clave,
                )
                reclasificar_todos()

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
    def aceptar_sugerencia(self, id: int, peso: int = 1) -> AceptarSugerencia:
        try:
            sug = SugerenciaKeyword.objects.filter(id=id).first()
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
    def descartar_sugerencia(self, id: int) -> DescartarSugerencia:
        try:
            sug = SugerenciaKeyword.objects.filter(id=id).first()
            if not sug:
                return DescartarSugerencia(sugerencia=None, success=False, message="Sugerencia no encontrada")
            sug.aceptada = False
            sug.save()
            return DescartarSugerencia(sugerencia=sug, success=True, message="Sugerencia descartada")
        except Exception as e:
            return DescartarSugerencia(sugerencia=None, success=False, message=str(e))

    @strawberry.mutation
    def generar_sugerencias_keywords(
        self, min_docs: int = 5, top: int = 5, limpiar: bool = False
    ) -> GenerarSugerenciasKeywords:
        try:
            from .services import generar_sugerencias_keywords
            res = generar_sugerencias_keywords(min_docs=min_docs, top=top, limpiar=limpiar)
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