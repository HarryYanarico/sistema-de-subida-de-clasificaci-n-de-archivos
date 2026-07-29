import graphene
import re
from .models import TipoDocumento, Documento
from .schema import TipoDocumentoType, DocumentoType


def clasificar_documento(doc):
    unidad = doc.persona.unidad
    texto_lower = doc.texto_extraido.lower()
    mejor_tipo = None
    max_score = 0

    for tipo in TipoDocumento.objects.filter(unidad=unidad, activo=True):
        score = 0
        for palabra, peso in tipo.lista_palabras_clave_con_pesos:
            if palabra in texto_lower:
                score += peso

        if score > max_score:
            max_score = score
            mejor_tipo = tipo

    if mejor_tipo and max_score > 0:
        doc.tipo_documento = mejor_tipo
        doc.estado = 'clasificado'
    else:
        doc.tipo_documento = None
        doc.estado = 'pendiente'
    doc.save()


def reclasificar_todos(unidad=None):
    qs = Documento.objects.exclude(texto_extraido='')
    if unidad:
        qs = qs.filter(persona__unidad=unidad)
    for doc in qs:
        clasificar_documento(doc)


class CreateTipoDocumento(graphene.Mutation):
    class Arguments:
        unidad_id = graphene.Int(required=True)
        nombre = graphene.String(required=True)
        palabras_clave = graphene.String(required=True)

    tipo_documento = graphene.Field(TipoDocumentoType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, unidad_id, nombre, palabras_clave):
        try:
            from apps.unidades.models import Unidad
            unidad = Unidad.objects.filter(id=unidad_id).first()
            if not unidad:
                return CreateTipoDocumento(tipo_documento=None, success=False, message="Unidad no encontrada")
            slug = re.sub(r'[^a-z0-9]+', '-', nombre.lower()).strip('-')
            if TipoDocumento.objects.filter(slug=slug, unidad=unidad).exists():
                return CreateTipoDocumento(tipo_documento=None, success=False, message="Ya existe un tipo con ese nombre en esta unidad")
            tipo = TipoDocumento.objects.create(
                unidad=unidad,
                nombre=nombre,
                slug=slug,
                palabras_clave=palabras_clave,
            )
            reclasificar_todos(unidad=unidad)
            return CreateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo de documento creado")
        except Exception as e:
            return CreateTipoDocumento(tipo_documento=None, success=False, message=str(e))


class UpdateTipoDocumento(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)
        nombre = graphene.String()
        palabras_clave = graphene.String()
        activo = graphene.Boolean()

    tipo_documento = graphene.Field(TipoDocumentoType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id, nombre=None, palabras_clave=None, activo=None):
        try:
            tipo = TipoDocumento.objects.filter(id=id).first()
            if not tipo:
                return UpdateTipoDocumento(tipo_documento=None, success=False, message="Tipo no encontrado")
            if nombre is not None:
                tipo.nombre = nombre
            if palabras_clave is not None:
                tipo.palabras_clave = palabras_clave
            if activo is not None:
                tipo.activo = activo
            tipo.save()
            return UpdateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo actualizado")
        except Exception as e:
            return UpdateTipoDocumento(tipo_documento=None, success=False, message=str(e))


class DeleteTipoDocumento(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)

    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id):
        try:
            tipo = TipoDocumento.objects.filter(id=id).first()
            if not tipo:
                return DeleteTipoDocumento(success=False, message="Tipo no encontrado")
            Documento.objects.filter(tipo_documento=tipo).update(tipo_documento=None, estado='pendiente')
            tipo.delete()
            return DeleteTipoDocumento(success=True, message="Tipo eliminado")
        except Exception as e:
            return DeleteTipoDocumento(success=False, message=str(e))


class AsignarDocumento(graphene.Mutation):
    class Arguments:
        documento_id = graphene.Int(required=True)
        tipo_documento_id = graphene.Int(required=True)

    documento = graphene.Field(DocumentoType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, documento_id, tipo_documento_id):
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


class ClasificarDocumento(graphene.Mutation):
    class Arguments:
        documento_id = graphene.Int(required=True)

    documento = graphene.Field(DocumentoType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, documento_id):
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


class SugerirClasificacionIA(graphene.Mutation):
    class Arguments:
        documento_id = graphene.Int(required=True)

    tipo_sugerido = graphene.Field(TipoDocumentoType)
    palabras_clave_sugeridas = graphene.String()
    es_nuevo_tipo = graphene.Boolean()
    raw_response = graphene.String()
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, documento_id):
        try:
            from apps.storage.ai_classifier import GeminiClassifier

            doc = Documento.objects.filter(id=documento_id).first()
            if not doc:
                return SugerirClasificacionIA(success=False, message="Documento no encontrado")

            if not doc.texto_extraido or len(doc.texto_extraido.strip()) < 20:
                return SugerirClasificacionIA(success=False, message="El documento no tiene texto extraído suficiente")

            unidad = doc.persona.unidad
            tipos = list(TipoDocumento.objects.filter(unidad=unidad, activo=True).values('id', 'nombre', 'slug'))

            classifier = GeminiClassifier()
            if not classifier.is_available:
                return SugerirClasificacionIA(success=False, message="Gemini IA no está configurado. Verifica GEMINI_API_KEY")

            result = classifier.suggest_classification(doc.texto_extraido, tipos)

            return SugerirClasificacionIA(
                tipo_sugerido=result['tipo_sugerido'],
                palabras_clave_sugeridas=result['palabras_clave'],
                es_nuevo_tipo=result.get('es_nuevo_tipo', False),
                raw_response=result.get('raw_response', ''),
                success=True,
                message="Sugerencia generada correctamente",
            )

        except Exception as e:
            return SugerirClasificacionIA(success=False, message=str(e))


class Mutation(graphene.ObjectType):
    create_tipo_documento = CreateTipoDocumento.Field()
    update_tipo_documento = UpdateTipoDocumento.Field()
    delete_tipo_documento = DeleteTipoDocumento.Field()
    asignar_documento = AsignarDocumento.Field()
    clasificar_documento = ClasificarDocumento.Field()
    sugerir_clasificacion_ia = SugerirClasificacionIA.Field()
