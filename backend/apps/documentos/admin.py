from django.contrib import admin
from .models import TipoDocumento, Documento


@admin.register(TipoDocumento)
class TipoDocumentoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'slug', 'es_obligatorio', 'orden', 'activo')
    list_filter = ('es_obligatorio', 'activo')
    search_fields = ('nombre',)


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ('persona', 'tipo_documento', 'pagina_numero', 'estado')
    list_filter = ('estado', 'tipo_documento')
    search_fields = ('persona__codigo', 'persona__nombres', 'persona__apellidos')
