from django.db import migrations


def seed_personas(apps, schema_editor):
    Unidad = apps.get_model('unidades', 'Unidad')
    Persona = apps.get_model('personas', 'Persona')

    unidad = Unidad.objects.get(slug='direccion-registro-admisiones')

    personas = [
        {'codigo': '2260041', 'nombres': 'BENANCIO', 'apellidos': 'ARAMAYO CANO'},
        {'codigo': '200734237', 'nombres': 'ROCIO', 'apellidos': 'RIOS JIMENEZ'},
        {'codigo': '216013731', 'nombres': 'RAQUEL', 'apellidos': 'SUAREZ CRUZ'},
        {'codigo': '220053200', 'nombres': 'SHARON KARINA', 'apellidos': 'VEIZAGA NAZARO'},
    ]

    for p in personas:
        Persona.objects.get_or_create(
            codigo=p['codigo'],
            unidad=unidad,
            defaults=p,
        )


def reverse_seed(apps, schema_editor):
    Persona = apps.get_model('personas', 'Persona')
    codigos = ['2260041', '200734237', '216013731', '220053200']
    Persona.objects.filter(codigo__in=codigos).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('personas', '0004_alter_persona_codigo'),
        ('unidades', '0002_migrar_datos_iniciales'),
    ]

    operations = [
        migrations.RunPython(seed_personas, reverse_seed),
    ]
