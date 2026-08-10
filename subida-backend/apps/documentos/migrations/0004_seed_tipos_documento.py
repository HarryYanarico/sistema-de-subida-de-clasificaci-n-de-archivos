from django.db import migrations, models


def drop_slug_unique_index(apps, schema_editor):
    schema_editor.execute(
        "DROP INDEX IF EXISTS tipos_documento_slug_9e5f9c27"
    )


def seed_tipos_documento(apps, schema_editor):
    Unidad = apps.get_model('unidades', 'Unidad')
    TipoDocumento = apps.get_model('documentos', 'TipoDocumento')

    unidad, _ = Unidad.objects.get_or_create(
        slug='direccion-registro-admisiones',
        defaults={'nombre': 'Direccion de Registro y Admisiones', 'activo': True},
    )

    tipos = [
        {
            'nombre': 'Constancia de Cambio de Carrera',
            'slug': 'constancia-cambio-carrera',
            'palabras_clave': 'constancia:5,cambio:3,carrera:3,inter-area:4,inter area:4,facultad:2,origen:2,destino:2',
        },
        {
            'nombre': 'Comprobante de Pago por Cambio de Carrera',
            'slug': 'comprobante-pago-cambio-carrera',
            'palabras_clave': 'comprobante:5,pago:4,cambio:2,carrera:2,recibo:3,bs:2,monto:2,importe:2',
        },
        {
            'nombre': 'Solicitud de Cambio de Carrera',
            'slug': 'solicitud-cambio-carrera',
            'palabras_clave': 'solicitud:5,cambio:3,carrera:3,solicito:4,estudiante:2,inscrito:2',
        },
        {
            'nombre': 'Histórico Académico',
            'slug': 'historico-academico',
            'palabras_clave': 'historico:5,academico:4,notas:3,calificaciones:3,semestre:2,asignaturas:3,materias:3,rendimiento:2,curricular:2',
        },
        {
            'nombre': 'Certificado de No Deudor',
            'slug': 'certificado-no-deudor',
            'palabras_clave': 'deudor:5,deuda:4,credito:3,pagar:2,adeudo:4,financiero:2,tesoreria:2',
        },
        {
            'nombre': 'Test Psicotécnico',
            'slug': 'test-psicotecnico',
            'palabras_clave': 'psicotecnico:5,psicologico:4,test:3,aptitud:4,psicologia:3,examen psicologico:5,inteligencia:2,rasgu:3,personalidad:2',
        },
        {
            'nombre': 'Fotocopia de Carnet de Identidad',
            'slug': 'fotocopia-de-carnet-de-identidad',
            'palabras_clave': 'carnet:5,identidad:4,cedula:5,fotocopia:3,republica:3,bolivia:2,documento personal:4,direccion general:3,registro civil:3',
        },
        {
            'nombre': 'Solicitud de Retiro Voluntario',
            'slug': 'solicitud-retiro-voluntario',
            'palabras_clave': 'solicitud:3,retiro:5,voluntario:4,renuncia:4,abandono:3,desvinculacion:3',
        },
        {
            'nombre': 'Recibo de Retiro Temporal',
            'slug': 'recibo-retiro-temporal',
            'palabras_clave': 'recibo:4,retiro:5,temporal:4,semestralizado:3,devolver:2,entregar:2',
        },
        {
            'nombre': 'Formulario de Aplicación de Incentivo Empadronador',
            'slug': 'formulario-incentivo-empadronador',
            'palabras_clave': 'formulario:4,incentivo:5,empadronador:5,censo:4,alumno:2,postulante:2,ingreso:2',
        },
        {
            'nombre': 'Certificado de Nacimiento',
            'slug': 'certificado-nacimiento',
            'palabras_clave': 'nacimiento:5,certificado:3,registro civil:4,acta:4,nacido:3,lugar de nacimiento:5,fecha de nacimiento:4',
        },
        {
            'nombre': 'Diploma de Bachiller (Anverso)',
            'slug': 'diploma-bachiller-anverso',
            'palabras_clave': 'bachiller:5,diploma:4,anverso:3,titulo:3,educacion secundaria:4,direccion departamental:3,condecoracion:2',
        },
        {
            'nombre': 'Diploma de Bachiller (Reverso)',
            'slug': 'diploma-bachiller-reverso',
            'palabras_clave': 'bachiller:5,diploma:4,reverso:3,materias:4,asignaturas:4,calificaciones:3,promedio:3,anos:2',
        },
        {
            'nombre': 'Ficha de Actualización de Datos Personales (Anverso)',
            'slug': 'ficha-datos-anverso',
            'palabras_clave': 'ficha:4,datos:3,personales:3,actualizacion:4,anverso:3,formulario:2,inscripcion:2,carrera elegida:4',
        },
        {
            'nombre': 'Ficha de Actualización de Datos Personales (Reverso)',
            'slug': 'ficha-datos-reverso',
            'palabras_clave': 'ficha:4,datos:3,personales:3,actualizacion:4,reverso:3,universidades:4,sistema:2,paises:2,procedencia:3',
        },
        {
            'nombre': 'Seguro Social Universitario (Anverso)',
            'slug': 'seguro-social-anverso',
            'palabras_clave': 'seguro:5,social:4,universitario:4,anverso:3,ssue:5,afiliacion:4,solicitud de inclusion:5,salud:2,declaracion jurada:4',
        },
        {
            'nombre': 'Seguro Social Universitario (Reverso)',
            'slug': 'seguro-social-reverso',
            'palabras_clave': 'seguro:5,social:4,universitario:4,reverso:3,ssue:5,caja:4,codigo institucion:4,direccion:2,telefono:2',
        },
    ]

    for tipo in tipos:
        TipoDocumento.objects.get_or_create(
            slug=tipo['slug'],
            unidad=unidad,
            defaults=tipo,
        )


def reverse_seed(apps, schema_editor):
    TipoDocumento = apps.get_model('documentos', 'TipoDocumento')
    TipoDocumento.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('documentos', '0003_make_unidad_required'),
        ('unidades', '0002_migrar_datos_iniciales'),
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
        migrations.RunPython(seed_tipos_documento, reverse_seed),
    ]
