from django.db import migrations, models
import django.db.models.deletion


def asignar_unidad_legacy_a_documentos(apps, schema_editor):
    Unidad = apps.get_model('core', 'Unidad')
    TipoDocumento = apps.get_model('documentos', 'TipoDocumento')
    Documento = apps.get_model('documentos', 'Documento')
    try:
        legacy = Unidad.objects.get(codigo='LEGACY')
        TipoDocumento.objects.filter(unidad__isnull=True).update(unidad=legacy)
        Documento.objects.filter(unidad__isnull=True).update(unidad=legacy)
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('documentos', '0001_initial'),
        ('core', '0002_create_legacy_unidad'),
    ]

    operations = [
        migrations.AddField(
            model_name='tipodocumento',
            name='unidad',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tipos_documento',
                to='core.unidad',
                verbose_name='Unidad',
            ),
        ),
        migrations.AddField(
            model_name='documento',
            name='unidad',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='documentos',
                to='core.unidad',
                verbose_name='Unidad',
            ),
        ),
        migrations.RunPython(asignar_unidad_legacy_a_documentos, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='tipodocumento',
            name='unidad',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tipos_documento',
                to='core.unidad',
                verbose_name='Unidad',
            ),
        ),
        migrations.AlterField(
            model_name='documento',
            name='unidad',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='documentos',
                to='core.unidad',
                verbose_name='Unidad',
            ),
        ),
        migrations.AlterField(
            model_name='tipodocumento',
            name='slug',
            field=models.SlugField(max_length=255),
        ),
        migrations.AlterUniqueTogether(
            name='tipodocumento',
            unique_together={('slug', 'unidad')},
        ),
    ]
