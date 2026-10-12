from typing import Optional

import strawberry
import strawberry_django
from django.contrib.auth import authenticate

from .models import User


@strawberry_django.type(User, fields=['id', 'username', 'email', 'first_name', 'last_name', 'role', 'telefono'])
class UserType:
    pass


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
    pass


@strawberry.type
class Mutation:
    @strawberry.mutation
    def login_user(self, username: str, password: str) -> LoginUser:
        user = authenticate(username=username, password=password)
        if user is not None:
            return LoginUser(
                user=user,
                token=f"token-{user.id}",
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