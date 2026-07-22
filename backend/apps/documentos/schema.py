import graphene
from graphene_django import DjangoObjectType
from .models import TipoDocumento, Documento


class TipoDocumentoType(DjangoObjectType):
    class Meta:
        model = TipoDocumento
        fields = ('id', 'nombre', 'slug', 'palabras_clave', 'requiere', 'excluye',
                  'score_minimo', 'es_obligatorio', 'orden', 'activo', 'created_at')


class DocumentoType(DjangoObjectType):
    class Meta:
        model = Documento
        fields = ('id', 'persona', 'tipo_documento', 'archivo_original', 'archivo_pagina',
                  'pagina_numero', 'texto_extraido', 'estado', 'created_at')


class TipoDocumentoConnection(graphene.ObjectType):
    items = graphene.List(TipoDocumentoType)
    total = graphene.Int()


class DocumentoByPersona(graphene.ObjectType):
    persona_id = graphene.Int()
    documentos = graphene.List(DocumentoType)
    total_paginas = graphene.Int()
    clasificados = graphene.Int()
    pendientes = graphene.Int()


class Query(graphene.ObjectType):
    tipos_documento = graphene.List(TipoDocumentoType, unidad_id=graphene.Int(required=True), activo=graphene.Boolean())
    tipo_documento = graphene.Field(TipoDocumentoType, id=graphene.Int(required=True))
    documentos_persona = graphene.Field(DocumentoByPersona, persona_id=graphene.Int(required=True))
    documentos_pendientes = graphene.List(DocumentoType, unidad_id=graphene.Int(required=True))

    def resolve_tipos_documento(self, info, unidad_id, activo=None):
        qs = TipoDocumento.objects.filter(unidad_id=unidad_id)
        if activo is not None:
            qs = qs.filter(activo=activo)
        return qs

    def resolve_tipo_documento(self, info, id):
        return TipoDocumento.objects.filter(id=id).first()

    def resolve_documentos_persona(self, info, persona_id):
        documentos = Documento.objects.filter(persona_id=persona_id)
        total = documentos.count()
        clasificados = documentos.exclude(tipo_documento__isnull=True).count()
        return DocumentoByPersona(
            persona_id=persona_id,
            documentos=documentos,
            total_paginas=total,
            clasificados=clasificados,
            pendientes=total - clasificados,
        )

    def resolve_documentos_pendientes(self, info, unidad_id):
        return Documento.objects.filter(
            estado='pendiente',
            tipo_documento__isnull=True,
            persona__unidad_id=unidad_id,
        )
