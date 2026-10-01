from django.core.management.base import BaseCommand, CommandError

from apps.documentos.models import OrigenArchivos
from apps.storage.sincronizacion import resultado_dict, sincronizar_origen


class Command(BaseCommand):
    help = (
        'Sincroniza los archivos de los or\u00edgenes remotos configurados hacia MinIO. '
        'Sin --unidad procesa todos los or\u00edgenes activos.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--unidad', type=int, default=None,
            help='ID de la unidad. Si se omite, sincroniza todos los or\u00edgenes activos.',
        )
        parser.add_argument(
            '--origen', type=int, default=None,
            help='ID de un origen concreto. Requiere --unidad.',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='No escribe nada: no crea Sincronizacion ni Documento, no avanza marca_tiempo.',
        )
        parser.add_argument(
            '--limit', type=int, default=None,
            help='M\u00e1ximo de archivos remotos a leer por origen.',
        )
        parser.add_argument(
            '--inactivo', action='store_true',
            help='Incluir or\u00edgenes marcados como inactivos.',
        )

    def handle(self, *args, **opciones):
        unidad_id = opciones['unidad']
        origen_id = opciones['origen']
        dry_run = opciones['dry_run']
        limite = opciones['limit']

        if origen_id and not unidad_id:
            raise CommandError('--origen requiere --unidad')

        queryset = OrigenArchivos.objects.select_related('unidad')
        if opciones['inactivo']:
            queryset = queryset.all()
        else:
            queryset = queryset.filter(activo=True)

        if origen_id:
            origen = queryset.filter(id=origen_id, unidad_id=unidad_id).first()
            if not origen:
                pista = ' Si est\u00e1 inactivo, agrega --inactivo.' if not opciones['inactivo'] else ''
                raise CommandError(
                    f'No existe el origen {origen_id} en la unidad {unidad_id}.{pista}'
                )
            selected = [origen]
        elif unidad_id:
            selected = list(queryset.filter(unidad_id=unidad_id))
            if not selected:
                self.stdout.write(self.style.WARNING(
                    f'La unidad {unidad_id} no tiene or\u00edgenes configurados.'
                ))
        else:
            selected = list(queryset)

        if not selected:
            self.stdout.write(self.style.WARNING(
                'No hay or\u00edgenes activos para sincronizar. '
                'Crea uno desde el admin de Django.'
            ))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('Modo simulaci\u00f3n: no se escribe nada.'))

        texto_limite = f'{limite}' if limite else 'sin l\u00edmite'
        self.stdout.write(
            f'Sincronizando {len(selected)} origen(es) con l\u00edmite={texto_limite}'
        )

        resultados = []
        for origen in selected:
            try:
                resultado = sincronizar_origen(origen, limite=limite, dry_run=dry_run)
            except Exception as e:
                resultado = {
                    'estado': 'fallida', 'mensaje': str(e),
                    'errores': 0, 'detalle': [],
                }
            resultados.append((origen, resultado))

        fallos = 0
        for origen, resultado in resultados:
            resultado = resultado_dict(resultado)
            etiqueta = f'origen {origen.id} (unidad {origen.unidad_id}, {origen.tipo})'
            if dry_run:
                etiqueta += f' marca propuesta={resultado.get("marca_tiempo_propuesta")}'
            estado = resultado.get('estado', '?')
            mensaje = resultado.get('mensaje', '')
            estilo = {
                'exitosa': self.style.SUCCESS,
                'con_errores': self.style.WARNING,
                'fallida': self.style.ERROR,
            }.get(estado, self.style.WARNING)
            if estado == 'fallida':
                fallos += 1
            self.stdout.write(f'  {estilo(estado)} {etiqueta}: {mensaje}')

            detalles = resultado.get('detalle') or []
            for detalle in detalles:
                etiqueta_det = detalle.get('persona_codigo') or detalle.get('error', '?')
                self.stdout.write(
                    f"      - {detalle.get('archivo', '?')}: {etiqueta_det}"
                )
            if resultado.get('errores'):
                self.stdout.write(
                    f"      {resultado['errores']} error(es) de procesamiento"
                )

        self.stdout.write('')
        if fallos:
            raise CommandError(f'{fallos} origen(es) fallaron.')
