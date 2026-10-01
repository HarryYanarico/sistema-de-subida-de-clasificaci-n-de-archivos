from django.contrib import admin
from .models import TipoDocumento, Documento, OrigenArchivos, Sincronizacion


@admin.register(TipoDocumento)
class TipoDocumentoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'slug', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre',)


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ('persona', 'tipo_documento', 'pagina_numero', 'estado')
    list_filter = ('estado', 'tipo_documento')
    search_fields = ('persona__codigo', 'persona__nombres', 'persona__apellidos')


@admin.register(OrigenArchivos)
class OrigenArchivosAdmin(admin.ModelAdmin):
    list_display = ('unidad', 'tipo', 'identificador', 'drive_compartido', 'activo',
                    'ultima_sincronizacion')
    list_filter = ('tipo', 'activo', 'drive_compartido')
    search_fields = ('unidad__nombre', 'identificador')


@admin.register(Sincronizacion)
class SincronizacionAdmin(admin.ModelAdmin):
    list_display = ('origen', 'estado', 'iniciada_en', 'encontrada', 'procesados',
                    'omitidos_ya_importados', 'errores', 'paginas')
    list_filter = ('estado', 'origen__tipo')
    search_fields = ('origen__unidad__nombre',)
    readonly_fields = ('iniciada_en',)