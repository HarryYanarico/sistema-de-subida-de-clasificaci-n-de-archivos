from django.db.migrations import RunPython
from apps.documentos.models import TipoDocumento


def seed_tipos_documento(apps, schema_editor):
    tipos = [
        {
            'nombre': 'Constancia de Cambio de Carrera',
            'slug': 'constancia-cambio-carrera',
            'palabras_clave': 'constancia,cambio,carrera',
            'es_obligatorio': False,
            'orden': 1,
        },
        {
            'nombre': 'Comprobante de Pago por Cambio de Carrera',
            'slug': 'comprobante-pago-cambio-carrera',
            'palabras_clave': 'comprobante,pago,cambio,carrera',
            'es_obligatorio': False,
            'orden': 2,
        },
        {
            'nombre': 'Solicitud de Cambio de Carrera',
            'slug': 'solicitud-cambio-carrera',
            'palabras_clave': 'solicitud,cambio,carrera',
            'es_obligatorio': False,
            'orden': 3,
        },
        {
            'nombre': 'Histórico Académico',
            'slug': 'historico-academico',
            'palabras_clave': 'historico,academico,notas,calificaciones',
            'es_obligatorio': True,
            'orden': 4,
        },
        {
            'nombre': 'Certificado de No Deudor',
            'slug': 'certificado-no-deudor',
            'palabras_clave': 'deudor,deuda,credito,pagar',
            'es_obligatorio': True,
            'orden': 5,
        },
        {
            'nombre': 'Test Psicotécnico',
            'slug': 'test-psicotecnico',
            'palabras_clave': 'psicotecnico,psicologico,test,aptitud',
            'es_obligatorio': True,
            'orden': 6,
        },
        {
            'nombre': 'Fotocopia de Carnet de Identidad',
            'slug': 'fotocopia-carnet-identidad',
            'palabras_clave': 'carnet,identidad,fotocopia,ci,documento personal',
            'es_obligatorio': True,
            'orden': 7,
        },
        {
            'nombre': 'Solicitud de Retiro Voluntario',
            'slug': 'solicitud-retiro-voluntario',
            'palabras_clave': 'solicitud,retiro,voluntario',
            'es_obligatorio': False,
            'orden': 8,
        },
        {
            'nombre': 'Recibo de Retiro Temporal',
            'slug': 'recibo-retiro-temporal',
            'palabras_clave': 'recibo,retiro,temporal,semestralizado',
            'es_obligatorio': False,
            'orden': 9,
        },
        {
            'nombre': 'Formulario de Aplicación de Incentivo Empadronador',
            'slug': 'formulario-incentivo-empadronador',
            'palabras_clave': 'formulario,incentivo,empadronador,censo',
            'es_obligatorio': False,
            'orden': 10,
        },
        {
            'nombre': 'Certificado de Nacimiento',
            'slug': 'certificado-nacimiento',
            'palabras_clave': 'nacimiento,certificado,nacimiento',
            'es_obligatorio': True,
            'orden': 11,
        },
        {
            'nombre': 'Diploma de Bachiller (Anverso)',
            'slug': 'diploma-bachiller-anverso',
            'palabras_clave': 'bachiller,diploma,anverso,titulo',
            'es_obligatorio': True,
            'orden': 12,
        },
        {
            'nombre': 'Diploma de Bachiller (Reverso)',
            'slug': 'diploma-bachiller-reverso',
            'palabras_clave': 'bachiller,diploma,reverso',
            'es_obligatorio': True,
            'orden': 13,
        },
        {
            'nombre': 'Ficha de Actualización de Datos Personales (Anverso)',
            'slug': 'ficha-datos-anverso',
            'palabras_clave': 'ficha,datos,personales,actualizacion,anverso',
            'es_obligatorio': True,
            'orden': 14,
        },
        {
            'nombre': 'Ficha de Actualización de Datos Personales (Reverso)',
            'slug': 'ficha-datos-reverso',
            'palabras_clave': 'ficha,datos,personales,actualizacion,reverso',
            'es_obligatorio': True,
            'orden': 15,
        },
        {
            'nombre': 'Seguro Social Universitario (Anverso)',
            'slug': 'seguro-social-anverso',
            'palabras_clave': 'seguro,social,universitario,anverso',
            'es_obligatorio': True,
            'orden': 16,
        },
        {
            'nombre': 'Seguro Social Universitario (Reverso)',
            'slug': 'seguro-social-reverso',
            'palabras_clave': 'seguro,social,universitario,reverso',
            'es_obligatorio': True,
            'orden': 17,
        },
    ]

    for tipo in tipos:
        TipoDocumento.objects.get_or_create(
            slug=tipo['slug'],
            defaults=tipo,
        )


def reverse_seed(apps, schema_editor):
    TipoDocumento.objects.all().delete()
