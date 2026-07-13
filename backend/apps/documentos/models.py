from django.db import models
from apps.personas.models import Persona


class TipoDocumento(models.Model):
    nombre = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    palabras_clave = models.TextField(
        help_text="Palabras clave separadas por coma para clasificación automática"
    )
    es_obligatorio = models.BooleanField(default=False)
    orden = models.IntegerField(default=0)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tipos_documento'
        ordering = ['orden', 'nombre']
        verbose_name = 'tipo de documento'
        verbose_name_plural = 'tipos de documento'

    def __str__(self):
        return self.nombre

    @property
    def lista_palabras_clave(self):
        return [p.strip().lower() for p in self.palabras_clave.split(',') if p.strip()]


class Documento(models.Model):
    ESTADO_CHOICES = [
        ('clasificado', 'Clasificado'),
        ('pendiente', 'Pendiente'),
        ('verificado', 'Verificado'),
    ]

    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='documentos')
    tipo_documento = models.ForeignKey(
        TipoDocumento, on_delete=models.SET_NULL, null=True, blank=True, related_name='documentos'
    )
    archivo_original = models.CharField(max_length=500, help_text="Ruta del PDF original en MinIO")
    archivo_pagina = models.CharField(max_length=500, help_text="Ruta de la página individual en MinIO")
    pagina_numero = models.IntegerField()
    texto_extraido = models.TextField(blank=True, default='')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'documentos'
        ordering = ['persona', 'pagina_numero']
        verbose_name = 'documento'
        verbose_name_plural = 'documentos'

    def __str__(self):
        tipo = self.tipo_documento.nombre if self.tipo_documento else 'Sin clasificar'
        return f"{self.persona.codigo} - Pág {self.pagina_numero} - {tipo}"
