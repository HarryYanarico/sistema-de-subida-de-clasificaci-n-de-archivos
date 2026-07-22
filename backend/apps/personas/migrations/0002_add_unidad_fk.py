from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('unidades', '0001_initial'),
        ('personas', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='persona',
            name='unidad',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='personas',
                to='unidades.unidad',
            ),
        ),
        migrations.AlterUniqueTogether(
            name='persona',
            unique_together={('codigo', 'unidad')},
        ),
    ]
