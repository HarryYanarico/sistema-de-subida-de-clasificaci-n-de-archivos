from typing import Optional

import strawberry

from .models import Persona
from .schema import PersonaType


@strawberry.type
class CreatePersona:
    persona: Optional[PersonaType]
    success: bool
    message: str


@strawberry.type
class UpdatePersona:
    persona: Optional[PersonaType]
    success: bool
    message: str


@strawberry.type
class DeletePersona:
    success: bool
    message: str


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_persona(
        self,
        info: strawberry.types.Info,
        codigo: str,
        nombres: str,
        apellidos: str,
        ci: Optional[str] = None,
        email: Optional[str] = None,
        telefono: Optional[str] = None,
    ) -> CreatePersona:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            if Persona.objects.filter(codigo=codigo, unidad=unidad).exists():
                return CreatePersona(persona=None, success=False, message="Ya existe una persona con ese código en esta unidad")
            persona = Persona.objects.create(
                unidad=unidad,
                codigo=codigo,
                nombres=nombres,
                apellidos=apellidos,
                ci=ci or '',
                email=email,
                telefono=telefono or '',
            )
            return CreatePersona(persona=persona, success=True, message="Persona creada exitosamente")
        except Exception as e:
            return CreatePersona(persona=None, success=False, message=str(e))

    @strawberry.mutation
    def update_persona(
        self,
        info: strawberry.types.Info,
        id: int,
        codigo: Optional[str] = None,
        nombres: Optional[str] = None,
        apellidos: Optional[str] = None,
        ci: Optional[str] = None,
        email: Optional[str] = None,
        telefono: Optional[str] = None,
    ) -> UpdatePersona:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            persona = Persona.objects.filter(id=id, unidad=unidad).first()
            if not persona:
                return UpdatePersona(persona=None, success=False, message="Persona no encontrada")
            if codigo is not None:
                if Persona.objects.filter(codigo=codigo, unidad=unidad).exclude(id=id).exists():
                    return UpdatePersona(persona=None, success=False, message="Ya existe otra persona con ese código en esta unidad")
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

    @strawberry.mutation
    def delete_persona(self, info: strawberry.types.Info, id: int) -> DeletePersona:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            persona = Persona.objects.filter(id=id, unidad=unidad).first()
            if not persona:
                return DeletePersona(success=False, message="Persona no encontrada")
            persona.delete()
            return DeletePersona(success=True, message="Persona eliminada exitosamente")
        except Exception as e:
            return DeletePersona(success=False, message=str(e))