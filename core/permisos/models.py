from django.db import models


class Permiso(models.Model):
    """
    Catálogo de permisos que este sistema publica hacia admincentral.

    No se consulta para autorizar: en runtime los permisos del usuario salen de
    Redis o del token. Esta tabla existe para que el administrador central
    pueda ver y asignar los permisos disponibles del sistema.

    Se sincroniza desde `codigos.CATALOGO` con `manage.py generar_permisos`.
    """

    codigo = models.CharField(
        max_length=100,
        unique=True,
        help_text="Código único del permiso (ej: sistema_titulos_imprimir)",
    )
    nombre = models.CharField(
        max_length=200,
        help_text="Nombre legible del permiso",
    )
    descripcion = models.TextField(
        blank=True,
        help_text="Descripción de qué permite hacer este permiso",
    )
    recurso = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Recurso/entidad sobre la que actúa (ej: titulos)",
    )
    operacion = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Operación/acción permitida (ej: imprimir, config_campos)",
    )
    activo = models.BooleanField(
        default=True,
        help_text="Si el permiso está activo",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'permisos'
        verbose_name = 'Permiso'
        verbose_name_plural = 'Permisos'
        ordering = ['recurso', 'operacion']
        indexes = [
            models.Index(fields=['recurso', 'operacion'], name='permisos_recurso_oper_idx'),
            models.Index(fields=['codigo'], name='permisos_codigo_idx'),
        ]

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"
