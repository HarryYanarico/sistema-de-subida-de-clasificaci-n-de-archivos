from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('personas', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TipoDocumento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=255, unique=True)),
                ('palabras_clave', models.TextField(help_text='Formato: palabra:peso,palabra:peso (peso 1-5, default 1)')),
                ('keywords_obligatorias', models.JSONField(blank=True, default=list, help_text='Palabras que deben aparecer para que este tipo sea candidato. Lista de strings. Si alguna no matchea, el tipo queda descartado.')),
                ('activo', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'tipo de documento',
                'verbose_name_plural': 'tipos de documento',
                'db_table': 'tipos_documento',
                'ordering': ['nombre'],
            },
        ),
        migrations.CreateModel(
            name='Documento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('archivo_original', models.CharField(help_text='Ruta del PDF original en MinIO', max_length=500)),
                ('archivo_pagina', models.CharField(blank=True, help_text='Ruta de la página individual en MinIO (obsoleto, se extrae on-the-fly)', max_length=500, null=True)),
                ('pagina_numero', models.IntegerField()),
                ('texto_extraido', models.TextField(blank=True, default='')),
                ('estado', models.CharField(choices=[('clasificado', 'Clasificado'), ('dudosa', 'Dudosa'), ('duplicado', 'Duplicado'), ('pendiente', 'Pendiente'), ('sin_clasificar', 'Sin clasificar'), ('verificado', 'Verificado')], default='pendiente', max_length=20)),
                ('score', models.FloatField(blank=True, help_text='Puntaje del clasificador local. Null si no se pudo clasificar', null=True)),
                ('keywords_matcheadas', models.JSONField(blank=True, default=list, help_text='Palabras clave que el clasificador local encontro en el texto')),
                ('historial_clasificacion', models.JSONField(blank=True, default=list, help_text='Trazabilidad de las correcciones humanas. Una entrada por reclasificacion: quien, que estado tenia, que tipo tenia, que tipo quedo, cuando y con que score.')),
                ('phash', models.CharField(blank=True, db_index=True, help_text='Perceptual hash de la pagina, para detectar duplicados', max_length=64, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('duplicado_de', models.ForeignKey(blank=True, help_text='Documento original del que este es una copia perceptual', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='duplicados', to='documentos.documento')),
                ('persona', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documentos', to='personas.persona')),
                ('subido_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='documentos_subidos', to=settings.AUTH_USER_MODEL, verbose_name='Subido por')),
                ('tipo_documento', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='documentos', to='documentos.tipodocumento')),
            ],
            options={
                'verbose_name': 'documento',
                'verbose_name_plural': 'documentos',
                'db_table': 'documentos',
                'ordering': ['persona', 'pagina_numero'],
            },
        ),
        migrations.CreateModel(
            name='SugerenciaKeyword',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('palabra', models.CharField(max_length=100)),
                ('ratio', models.FloatField(help_text='Ratio de discriminación contra otros tipos')),
                ('frecuencia', models.IntegerField(help_text='Frecuencia en documentos verificados')),
                ('aceptada', models.BooleanField(blank=True, default=None, help_text='None=pendiente, True=aceptada, False=descartada', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tipo_documento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sugerencias_keyword', to='documentos.tipodocumento')),
            ],
            options={
                'verbose_name': 'sugerencia de keyword',
                'verbose_name_plural': 'sugerencias de keyword',
                'db_table': 'sugerencias_keyword',
                'ordering': ['-ratio', '-frecuencia'],
            },
        ),
    ]
