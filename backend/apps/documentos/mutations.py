import graphene
import re
from .models import TipoDocumento, Documento
from .schema import TipoDocumentoType, DocumentoType


def clasificar_documento(doc):
    texto_lower = doc.texto_extraido.lower()
    mejor_tipo = None
    max_score = 0

    for tipo in TipoDocumento.objects.filter(activo=True):
        if tipo.lista_requiere:
            tiene_requerida = False
            for palabra in tipo.lista_requiere:
                if palabra in texto_lower:
                    tiene_requerida = True
                    break
            if not tiene_requerida:
                continue

        if tipo.lista_excluye:
            excluido = False
            for slug in tipo.lista_excluye:
                if slug in texto_lower:
                    excluido = True
                    break
            if excluido:
                continue

        score = 0
        for palabra, peso in tipo.lista_palabras_clave_con_pesos:
            if palabra in texto_lower:
                score += peso

        if score >= tipo.score_minimo and score > max_score:
            max_score = score
            mejor_tipo = tipo

    if mejor_tipo and max_score > 0:
        doc.tipo_documento = mejor_tipo
        doc.estado = 'clasificado'
    else:
        doc.tipo_documento = None
        doc.estado = 'pendiente'
    doc.save()


def reclasificar_todos():
    docs = Documento.objects.exclude(texto_extraido='')
    for doc in docs:
        clasificar_documento(doc)


class CreateTipoDocumento(graphene.Mutation):
    class Arguments:
        nombre = graphene.String(required=True)
        palabras_clave = graphene.String(required=True)
        requiere = graphene.String()
        excluye = graphene.String()
        score_minimo = graphene.Int()
        es_obligatorio = graphene.Boolean()
        orden = graphene.Int()

    tipo_documento = graphene.Field(TipoDocumentoType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, nombre, palabras_clave, requiere='', excluye='',
               score_minimo=3, es_obligatorio=False, orden=0):
        try:
            slug = re.sub(r'[^a-z0-9]+', '-', nombre.lower()).strip('-')
            if TipoDocumento.objects.filter(slug=slug).exists():
                return CreateTipoDocumento(tipo_documento=None, success=False, message="Ya existe un tipo con ese nombre")
            tipo = TipoDocumento.objects.create(
                nombre=nombre,
                slug=slug,
                palabras_clave=palabras_clave,
                requiere=requiere,
                excluye=excluye,
                score_minimo=score_minimo,
                es_obligatorio=es_obligatorio,
                orden=orden,
            )
            reclasificar_todos()
            return CreateTipoDocumento(tipo_documento=tipo, success=True, message="Tipo de documento creado")
        except Exception as e:
            return CreateTipoDocumento(tipo_documento=None, success=False, message=str(e))


class UpdateTipoDocumento(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)
        nombre = graphene.String()
        palabras_clave = graphene.String()
        requiere = graphene.String()
        excluye = graphene.String()
        score_minimo = graphene.Int()
        es_obligatorio = graphene.Boolean()
        orden = graphene.Int()
        activo = graphene.Boolean()

    tipo_documento = graphene.Field(TipoDocumentoType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id, nombre=None, palabras_clave=None, requiere=None,
               excluye=None, score_minimo=None, es_obligatorio=None, orden=None, activo=None):
        try:
            tipo = TipoDocumento.objects.filter(id=id).first()
            if not tipo:
                return UpdateTipoDocumento(tipo_documento=None, success=False, message="Tipo no encontrado")
            if nombre is not None:
                tipo.nombre = nombre
            if palabras_clave is not None:
                tipo.palabras_clave = palabras_clave
            if requiere is not None:
                tipo.requiere = requiere
            if excluye is not None:
                tipo.excluye = excluye
            if score_minimo is not None:
                tipo.score_minimo = score_minimo
            if es_obligatorio is not None:
                tipo.es_obligatorio = es_obligatorio
            if orden is not None:
                tipo.orden = orden
            if activo is not None:
                tipo.activo = activo
            tipo.save()
            reclasificar_todos()
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


class Mutation(graphene.ObjectType):
    create_tipo_documento = CreateTipoDocumento.Field()
    update_tipo_documento = UpdateTipoDocumento.Field()
    delete_tipo_documento = DeleteTipoDocumento.Field()
    asignar_documento = AsignarDocumento.Field()
    clasificar_documento = ClasificarDocumento.Field()
