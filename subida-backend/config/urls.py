from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView

from config.schema import schema
from apps.documentos.views import (
    UploadPDFView, UploadBatchPDFView,
    IniciarLoteView, UploadLotePDFView, AgruparLoteView,
    DescartarPaginaLoteView, FusionarGruposLoteView, EstructuraGrupoView,
    DocumentoFileView, DocumentoOriginalView, DocumentoThumbnailView,
    PaginaThumbnailView, PaginaFileView,
)

from apps.users.tokens import validar_token


class AuthenticatedGraphQLView(GraphQLView):
    def get_context(self, request, response):
        auth_header = request.META.get('HTTP_AUTHORIZATION') or getattr(request, 'headers', {}).get('Authorization', '')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            user = validar_token(token)
            if user:
                request.user = user
        return super().get_context(request, response)


urlpatterns = [
    path('admin/', admin.site.urls),
    # allow_queries_via_get=False mantiene el comportamiento de graphene-django:
    # el GET solo sirve el IDE, las operaciones se ejecutan por POST.
    path(
        'graphql/',
        csrf_exempt(AuthenticatedGraphQLView.as_view(
            schema=schema,
            graphql_ide='graphiql',
            allow_queries_via_get=False,
        )),
    ),
    path('api/upload/', csrf_exempt(UploadPDFView.as_view()), name='upload-pdf'),
    path('api/upload/batch/', csrf_exempt(UploadBatchPDFView.as_view()), name='upload-batch-pdf'),
    path('api/upload/iniciar-lote/', csrf_exempt(IniciarLoteView.as_view()), name='iniciar-lote'),
    path('api/upload/lote/<int:lote_id>/pdf/', csrf_exempt(UploadLotePDFView.as_view()), name='upload-lote-pdf'),
    path('api/upload/lote/<int:lote_id>/agrupar/', csrf_exempt(AgruparLoteView.as_view()), name='agrupar-lote'),
    path('api/upload/lote/<int:lote_id>/descartar-pagina/', csrf_exempt(DescartarPaginaLoteView.as_view()), name='descartar-pagina-lote'),
    path('api/upload/lote/<int:lote_id>/fusionar-grupos/', csrf_exempt(FusionarGruposLoteView.as_view()), name='fusionar-grupos-lote'),
    path('api/upload/grupo/<int:grupo_id>/estructura/', csrf_exempt(EstructuraGrupoView.as_view()), name='estructura-grupo'),
    path('api/documents/<int:doc_id>/file/', DocumentoFileView.as_view(), name='doc-file'),
    path('api/documents/<int:doc_id>/original/', DocumentoOriginalView.as_view(), name='doc-original'),
    path('api/documents/<int:doc_id>/thumbnail/', DocumentoThumbnailView.as_view(), name='doc-thumbnail'),
    path('api/paginas/<int:pagina_id>/thumbnail/', PaginaThumbnailView.as_view(), name='pagina-thumbnail'),
    path('api/paginas/<int:pagina_id>/file/', PaginaFileView.as_view(), name='pagina-file'),
]
