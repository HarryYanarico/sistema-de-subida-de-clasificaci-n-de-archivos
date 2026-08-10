from django.contrib import admin
from .models import Persona


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombres', 'apellidos', 'ci', 'email', 'created_at')
    search_fields = ('codigo', 'nombres', 'apellidos', 'ci')
    list_filter = ('created_at',)
