from django.contrib import admin
from .models import TipoDocumento, Documento


@admin.register(TipoDocumento)
class TipoDocumentoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'slug', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre',)


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    # score y keywords_matcheadas son de solo lectura: los escribe el
    # clasificador, no el operador. Editarlos a mano desincroniza el estado.
    list_display = ('persona', 'tipo_documento', 'pagina_numero', 'estado', 'score')
    list_filter = ('estado', 'tipo_documento')
    search_fields = ('persona__codigo', 'persona__nombres', 'persona__apellidos')
    readonly_fields = ('score', 'keywords_matcheadas')