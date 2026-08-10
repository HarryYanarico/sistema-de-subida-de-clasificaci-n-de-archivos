from django.contrib import admin
from django.urls import path
from graphene_django.views import GraphQLView
from django.views.decorators.csrf import csrf_exempt
from apps.documentos.views import (
    UploadPDFView, UploadBatchPDFView,
    DocumentoFileView, DocumentoOriginalView, DocumentoThumbnailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('graphql/', csrf_exempt(GraphQLView.as_view(graphiql=True))),
    path('api/upload/', csrf_exempt(UploadPDFView.as_view()), name='upload-pdf'),
    path('api/upload/batch/', csrf_exempt(UploadBatchPDFView.as_view()), name='upload-batch-pdf'),
    path('api/documents/<int:doc_id>/file/', DocumentoFileView.as_view(), name='doc-file'),
    path('api/documents/<int:doc_id>/original/', DocumentoOriginalView.as_view(), name='doc-original'),
    path('api/documents/<int:doc_id>/thumbnail/', DocumentoThumbnailView.as_view(), name='doc-thumbnail'),
]
