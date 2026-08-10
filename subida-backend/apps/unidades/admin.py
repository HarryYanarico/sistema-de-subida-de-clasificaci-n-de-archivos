from django.contrib import admin
from .models import Unidad


@admin.register(Unidad)
class UnidadAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'slug', 'activo', 'created_at')
    list_filter = ('activo',)
    search_fields = ('nombre', 'descripcion')
    prepopulated_fields = {'slug': ('nombre',)}
