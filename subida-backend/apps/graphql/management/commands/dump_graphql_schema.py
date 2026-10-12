"""Vuelca el SDL del schema GraphQL a un archivo, para revisión en diffs.

El SDL es el contrato público de la API: si este comando no necesita cambios
cuando se cambia una librería, la migración fue neutral. Si aparece o desaparece
una operación o un campo, hay que justificarlo en el mensaje del commit.

    python manage.py dump_graphql_schema                      # a stdout
    python manage.py dump_graphql_schema -o docs/schema.graphql
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Exporta el SDL del schema GraphQL (config.schema.schema)'

    def add_arguments(self, parser):
        parser.add_argument(
            '-o',
            '--output',
            dest='output',
            help='Archivo de destino. Si se omite, se escribe en stdout.',
        )

    def handle(self, *args, **options):
        from config.schema import schema

        # str() imprime el SDL tanto en graphene como en strawberry, asi el
        # comando sirve para comparar la linea base con el schema migrado.
        sdl = str(schema)

        destino = options.get('output')
        if not destino:
            self.stdout.write(sdl)
            return

        ruta = Path(destino)
        if not ruta.parent.exists():
            raise CommandError(f'No existe el directorio destino: {ruta.parent}')

        ruta.write_text(sdl + '\n', encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'SDL exportado a {ruta}'))