from django.db import models
from django.conf import settings
from apps.personas.models import Persona


class TipoDocumento(models.Model):
    nombre = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    palabras_clave = models.TextField(
        help_text="Formato: palabra:peso,palabra:peso (peso 1-5, default 1)"
    )
    keywords_obligatorias = models.JSONField(
        default=list, blank=True,
        help_text=(
            "Palabras que deben aparecer para que este tipo sea candidato. "
            "Lista de strings. Si alguna no matchea, el tipo queda descartado."
        ),
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tipos_documento'
        ordering = ['nombre']
        verbose_name = 'tipo de documento'
        verbose_name_plural = 'tipos de documento'

    def __str__(self):
        return self.nombre

    @property
    def lista_palabras_clave(self):
        return [p.strip().lower() for p in self.palabras_clave.split(',') if p.strip()]

    @property
    def lista_palabras_clave_con_pesos(self):
        """`[(palabra, peso)]` parseado de `palabras_clave`.

        Delega en el modulo del clasificador para que no haya dos
        implementaciones del formato `palabra:peso` que puedan divergir.
        """
        from apps.storage.clasificador import parsear_palabras_clave

        return parsear_palabras_clave(self.palabras_clave)



class Documento(models.Model):
    # 'pendiente' se conserva: hay documentos historicos con ese valor y la
    # mutation `deleteTipoDocumento` tambien lo usa al desenlazar un tipo. Se
    # distingue de 'sin_clasificar' (el clasificador no encontro nada), de
    # 'dudosa' (encontro algo pero la eleccion no es defendible) y de
    # 'duplicado' (copia de otra pagina ya presente).
    ESTADO_CHOICES = [
        ('clasificado', 'Clasificado'),
        ('dudosa', 'Dudosa'),
        ('duplicado', 'Duplicado'),
        ('pendiente', 'Pendiente'),
        ('sin_clasificar', 'Sin clasificar'),
        ('verificado', 'Verificado'),
    ]

    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='documentos')
    tipo_documento = models.ForeignKey(
        TipoDocumento, on_delete=models.SET_NULL, null=True, blank=True, related_name='documentos'
    )
    archivo_original = models.CharField(max_length=500, help_text="Ruta del PDF original en MinIO")
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='documentos_subidos', verbose_name='Subido por'
    )
    archivo_pagina = models.CharField(
        max_length=500, null=True, blank=True,
        help_text="Ruta de la página individual en MinIO (obsoleto, se extrae on-the-fly)"
    )
    pagina_numero = models.IntegerField()
    texto_extraido = models.TextField(blank=True, default='')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    score = models.FloatField(
        null=True, blank=True,
        help_text="Puntaje del clasificador local. Null si no se pudo clasificar",
    )
    keywords_matcheadas = models.JSONField(
        default=list, blank=True,
        help_text="Palabras clave que el clasificador local encontro en el texto",
    )
    historial_clasificacion = models.JSONField(
        default=list, blank=True,
        help_text=(
            "Trazabilidad de las correcciones humanas. Una entrada por "
            "reclasificacion: quien, que estado tenia, que tipo tenia, que "
            "tipo quedo, cuando y con que score."
        ),
    )
    phash = models.CharField(
        max_length=64, null=True, blank=True, db_index=True,
        help_text="Perceptual hash de la pagina, para detectar duplicados",
    )
    duplicado_de = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='duplicados',
        help_text="Documento original del que este es una copia perceptual",
    )
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


class SugerenciaKeyword(models.Model):
    tipo_documento = models.ForeignKey(
        TipoDocumento, on_delete=models.CASCADE, related_name='sugerencias_keyword'
    )
    palabra = models.CharField(max_length=100)
    ratio = models.FloatField(help_text="Ratio de discriminación contra otros tipos")
    frecuencia = models.IntegerField(help_text="Frecuencia en documentos verificados")
    aceptada = models.BooleanField(
        null=True, blank=True, default=None,
        help_text="None=pendiente, True=aceptada, False=descartada"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sugerencias_keyword'
        ordering = ['-ratio', '-frecuencia']
        verbose_name = 'sugerencia de keyword'
        verbose_name_plural = 'sugerencias de keyword'

    def __str__(self):
        return f"{self.palabra} ({self.tipo_documento.nombre}) - ratio: {self.ratio}"

