import graphene
from graphene_django import DjangoObjectType
from .models import Unidad


class UnidadType(DjangoObjectType):
    class Meta:
        model = Unidad
        fields = ('id', 'nombre', 'slug', 'descripcion', 'activo', 'created_at')


class Query(graphene.ObjectType):
    unidades = graphene.List(UnidadType, activo=graphene.Boolean())
    unidad = graphene.Field(UnidadType, id=graphene.Int(required=True))

    def resolve_unidades(self, info, activo=None):
        qs = Unidad.objects.all()
        if activo is not None:
            qs = qs.filter(activo=activo)
        return qs

    def resolve_unidad(self, info, id):
        return Unidad.objects.filter(id=id).first()


class CreateUnidad(graphene.Mutation):
    class Arguments:
        nombre = graphene.String(required=True)
        descripcion = graphene.String()

    unidad = graphene.Field(UnidadType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, nombre, descripcion=''):
        try:
            import re
            from django.utils.text import slugify
            slug = slugify(nombre)
            if Unidad.objects.filter(slug=slug).exists():
                return CreateUnidad(unidad=None, success=False, message="Ya existe una unidad con ese nombre")
            unidad = Unidad.objects.create(nombre=nombre, slug=slug, descripcion=descripcion)
            return CreateUnidad(unidad=unidad, success=True, message="Unidad creada exitosamente")
        except Exception as e:
            return CreateUnidad(unidad=None, success=False, message=str(e))


class UpdateUnidad(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)
        nombre = graphene.String()
        descripcion = graphene.String()
        activo = graphene.Boolean()

    unidad = graphene.Field(UnidadType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id, nombre=None, descripcion=None, activo=None):
        try:
            unidad = Unidad.objects.filter(id=id).first()
            if not unidad:
                return UpdateUnidad(unidad=None, success=False, message="Unidad no encontrada")
            if nombre is not None:
                unidad.nombre = nombre
                from django.utils.text import slugify
                unidad.slug = slugify(nombre)
            if descripcion is not None:
                unidad.descripcion = descripcion
            if activo is not None:
                unidad.activo = activo
            unidad.save()
            return UpdateUnidad(unidad=unidad, success=True, message="Unidad actualizada exitosamente")
        except Exception as e:
            return UpdateUnidad(unidad=None, success=False, message=str(e))


class DeleteUnidad(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)

    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id):
        try:
            unidad = Unidad.objects.filter(id=id).first()
            if not unidad:
                return DeleteUnidad(success=False, message="Unidad no encontrada")
            if unidad.personas.exists():
                return DeleteUnidad(success=False, message="No se puede eliminar una unidad con personas asociadas")
            unidad.delete()
            return DeleteUnidad(success=True, message="Unidad eliminada exitosamente")
        except Exception as e:
            return DeleteUnidad(success=False, message=str(e))


class Mutation(graphene.ObjectType):
    create_unidad = CreateUnidad.Field()
    update_unidad = UpdateUnidad.Field()
    delete_unidad = DeleteUnidad.Field()
