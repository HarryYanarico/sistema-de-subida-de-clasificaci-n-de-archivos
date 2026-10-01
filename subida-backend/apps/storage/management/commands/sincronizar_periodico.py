import logging
import os
import signal
import time

from django.core.management import call_command
from django.core.management.base import BaseCommand

logger = logging.getLogger('sincronizacion')

DEFAULT_INTERVALO = 240
TRAMO_SLEEP = 5


def intervalo_desde_env():
    try:
        return max(1, int(os.getenv('SYNC_INTERVAL_MINUTOS', DEFAULT_INTERVALO)))
    except (TypeError, ValueError):
        return DEFAULT_INTERVALO


class Command(BaseCommand):
    help = (
        'Ejecuta sincronizar_origenes en bucle, cada N minutos. Pensado para el '
        'contenedor scheduler. Con --once corre un solo ciclo y sale, util para '
        'probar o para un cron externo.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--intervalo', type=int, default=None,
            help=f'Minutos entre sincronizaciones. Default: SYNC_INTERVAL_MINUTOS '
                 f'o {DEFAULT_INTERVALO}.',
        )
        parser.add_argument(
            '--once', action='store_true',
            help='Corre un solo ciclo y termina.',
        )

    def handle(self, *args, **opciones):
        intervalo = opciones['intervalo'] or intervalo_desde_env()
        if intervalo < 1:
            intervalo = 1

        if opciones['once']:
            self.ejecutar_ciclo()
            return

        self.stdout.write(
            f'Sincronizacion periodica: cada {intervalo} minuto(s). '
            f'Ctrl+C o SIGTERM para detener.'
        )

        terminar = {'pedido': False}

        def _salir(signum, frame):
            logger.info('Senal %s recibida, terminando', signum)
            terminar['pedido'] = True

        signal.signal(signal.SIGINT, _salir)
        signal.signal(signal.SIGTERM, _salir)

        while not terminar['pedido']:
            self.ejecutar_ciclo()
            # Duerme en tramos cortos para responder rapido a SIGTERM.
            restante = intervalo * 60
            while restante > 0 and not terminar['pedido']:
                paso = min(TRAMO_SLEEP, restante)
                time.sleep(paso)
                restante -= paso

        self.stdout.write('Sincronizacion periodica detenida')

    def ejecutar_ciclo(self):
        try:
            call_command('sincronizar_origenes', verbosity=1)
        except Exception:
            # Un ciclo fallido no debe tumbar el bucle: la proxima vuelta
            # reintenta. El detalle queda en el log.
            logger.exception(
                'La sincronizacion fallo; se reintentara en la proxima vuelta'
            )
