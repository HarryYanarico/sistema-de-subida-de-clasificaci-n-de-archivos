"""
Migración inicial de la tabla `permisos`.

El paquete anterior se distribuía SIN migraciones (solo `migrations/__init__.py`),
así que `migrate permissions` no creaba nada y cada proyecto terminaba generando
su propia 0001 con `makemigrations`. Incluirla acá hace el despliegue
determinista y evita que dos sistemas tengan migraciones distintas para la
misma tabla.

Si tu proyecto YA tiene la tabla `permisos` creada, aplicá esta migración sin
volver a crearla:

    python manage.py migrate permisos --fake-initial
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Permiso',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True, serialize=False, verbose_name='ID',
                )),
                ('codigo', models.CharField(
                    help_text='Código único del permiso (ej: sistema_titulos_imprimir)',
                    max_length=100, unique=True,
                )),
                ('nombre', models.CharField(
                    help_text='Nombre legible del permiso', max_length=200,
                )),
                ('descripcion', models.TextField(
                    blank=True, help_text='Descripción de qué permite hacer este permiso',
                )),
                ('recurso', models.CharField(
                    db_index=True,
                    help_text='Recurso/entidad sobre la que actúa (ej: titulos)',
                    max_length=50,
                )),
                ('operacion', models.CharField(
                    db_index=True,
                    help_text='Operación/acción permitida (ej: imprimir, config_campos)',
                    max_length=50,
                )),
                ('activo', models.BooleanField(
                    default=True, help_text='Si el permiso está activo',
                )),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_modificacion', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Permiso',
                'verbose_name_plural': 'Permisos',
                'db_table': 'permisos',
                'ordering': ['recurso', 'operacion'],
            },
        ),
        migrations.AddIndex(
            model_name='permiso',
            index=models.Index(
                fields=['recurso', 'operacion'], name='permisos_recurso_oper_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='permiso',
            index=models.Index(fields=['codigo'], name='permisos_codigo_idx'),
        ),
    ]
