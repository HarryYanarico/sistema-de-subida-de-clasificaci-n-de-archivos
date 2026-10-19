from typing import Optional

import strawberry
import strawberry_django
from django.contrib.auth import authenticate

from .models import User
from .tokens import generar_token


from apps.core.models import Unidad


@strawberry_django.type(Unidad, fields=['id', 'codigo', 'nombre', 'activa', 'created_at'])
class UnidadType:
    pass


@strawberry_django.type(User, fields=['id', 'username', 'email', 'first_name', 'last_name', 'role', 'telefono'])
class UserType:
    cod_empleado: Optional[str] = strawberry_django.field(default='')

    @strawberry_django.field
    def rol_slug(self) -> str:
        return 'admin-archivos' if self.role == 'admin' else 'operador'

    @strawberry_django.field
    def unidad(self) -> Optional[UnidadType]:
        return self.unidad


@strawberry.type
class LoginUser:
    user: Optional[UserType]
    token: Optional[str]
    success: bool
    message: str


@strawberry.type
class CreateUser:
    user: Optional[UserType]
    success: bool
    message: str


@strawberry.type
class Query:
    @strawberry.field
    def me(self, info: strawberry.types.Info) -> Optional[UserType]:
        context = getattr(info, 'context', None)
        request = getattr(context, 'request', context) if not isinstance(context, dict) else context.get('request', context)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            return user
        return None


@strawberry.type
class Mutation:
    @strawberry.mutation
    def login_user(self, username: str, password: str) -> LoginUser:
        user = authenticate(username=username, password=password)
        if user is not None:
            return LoginUser(
                user=user,
                token=generar_token(user),
                success=True,
                message="Inicio de sesión exitoso"
            )
        return LoginUser(
            user=None,
            token=None,
            success=False,
            message="Credenciales incorrectas"
        )

    @strawberry.mutation
    def create_user(
        self,
        username: str,
        password: str,
        email: str,
        first_name: str,
        last_name: str,
        role: Optional[str] = None,
        telefono: Optional[str] = None,
    ) -> CreateUser:
        try:
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role or 'operador',
                telefono=telefono or '',
            )
            return CreateUser(user=user, success=True, message="Usuario creado exitosamente")
        except Exception as e:
            return CreateUser(user=None, success=False, message=str(e))