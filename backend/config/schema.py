import graphene
from apps.personas.schema import Query as PersonaQuery
from apps.personas.mutations import Mutation as PersonaMutation
from apps.documentos.schema import Query as DocumentoQuery
from apps.documentos.mutations import Mutation as DocumentoMutation
from apps.users.schema import Query as UserQuery, Mutation as UserMutation
from apps.unidades.schema import Query as UnidadQuery, Mutation as UnidadMutation


class Query(UnidadQuery, PersonaQuery, DocumentoQuery, UserQuery, graphene.ObjectType):
    pass


class Mutation(UnidadMutation, PersonaMutation, DocumentoMutation, UserMutation, graphene.ObjectType):
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)
