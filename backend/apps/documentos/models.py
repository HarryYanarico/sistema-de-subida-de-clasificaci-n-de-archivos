from django.db import models
from apps.personas.models import Persona


class TipoDocumento(models.Model):
    unidad = models.ForeignKey(
        'unidades.Unidad', on_delete=models.CASCADE,
        related_name='tipos_documento', null=True, blank=True
    )
    nombre = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    palabras_clave = models.TextField(
        help_text="Formato: palabra:peso,palabra:peso (peso 1-5, default 1)"
    )
    requiere = models.TextField(
        blank=True, default='',
        help_text="Palabras que DEBEN estar presentes para clasificar (separadas por coma)"
    )
    excluye = models.TextField(
        blank=True, default='',
        help_text="Slugs de tipos que se excluyen mutuamente (separados por coma)"
    )
    score_minimo = models.IntegerField(
        default=3,
        help_text="Score mínimo ponderado para clasificar localmente"
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
        unique_together = ('slug', 'unidad')

    def __str__(self):
        return self.nombre

    @property
    def lista_palabras_clave(self):
        return [p.strip().lower() for p in self.palabras_clave.split(',') if p.strip()]

    @property
    def lista_palabras_clave_con_pesos(self):
        resultado = []
        for item in self.palabras_clave.split(','):
            item = item.strip()
            if not item:
                continue
            if ':' in item:
                partes = item.split(':')
                palabra = partes[0].strip().lower()
                try:
                    peso = int(partes[1].strip())
                except (ValueError, IndexError):
                    peso = 1
            else:
                palabra = item.lower()
                peso = 1
            resultado.append((palabra, max(1, min(5, peso))))
        return resultado

    @property
    def lista_requiere(self):
        return [r.strip().lower() for r in self.requiere.split(',') if r.strip()]

    @property
    def lista_excluye(self):
        return [e.strip() for e in self.excluye.split(',') if e.strip()]


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
    archivo_pagina = models.CharField(
        max_length=500, null=True, blank=True,
        help_text="Ruta de la página individual en MinIO (obsoleto, se extrae on-the-fly)"
    )
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
