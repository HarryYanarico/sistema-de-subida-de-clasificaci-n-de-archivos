from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('personas', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TipoDocumento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=255, unique=True)),
                ('palabras_clave', models.TextField(help_text='Formato: palabra:peso,palabra:peso (peso 1-5, default 1)')),
                ('requiere', models.TextField(blank=True, default='', help_text='Palabras que DEBEN estar presentes para clasificar (separadas por coma)')),
                ('excluye', models.TextField(blank=True, default='', help_text='Slugs de tipos que se excluyen mutuamente (separados por coma)')),
                ('score_minimo', models.IntegerField(default=3, help_text='Score mínimo ponderado para clasificar localmente')),
                ('es_obligatorio', models.BooleanField(default=False)),
                ('orden', models.IntegerField(default=0)),
                ('activo', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'tipo de documento',
                'verbose_name_plural': 'tipos de documento',
                'db_table': 'tipos_documento',
                'ordering': ['orden', 'nombre'],
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
                ('estado', models.CharField(choices=[('clasificado', 'Clasificado'), ('pendiente', 'Pendiente'), ('verificado', 'Verificado')], default='pendiente', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('persona', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documentos', to='personas.persona')),
                ('tipo_documento', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='documentos', to='documentos.tipodocumento')),
            ],
            options={
                'verbose_name': 'documento',
                'verbose_name_plural': 'documentos',
                'db_table': 'documentos',
                'ordering': ['persona', 'pagina_numero'],
            },
        ),
    ]
