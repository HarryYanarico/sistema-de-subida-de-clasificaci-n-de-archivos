from typing import Optional

import strawberry
import strawberry_django

from apps.personas.schema import PersonaType

from .models import TipoDocumento, Documento


@strawberry_django.type(
    TipoDocumento,
    fields=[
        'id', 'nombre', 'slug', 'palabras_clave', 'keywords_obligatorias',
        'activo', 'created_at',
    ],
)
class TipoDocumentoType:
    pass


@strawberry_django.type(
    Documento,
    fields=[
        'id',
        'persona',
        'tipo_documento',
        'archivo_original',
        'archivo_pagina',
        'pagina_numero',
        'texto_extraido',
        'estado',
        'score',
        'keywords_matcheadas',
        'historial_clasificacion',
        'phash',
        'created_at',
    ],
)
class DocumentoType:
    # Sin estas anotaciones, strawberry_django expone las relaciones como el
    # tipo generico `DjangoModelType { pk: ID! }` y se pierde `persona { codigo }`.
    persona: PersonaType
    tipo_documento: Optional[TipoDocumentoType]
    # Auto-FK. strawberry_django entrega la instancia, no el id, asi que el
    # resolver lo aplana a id: el cliente necesita saber *cual* es el original,
    # no recargar el DocumentoType entero.
    @strawberry_django.field
    def duplicado_de(self) -> Optional[strawberry.ID]:
        # strawberry.ID y no int: el `id` de DocumentoType tambien se serializa
        # como ID, y mezclar int con ID en el mismo tipo confunde al cliente.
        return strawberry.ID(str(self.duplicado_de_id)) if self.duplicado_de_id else None


@strawberry.type
class DocumentoByPersona:
    persona_id: int
    documentos: list[DocumentoType]
    total_paginas: int
    clasificados: int
    pendientes: int


def _paginar(qs, limit: Optional[int], offset: Optional[int] = None):
    """Aplica limit/offset de forma opcional.

    `limit=None` devuelve todo: el frontend de revision pide limit=50 para la
    primera tanda, pero el backend no debe imponer un techo invisible.
    """
    if offset:
        qs = qs[offset:]
    if limit is not None:
        qs = qs[:limit]
    return qs


@strawberry.type
class Query:
    @strawberry.field
    def tipos_documento(self, activo: Optional[bool] = None) -> list[TipoDocumentoType]:
        qs = TipoDocumento.objects.all()
        if activo is not None:
            qs = qs.filter(activo=activo)
        return qs

    @strawberry.field
    def tipo_documento(self, id: int) -> Optional[TipoDocumentoType]:
        return TipoDocumento.objects.filter(id=id).first()

    @strawberry.field
    def documentos_persona(self, persona_id: int) -> DocumentoByPersona:
        documentos = Documento.objects.filter(persona_id=persona_id)
        total = documentos.count()
        # Un duplicado tiene tipo asignado pero no cuenta como clasificado: es
        # una copia de otra pagina que ya se conto, y sumarlo seria reportar
        # dos veces el mismo documento.
        clasificados = documentos.exclude(tipo_documento__isnull=True).exclude(estado='duplicado').count()
        return DocumentoByPersona(
            persona_id=persona_id,
            documentos=documentos,
            total_paginas=total,
            clasificados=clasificados,
            pendientes=total - clasificados,
        )

    @strawberry.field
    def documentos_pendientes(self) -> list[DocumentoType]:
        # 'sin_clasificar' entra junto a 'pendiente': las paginas que el
        # clasificador no pudo resolver se listan aca, no se esconden. Los
        # 'dudosa' tienen tipo asignado y van aparte (Fase 5).
        return Documento.objects.filter(
            estado__in=['pendiente', 'sin_clasificar'],
            tipo_documento__isnull=True,
        )

    # ------------------------------------------------------------------
    # Colas de revision (Fase 5) — sistema single-tenant, sin filtro por
    # unidad. NOTA DE SEGURIDAD: sigue sin haber sesion real (el login emite
    # `token=f"token-{user.id}"` y ningun resolver recibe el usuario
    # autenticado). Las guardas del frontend son UX, no control de acceso.
    # ------------------------------------------------------------------

    @strawberry.field
    def documentos_dudosos(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        """Paginas con tipo asignado pero eleccion no defendible.

        Van ordenadas por score ascendente: las mas dudosas primero, que son
        las que mas aportan al revisor.
        """
        qs = Documento.objects.filter(
            estado='dudosa',
        ).order_by('score', 'id')
        return _paginar(qs, limit, offset)

    @strawberry.field
    def documentos_sin_clasificar(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        """Paginas donde el clasificador no encontro ningun tipo."""
        qs = Documento.objects.filter(
            estado__in=['pendiente', 'sin_clasificar'],
            tipo_documento__isnull=True,
        ).order_by('id')
        return _paginar(qs, limit, offset)

    @strawberry.field
    def documentos_duplicados(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        """Paginas marcadas como copia perceptual de otra ya presente."""
        qs = Documento.objects.filter(
            estado='duplicado',
        ).order_by('id')
        return _paginar(qs, limit, offset)