from django.db import migrations, models
import django.db.models.deletion


def asignar_unidad_legacy_a_usuarios(apps, schema_editor):
    Unidad = apps.get_model('core', 'Unidad')
    User = apps.get_model('users', 'User')
    try:
        legacy = Unidad.objects.get(codigo='LEGACY')
        User.objects.filter(unidad__isnull=True).update(unidad=legacy)
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_managers_user_groups_and_more'),
        ('core', '0002_create_legacy_unidad'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='cod_empleado',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='Código de empleado'),
        ),
        migrations.AddField(
            model_name='user',
            name='unidad',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='usuarios', to='core.unidad', verbose_name='Unidad'),
        ),
        migrations.RunPython(asignar_unidad_legacy_a_usuarios, migrations.RunPython.noop),
    ]
