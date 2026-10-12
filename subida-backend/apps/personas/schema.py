from typing import Optional

import strawberry
import strawberry_django
from django.db.models import Q

from .models import Persona


@strawberry_django.type(
    Persona,
    fields=['id', 'codigo', 'nombres', 'apellidos', 'ci', 'email', 'telefono', 'created_at', 'updated_at'],
)
class PersonaType:
    # Campos calculados. Son N queries por persona (ver notas de CONTEXTO.md);
    # se mantienen tal cual para no mezclar la migracion con una optimizacion.
    @strawberry_django.field
    def total_documentos(self) -> int:
        return self.documentos.count()

    @strawberry_django.field
    def documentos_clasificados(self) -> int:
        return self.documentos.exclude(tipo_documento__isnull=True).count()

    @strawberry_django.field
    def porcentaje_completado(self) -> float:
        total = self.documentos.count()
        if total == 0:
            return 0
        clasificados = self.documentos.exclude(tipo_documento__isnull=True).count()
        return round((clasificados / total) * 100, 2)

    @strawberry_django.field
    def tiene_documentos_clasificados(self) -> bool:
        return self.documentos.exclude(tipo_documento__isnull=True).exists()


@strawberry.type
class PersonaConnection:
    items: list[PersonaType]
    total: int
    page: int
    total_pages: int


@strawberry.type
class Query:
    @strawberry.field
    def personas(
        self,
        search: Optional[str] = None,
        page: Optional[int] = 1,
        limit: Optional[int] = 10,
    ) -> PersonaConnection:
        page = page or 1
        limit = limit or 10
        queryset = Persona.objects.all()
        if search:
            queryset = queryset.filter(
                Q(nombres__icontains=search)
                | Q(apellidos__icontains=search)
                | Q(codigo__icontains=search)
                | Q(ci__icontains=search)
            )
        total = queryset.count()
        total_pages = max(1, (total + limit - 1) // limit)
        offset = (page - 1) * limit
        items = queryset[offset:offset + limit]
        return PersonaConnection(
            items=items,
            total=total,
            page=page,
            total_pages=total_pages,
        )

    @strawberry.field
    def persona(self, id: int) -> Optional[PersonaType]:
        return Persona.objects.filter(id=id).first()