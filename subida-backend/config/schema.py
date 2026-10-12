import strawberry

from apps.documentos.schema import Query as DocumentoQuery
from apps.documentos.mutations import Mutation as DocumentoMutation
from apps.personas.schema import Query as PersonaQuery
from apps.personas.mutations import Mutation as PersonaMutation
from apps.users.schema import Query as UserQuery, Mutation as UserMutation


@strawberry.type
class Query(PersonaQuery, DocumentoQuery, UserQuery):
    pass


@strawberry.type
class Mutation(PersonaMutation, DocumentoMutation, UserMutation):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)