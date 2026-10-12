from django.db import migrations, models


def drop_slug_unique_index(apps, schema_editor):
    # El modelo declara unique_together ('slug', 'unidad') pero 0001_initial creo
    # el slug con unique=True y ninguna migracion posterior lo solto. La
    # constraint global seguia en la base, asi que dos unidades no podian
    # declarar el mismo tipo de documento. Mismo arreglo que
    # personas/0004_alter_persona_codigo.py para el codigo.
    schema_editor.execute(
        'ALTER TABLE tipos_documento DROP CONSTRAINT IF EXISTS tipos_documento_slug_key'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('documentos', '0007_origenarchivos_documento_origen_id_sincronizacion'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name='tipodocumento',
                    name='slug',
                    field=models.SlugField(max_length=255),
                ),
            ],
            database_operations=[
                migrations.RunPython(drop_slug_unique_index, migrations.RunPython.noop),
            ],
        ),
    ]
