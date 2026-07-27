from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('documentos', '0004_seed_tipos_documento'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='tipodocumento',
            name='requiere',
        ),
        migrations.RemoveField(
            model_name='tipodocumento',
            name='excluye',
        ),
        migrations.RemoveField(
            model_name='tipodocumento',
            name='score_minimo',
        ),
        migrations.RemoveField(
            model_name='tipodocumento',
            name='es_obligatorio',
        ),
        migrations.RemoveField(
            model_name='tipodocumento',
            name='orden',
        ),
    ]
