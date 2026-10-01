from django.db import models
from django.conf import settings
from apps.personas.models import Persona


class TipoDocumento(models.Model):
    unidad = models.ForeignKey(
        'unidades.Unidad', on_delete=models.CASCADE,
        related_name='tipos_documento'
    )
    nombre = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    palabras_clave = models.TextField(
        help_text="Formato: palabra:peso,palabra:peso (peso 1-5, default 1)"
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tipos_documento'
        ordering = ['nombre']
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
    origen_id = models.CharField(
        max_length=500, null=True, blank=True, db_index=True,
        help_text="Identificador del archivo en el proveedor de origen (evita reimportar)"
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


class OrigenArchivos(models.Model):
    TIPO_CHOICES = [
        ('google_drive', 'Google Drive'),
        ('s3', 'Almacenamiento S3 compatible'),
        ('onedrive', 'OneDrive / SharePoint'),
        ('carpeta', 'Carpeta local o de red'),
    ]

    unidad = models.OneToOneField(
        'unidades.Unidad', on_delete=models.CASCADE, related_name='origen_archivos'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='google_drive')
    identificador = models.CharField(
        max_length=500, blank=True, default='',
        help_text="Carpeta de Drive, o bucket/prefijo S3, o ruta local"
    )
    drive_compartido = models.BooleanField(
        default=False,
        help_text="Marcar si el identificador es un Drive compartido y no una Drive personal"
    )
    credencial_ref = models.CharField(
        max_length=255, blank=True, default='',
        help_text="Alias del secreto (ruta del JSON o variable de entorno). Nunca la clave en sí"
    )
    activo = models.BooleanField(default=True)
    marca_tiempo = models.DateTimeField(
        null=True, blank=True,
        help_text="Última modificación importada. Solo se usa como pre-filtro"
    )
    ultima_sincronizacion = models.DateTimeField(null=True, blank=True)
    ultimo_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'origen_archivos'
        verbose_name = 'origen de archivos'
        verbose_name_plural = 'origenes de archivos'

    def __str__(self):
        return f'{self.unidad} ({self.get_tipo_display()})'


class Sincronizacion(models.Model):
    ESTADO_CHOICES = [
        ('exitosa', 'Exitosa'),
        ('con_errores', 'Con errores'),
        ('fallida', 'Fallida'),
    ]

    origen = models.ForeignKey(
        OrigenArchivos, on_delete=models.CASCADE, related_name='sincronizaciones'
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='exitosa')
    iniciada_en = models.DateTimeField(auto_now_add=True)
    encontrada = models.IntegerField(default=0)
    procesados = models.IntegerField(default=0)
    omitidos_ya_importados = models.IntegerField(default=0)
    omitidos_sin_codigo = models.IntegerField(default=0)
    omitidos_sin_persona = models.IntegerField(default=0)
    omitidos_tamano = models.IntegerField(default=0)
    omitidos_no_pdf = models.IntegerField(default=0)
    paginas = models.IntegerField(default=0)
    errores = models.IntegerField(default=0)
    mensaje = models.TextField(blank=True, default='')
    detalle = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = 'sincronizaciones'
        ordering = ['-iniciada_en']
        verbose_name = 'sincronización'
        verbose_name_plural = 'sincronizaciones'

    def __str__(self):
        return f'{self.origen} - {self.iniciada_en:%Y-%m-%d %H:%M} - {self.get_estado_display()}'
