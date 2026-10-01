from django.core.management.base import BaseCommand

from core.permisos.services import PermisoService


class Command(BaseCommand):
    help = 'Sincroniza el catálogo de permisos (core/permisos/codigos.py) con la base de datos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--silent',
            action='store_true',
            help='No muestra mensajes de progreso',
        )
        parser.add_argument(
            '--conservar-obsoletos',
            action='store_true',
            help='No elimina los permisos que ya no están en el catálogo',
        )

    def handle(self, *args, **options):
        verbose = not options['silent']

        if verbose:
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('  SINCRONIZACIÓN DEL CATÁLOGO DE PERMISOS'))
            self.stdout.write(self.style.SUCCESS('=' * 60))

        resultado = PermisoService.escanear_y_generar_permisos(
            verbose=verbose,
            eliminar_obsoletos=not options['conservar_obsoletos'],
        )

        if verbose:
            self.stdout.write(self.style.SUCCESS('=' * 60))

        if resultado['eliminados']:
            self.stdout.write(self.style.WARNING(
                f"Se eliminaron {resultado['eliminados']} permisos que ya no están "
                f"en el catálogo. Usa --conservar-obsoletos para evitarlo."
            ))
