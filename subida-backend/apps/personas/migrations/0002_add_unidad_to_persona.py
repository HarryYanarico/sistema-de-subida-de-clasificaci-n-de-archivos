from django.db import migrations, models
import django.db.models.deletion


def asignar_unidad_legacy_a_personas(apps, schema_editor):
    Unidad = apps.get_model('core', 'Unidad')
    Persona = apps.get_model('personas', 'Persona')
    try:
        legacy = Unidad.objects.get(codigo='LEGACY')
        Persona.objects.filter(unidad__isnull=True).update(unidad=legacy)
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('personas', '0001_initial'),
        ('core', '0002_create_legacy_unidad'),
    ]

    operations = [
        migrations.AddField(
            model_name='persona',
            name='unidad',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='personas',
                to='core.unidad',
                verbose_name='Unidad',
            ),
        ),
        migrations.RunPython(asignar_unidad_legacy_a_personas, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='persona',
            name='unidad',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='personas',
                to='core.unidad',
                verbose_name='Unidad',
            ),
        ),
        migrations.AlterField(
            model_name='persona',
            name='codigo',
            field=models.CharField(max_length=20, verbose_name='Código'),
        ),
        migrations.AlterUniqueTogether(
            name='persona',
            unique_together={('codigo', 'unidad')},
        ),
    ]
