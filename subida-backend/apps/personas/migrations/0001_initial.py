from django.db import migrations, models


def seed_personas(apps, schema_editor):
    Persona = apps.get_model('personas', 'Persona')
    personas = [
        {'codigo': '2260041', 'nombres': 'BENANCIO', 'apellidos': 'ARAMAYO CANO'},
        {'codigo': '200734237', 'nombres': 'ROCIO', 'apellidos': 'RIOS JIMENEZ'},
        {'codigo': '216013731', 'nombres': 'RAQUEL', 'apellidos': 'SUAREZ CRUZ'},
        {'codigo': '220053200', 'nombres': 'SHARON KARINA', 'apellidos': 'VEIZAGA NAZARO'},
    ]
    for p in personas:
        Persona.objects.get_or_create(codigo=p['codigo'], defaults=p)


def reverse_seed(apps, schema_editor):
    Persona = apps.get_model('personas', 'Persona')
    codigos = ['2260041', '200734237', '216013731', '220053200']
    Persona.objects.filter(codigo__in=codigos).delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Persona',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=20, unique=True, verbose_name='Código')),
                ('nombres', models.CharField(max_length=255)),
                ('apellidos', models.CharField(max_length=255)),
                ('ci', models.CharField(blank=True, max_length=20, verbose_name='Carnet de Identidad')),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('telefono', models.CharField(blank=True, max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'persona',
                'verbose_name_plural': 'personas',
                'db_table': 'personas',
                'ordering': ['codigo'],
            },
        ),
        migrations.RunPython(seed_personas, reverse_seed),
    ]
