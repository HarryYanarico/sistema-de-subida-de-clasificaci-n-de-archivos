from django.core.management.base import BaseCommand
from apps.personas.models import Persona


PERSONAS = [
    {
        'codigo': '2260041',
        'nombres': 'BENANCIO',
        'apellidos': 'ARAMAYO CANO',
    },
    {
        'codigo': '200734237',
        'nombres': 'ROCIO',
        'apellidos': 'RIOS JIMENEZ',
    },
    {
        'codigo': '216013731',
        'nombres': 'RAQUEL',
        'apellidos': 'SUAREZ CRUZ',
    },
    {
        'codigo': '220053200',
        'nombres': 'SHARON KARINA',
        'apellidos': 'VEIZAGA NAZARO',
    },
]


class Command(BaseCommand):
    help = 'Seed para crear personas iniciales'

    def handle(self, *args, **options):
        created = 0
        skipped = 0

        for data in PERSONAS:
            persona, was_created = Persona.objects.get_or_create(
                codigo=data['codigo'],
                defaults={
                    'nombres': data['nombres'],
                    'apellidos': data['apellidos'],
                },
            )
            if was_created:
                self.stdout.write(self.style.SUCCESS(f'  Creada: {persona}'))
                created += 1
            else:
                self.stdout.write(self.style.WARNING(f'  Ya existia: {persona}'))
                skipped += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Resultado: {created} creadas, {skipped} ya existentes'))
