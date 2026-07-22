from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('unidades', '0001_initial'),
        ('documentos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tipodocumento',
            name='unidad',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tipos_documento',
                to='unidades.unidad',
            ),
        ),
        migrations.AlterUniqueTogether(
            name='tipodocumento',
            unique_together={('slug', 'unidad')},
        ),
    ]
