import graphene
from .models import Persona
from .schema import PersonaType


class CreatePersona(graphene.Mutation):
    class Arguments:
        codigo = graphene.String(required=True)
        nombres = graphene.String(required=True)
        apellidos = graphene.String(required=True)
        ci = graphene.String()
        email = graphene.String()
        telefono = graphene.String()

    persona = graphene.Field(PersonaType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, codigo, nombres, apellidos, ci='', email=None, telefono=''):
        try:
            if Persona.objects.filter(codigo=codigo).exists():
                return CreatePersona(persona=None, success=False, message="Ya existe una persona con ese código")
            persona = Persona.objects.create(
                codigo=codigo,
                nombres=nombres,
                apellidos=apellidos,
                ci=ci,
                email=email,
                telefono=telefono,
            )
            return CreatePersona(persona=persona, success=True, message="Persona creada exitosamente")
        except Exception as e:
            return CreatePersona(persona=None, success=False, message=str(e))


class UpdatePersona(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)
        codigo = graphene.String()
        nombres = graphene.String()
        apellidos = graphene.String()
        ci = graphene.String()
        email = graphene.String()
        telefono = graphene.String()

    persona = graphene.Field(PersonaType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id, codigo=None, nombres=None, apellidos=None, ci=None, email=None, telefono=None):
        try:
            persona = Persona.objects.filter(id=id).first()
            if not persona:
                return UpdatePersona(persona=None, success=False, message="Persona no encontrada")
            if codigo is not None:
                if Persona.objects.filter(codigo=codigo).exclude(id=id).exists():
                    return UpdatePersona(persona=None, success=False, message="Ya existe otra persona con ese código")
                persona.codigo = codigo
            if nombres is not None:
                persona.nombres = nombres
            if apellidos is not None:
                persona.apellidos = apellidos
            if ci is not None:
                persona.ci = ci
            if email is not None:
                persona.email = email
            if telefono is not None:
                persona.telefono = telefono
            persona.save()
            return UpdatePersona(persona=persona, success=True, message="Persona actualizada exitosamente")
        except Exception as e:
            return UpdatePersona(persona=None, success=False, message=str(e))


class DeletePersona(graphene.Mutation):
    class Arguments:
        id = graphene.Int(required=True)

    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, id):
        try:
            persona = Persona.objects.filter(id=id).first()
            if not persona:
                return DeletePersona(success=False, message="Persona no encontrada")
            persona.delete()
            return DeletePersona(success=True, message="Persona eliminada exitosamente")
        except Exception as e:
            return DeletePersona(success=False, message=str(e))


class Mutation(graphene.ObjectType):
    create_persona = CreatePersona.Field()
    update_persona = UpdatePersona.Field()
    delete_persona = DeletePersona.Field()
