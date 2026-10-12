from django.db import models


class Persona(models.Model):
    codigo = models.CharField(max_length=20, unique=True, verbose_name='Código')
    nombres = models.CharField(max_length=255)
    apellidos = models.CharField(max_length=255)
    ci = models.CharField(max_length=20, blank=True, verbose_name='Carnet de Identidad')
    email = models.EmailField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personas'
        ordering = ['codigo']
        verbose_name = 'persona'
        verbose_name_plural = 'personas'

    def __str__(self):
        return f"{self.codigo} - {self.nombres} {self.apellidos}"

    @property
    def nombre_completo(self):
        return f"{self.nombres} {self.apellidos}"
