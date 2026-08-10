import graphene
from graphene_django import DjangoObjectType
from django.contrib.auth import authenticate
from .models import User


class UserType(DjangoObjectType):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'telefono')


class LoginUser(graphene.Mutation):
    class Arguments:
        username = graphene.String(required=True)
        password = graphene.String(required=True)

    user = graphene.Field(UserType)
    token = graphene.String()
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, username, password):
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


class CreateUser(graphene.Mutation):
    class Arguments:
        username = graphene.String(required=True)
        password = graphene.String(required=True)
        email = graphene.String(required=True)
        first_name = graphene.String(required=True)
        last_name = graphene.String(required=True)
        role = graphene.String()
        telefono = graphene.String()

    user = graphene.Field(UserType)
    success = graphene.Boolean()
    message = graphene.String()

    def mutate(self, info, username, password, email, first_name, last_name, role='operador', telefono=''):
        try:
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role,
                telefono=telefono,
            )
            return CreateUser(user=user, success=True, message="Usuario creado exitosamente")
        except Exception as e:
            return CreateUser(user=None, success=False, message=str(e))


class Query(graphene.ObjectType):
    pass


class Mutation(graphene.ObjectType):
    login_user = LoginUser.Field()
    create_user = CreateUser.Field()
