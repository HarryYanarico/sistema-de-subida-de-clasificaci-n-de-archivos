from django.db import models
from django.conf import settings
from apps.personas.models import Persona


class TipoDocumento(models.Model):
    unidad = models.ForeignKey(
        'core.Unidad', on_delete=models.CASCADE, related_name='tipos_documento', verbose_name='Unidad'
    )
    nombre = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    color = models.CharField(max_length=50, blank=True, default='#3B82F6')
    firma_consolidada = models.JSONField(default=dict, blank=True)
    ejemplos_paginas = models.ManyToManyField('Pagina', blank=True, related_name='tipos_ejemplo')
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
        unique_together = [('slug', 'unidad')]
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

    def save(self, *args, **kwargs):
        if not self.unidad_id:
            from apps.core.models import Unidad
            legacy, _ = Unidad.objects.get_or_create(codigo="LEGACY", defaults={"nombre": "Unidad Legacy Transitoria"})
            self.unidad = legacy
        super().save(*args, **kwargs)


class Lote(models.Model):
    ESTADO_CHOICES = [
        ('procesando', 'Procesando'),
        ('pendiente_nombres', 'Pendiente de nombres'),
        ('confirmado', 'Confirmado'),
        ('descartado', 'Descartado'),
    ]

    unidad = models.ForeignKey(
        'core.Unidad', on_delete=models.CASCADE, related_name='lotes', verbose_name='Unidad'
    )
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='lotes_subidos', verbose_name='Subido por'
    )
    persona = models.ForeignKey(
        Persona, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='lotes', verbose_name='Persona'
    )
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='procesando')
    nombre_archivo_original = models.CharField(max_length=500, blank=True, default='')
    total_paginas = models.IntegerField(default=0)
    total_grupos = models.IntegerField(default=0)
    borrador_agrupamiento = models.JSONField(
        default=dict, blank=True,
        help_text="Estado del borrador interactivo de slots y asignaciones de grupos"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lotes'
        ordering = ['-created_at']
        verbose_name = 'lote'
        verbose_name_plural = 'lotes'

    def __str__(self):
        return f"Lote {self.id} ({self.nombre_archivo_original}) - {self.estado}"

    def save(self, *args, **kwargs):
        if not self.unidad_id:
            from apps.core.models import Unidad
            legacy, _ = Unidad.objects.get_or_create(codigo="LEGACY", defaults={"nombre": "Unidad Legacy Transitoria"})
            self.unidad = legacy
        super().save(*args, **kwargs)


class Grupo(models.Model):
    ESTADO_CHOICES = [
        ('nuevo', 'Nuevo'),
        ('coincide_con_tipo', 'Coincide con tipo'),
        ('confirmado', 'Confirmado'),
        ('rechazado', 'Rechazado'),
        ('fusionado', 'Fusionado'),
        ('descartadas', 'Descartadas'),
    ]

    unidad = models.ForeignKey(
        'core.Unidad', on_delete=models.CASCADE, related_name='grupos', verbose_name='Unidad'
    )
    lote = models.ForeignKey(
        Lote, on_delete=models.CASCADE, related_name='grupos', verbose_name='Lote'
    )
    firma_consolidada = models.JSONField(default=dict, blank=True)
    total_paginas = models.IntegerField(default=0)
    tipo_documento_sugerido = models.ForeignKey(
        TipoDocumento, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='grupos_sugeridos', verbose_name='Tipo de documento sugerido'
    )
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='nuevo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'grupos'
        ordering = ['id']
        verbose_name = 'grupo'
        verbose_name_plural = 'grupos'

    def __str__(self):
        return f"Grupo {self.id} (Lote {self.lote_id}) - {self.estado} ({self.total_paginas} págs)"

    def save(self, *args, **kwargs):
        if not self.unidad_id and self.lote_id and getattr(self.lote, 'unidad_id', None):
            self.unidad = self.lote.unidad
        elif not self.unidad_id:
            from apps.core.models import Unidad
            legacy, _ = Unidad.objects.get_or_create(codigo="LEGACY", defaults={"nombre": "Unidad Legacy Transitoria"})
            self.unidad = legacy
        super().save(*args, **kwargs)


class Pagina(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('agrupada', 'Agrupada'),
        ('confirmada', 'Confirmada'),
        ('descartada', 'Descartada'),
        ('sin_agrupar', 'Sin agrupar'),
        ('duplicada', 'Duplicada'),
    ]

    unidad = models.ForeignKey(
        'core.Unidad', on_delete=models.CASCADE, related_name='paginas', verbose_name='Unidad'
    )
    lote = models.ForeignKey(
        Lote, on_delete=models.CASCADE, related_name='paginas', verbose_name='Lote'
    )
    pdf_origen = models.CharField(max_length=500, help_text="Nombre o ruta del PDF origen")
    nro_pagina_en_pdf = models.IntegerField(help_text="Número de página en el PDF (1-indexado)")
    texto_ocr = models.TextField(blank=True, default='')
    firma_palabras = models.JSONField(default=list, blank=True, help_text="Lista de top-N palabras normalizadas")
    firma_estructura = models.JSONField(default=dict, blank=True, help_text="{largo, ratio_numeros, patrones}")
    phash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    descartable = models.BooleanField(default=False)
    grupo = models.ForeignKey(
        Grupo, on_delete=models.SET_NULL, null=True, blank=True, related_name='paginas'
    )
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'paginas'
        ordering = ['lote', 'nro_pagina_en_pdf']
        verbose_name = 'página'
        verbose_name_plural = 'páginas'

    def __str__(self):
        return f"Pág {self.nro_pagina_en_pdf} (Lote {self.lote_id}) - {self.estado}"

    def save(self, *args, **kwargs):
        if not self.unidad_id and self.lote_id and getattr(self.lote, 'unidad_id', None):
            self.unidad = self.lote.unidad
        elif not self.unidad_id:
            from apps.core.models import Unidad
            legacy, _ = Unidad.objects.get_or_create(codigo="LEGACY", defaults={"nombre": "Unidad Legacy Transitoria"})
            self.unidad = legacy
        super().save(*args, **kwargs)


class Documento(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('confirmado', 'Confirmado'),
        ('incompleto', 'Incompleto'),
        ('verificado', 'Verificado'),
        # Conservados para retrocompatibilidad con registros existentes
        ('clasificado', 'Clasificado'),
        ('dudosa', 'Dudosa'),
        ('duplicado', 'Duplicado'),
        ('sin_clasificar', 'Sin clasificar'),
    ]

    unidad = models.ForeignKey(
        'core.Unidad', on_delete=models.CASCADE, related_name='documentos', verbose_name='Unidad'
    )
    lote = models.ForeignKey(
        Lote, on_delete=models.CASCADE, null=True, blank=True, related_name='documentos', verbose_name='Lote'
    )
    grupo = models.ForeignKey(
        Grupo, on_delete=models.SET_NULL, null=True, blank=True, related_name='documentos', verbose_name='Grupo'
    )
    tipo_documento = models.ForeignKey(
        TipoDocumento, on_delete=models.SET_NULL, null=True, blank=True, related_name='documentos'
    )
    paginas = models.ManyToManyField(
        Pagina, related_name='documentos', blank=True
    )
    es_doble_cara = models.BooleanField(default=False)
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='pendiente')
    nombre_final = models.CharField(max_length=255, blank=True, default='')
    historial_clasificacion = models.JSONField(
        default=list, blank=True,
        help_text="Trazabilidad de las correcciones humanas o asignaciones."
    )

    # Campos conservados para compatibilidad con el pipeline y vistas actuales
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, null=True, blank=True, related_name='documentos')
    archivo_original = models.CharField(max_length=500, blank=True, default='', help_text="Ruta del PDF original en MinIO")
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='documentos_subidos', verbose_name='Subido por'
    )
    archivo_pagina = models.CharField(
        max_length=500, null=True, blank=True,
        help_text="Ruta de la página individual en MinIO (obsoleto, se extrae on-the-fly)"
    )
    pagina_numero = models.IntegerField(default=1)
    texto_extraido = models.TextField(blank=True, default='')
    score = models.FloatField(
        null=True, blank=True,
        help_text="Puntaje del clasificador local. Null si no se pudo clasificar",
    )
    keywords_matcheadas = models.JSONField(
        default=list, blank=True,
        help_text="Palabras clave que el clasificador local encontro en el texto",
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
        ordering = ['id']
        verbose_name = 'documento'
        verbose_name_plural = 'documentos'

    def __str__(self):
        nombre = self.nombre_final or (self.tipo_documento.nombre if self.tipo_documento else 'Sin clasificar')
        return f"Doc {self.id} - {nombre} ({self.estado})"

    @property
    def total_paginas(self):
        count = self.paginas.count()
        return count if count > 0 else 1

    def set_paginas_ordenadas(self, paginas_ordenadas):
        """Asigna las páginas al documento y actualiza la columna `orden` en `documentos_paginas`."""
        from django.db import connection

        paginas_list = list(paginas_ordenadas)
        self.paginas.set(paginas_list)
        if not paginas_list or not self.id:
            return
        with connection.cursor() as cursor:
            for idx, pag in enumerate(paginas_list, start=1):
                pag_id = pag.id if hasattr(pag, 'id') else int(pag)
                cursor.execute(
                    "UPDATE documentos_paginas SET orden = %s WHERE documento_id = %s AND pagina_id = %s",
                    [idx, self.id, pag_id],
                )

    def get_paginas_ordenadas(self):
        """Devuelve las páginas del documento ordenadas por `documentos_paginas.orden`."""
        if not self.id:
            return []
        return list(
            self.paginas.extra(
                select={'_orden_dp': 'documentos_paginas.orden'},
                order_by=['_orden_dp', 'paginas.nro_pagina_en_pdf', 'paginas.id'],
            )
        )

    def save(self, *args, **kwargs):
        if not self.unidad_id:
            if self.lote_id and getattr(self.lote, 'unidad_id', None):
                self.unidad = self.lote.unidad
            elif self.persona_id and getattr(self.persona, 'unidad_id', None):
                self.unidad = self.persona.unidad
            elif self.tipo_documento_id and getattr(self.tipo_documento, 'unidad_id', None):
                self.unidad = self.tipo_documento.unidad
            else:
                from apps.core.models import Unidad
                legacy, _ = Unidad.objects.get_or_create(codigo="LEGACY", defaults={"nombre": "Unidad Legacy Transitoria"})
                self.unidad = legacy
        super().save(*args, **kwargs)


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
