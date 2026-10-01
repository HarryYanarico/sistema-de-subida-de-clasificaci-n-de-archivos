from django.contrib import admin

from .models import Permiso


@admin.register(Permiso)
class PermisoAdmin(admin.ModelAdmin):
    list_display    = ('codigo', 'nombre', 'recurso', 'operacion', 'activo')
    list_filter     = ('activo', 'recurso')
    search_fields   = ('codigo', 'nombre', 'descripcion')
    ordering        = ('codigo',)
    readonly_fields = ('codigo', 'fecha_creacion', 'fecha_modificacion')
