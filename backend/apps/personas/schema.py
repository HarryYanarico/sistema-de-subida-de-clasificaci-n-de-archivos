import graphene
from graphene_django import DjangoObjectType
from django.db.models import Q
from .models import Persona


class PersonaType(DjangoObjectType):
    total_documentos = graphene.Int()
    documentos_clasificados = graphene.Int()
    porcentaje_completado = graphene.Float()

    class Meta:
        model = Persona
        fields = ('id', 'codigo', 'nombres', 'apellidos', 'ci', 'email', 'telefono', 'created_at', 'updated_at')

    def resolve_total_documentos(self, info):
        return self.documentos.count()

    def resolve_documentos_clasificados(self, info):
        return self.documentos.exclude(tipo_documento__isnull=True).count()

    def resolve_porcentaje_completado(self, info):
        total = self.documentos.count()
        if total == 0:
            return 0
        clasificados = self.documentos.exclude(tipo_documento__isnull=True).count()
        return round((clasificados / total) * 100, 2)


class PersonaConnection(graphene.ObjectType):
    items = graphene.List(PersonaType)
    total = graphene.Int()
    page = graphene.Int()
    total_pages = graphene.Int()


class Query(graphene.ObjectType):
    personas = graphene.Field(
        PersonaConnection,
        search=graphene.String(),
        page=graphene.Int(default_value=1),
        limit=graphene.Int(default_value=10),
    )
    persona = graphene.Field(PersonaType, id=graphene.Int(required=True))

    def resolve_personas(self, info, search=None, page=1, limit=10):
        queryset = Persona.objects.all()
        if search:
            queryset = queryset.filter(
                Q(nombres__icontains=search) |
                Q(apellidos__icontains=search) |
                Q(codigo__icontains=search) |
                Q(ci__icontains=search)
            )
        total = queryset.count()
        total_pages = max(1, (total + limit - 1) // limit)
        offset = (page - 1) * limit
        items = queryset[offset:offset + limit]
        return PersonaConnection(
            items=items,
            total=total,
            page=page,
            total_pages=total_pages,
        )

    def resolve_persona(self, info, id):
        return Persona.objects.filter(id=id).first()
