from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('unidades', '0002_migrar_datos_iniciales'),
        ('documentos', '0002_add_unidad_fk'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tipodocumento',
            name='unidad',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tipos_documento',
                to='unidades.unidad',
            ),
        ),
    ]
