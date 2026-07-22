from django.db import migrations


def forwards(apps, schema_editor):
    Unidad = apps.get_model('unidades', 'Unidad')
    unidad, _ = Unidad.objects.get_or_create(
        nombre='Direccion de Registro y Admisiones',
        defaults={'slug': 'direccion-registro-admisiones', 'activo': True},
    )

    Persona = apps.get_model('personas', 'Persona')
    Persona.objects.update(unidad=unidad)

    TipoDocumento = apps.get_model('documentos', 'TipoDocumento')
    TipoDocumento.objects.update(unidad=unidad)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('unidades', '0001_initial'),
        ('personas', '0002_add_unidad_fk'),
        ('documentos', '0002_add_unidad_fk'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
