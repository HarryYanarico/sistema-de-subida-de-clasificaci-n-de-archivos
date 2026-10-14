from django.core.management.base import BaseCommand
from apps.documentos.services import generar_sugerencias_keywords


class Command(BaseCommand):
    help = "Analiza documentos verificados por humanos para sugerir estadísticamente nuevas palabras clave por TipoDocumento."

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-docs',
            type=int,
            default=10,
            help='Número mínimo de documentos verificados necesarios para evitar advertencia (default: 10).',
        )
        parser.add_argument(
            '--top',
            type=int,
            default=5,
            help='Cantidad máxima de sugerencias a generar por tipo de documento (default: 5).',
        )
        parser.add_argument(
            '--limpiar',
            action='store_true',
            help='Eliminar sugerencias pendientes previas antes de calcular.',
        )

    def handle(self, *args, **options):
        min_docs = options['min_docs']
        top = options['top']
        limpiar = options['limpiar']

        res = generar_sugerencias_keywords(min_docs=min_docs, top=top, limpiar=limpiar)
        if res['success']:
            self.stdout.write(self.style.SUCCESS(res['message']))
        else:
            self.stdout.write(self.style.WARNING(res['message']))
