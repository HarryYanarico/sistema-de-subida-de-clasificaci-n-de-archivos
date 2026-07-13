import graphene
from apps.personas.schema import Query as PersonaQuery
from apps.personas.mutations import Mutation as PersonaMutation
from apps.documentos.schema import Query as DocumentoQuery
from apps.documentos.mutations import Mutation as DocumentoMutation
from apps.users.schema import Query as UserQuery, Mutation as UserMutation


class Query(PersonaQuery, DocumentoQuery, UserQuery, graphene.ObjectType):
    pass


class Mutation(PersonaMutation, DocumentoMutation, UserMutation, graphene.ObjectType):
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)
