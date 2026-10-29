from __future__ import annotations
from typing import Optional, List
from datetime import datetime

import strawberry
import strawberry_django

from apps.personas.schema import PersonaType
from apps.users.schema import UnidadType

from .models import TipoDocumento, Documento, SugerenciaKeyword, Lote, Grupo, Pagina


@strawberry_django.type(
    TipoDocumento,
    fields=[
        'id', 'nombre', 'slug', 'palabras_clave',
        'color', 'activo', 'created_at',
    ],
)
class TipoDocumentoType:
    unidad: Optional[UnidadType]

    @strawberry_django.field
    def keywords_obligatorias(self) -> list[str]:
        return list(self.keywords_obligatorias or [])

    @strawberry_django.field
    def firma_consolidada(self) -> strawberry.scalars.JSON:
        return self.firma_consolidada or {}

    @strawberry_django.field
    def ejemplos_paginas(self) -> list[PaginaType]:
        return list(self.ejemplos_paginas.all()[:20])


@strawberry_django.type(
    SugerenciaKeyword,
    fields=['id', 'palabra', 'ratio', 'frecuencia', 'aceptada', 'created_at'],
)
class SugerenciaKeywordType:
    tipo_documento: TipoDocumentoType


@strawberry_django.type(
    Pagina,
    fields=[
        'id', 'pdf_origen', 'nro_pagina_en_pdf', 'texto_ocr',
        'phash', 'descartable', 'estado', 'created_at',
    ],
)
class PaginaType:
    unidad: Optional[UnidadType]

    @strawberry_django.field
    def lote_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.lote_id))

    @strawberry_django.field
    def grupo(self) -> Optional[GrupoType]:
        return self.grupo

    @strawberry_django.field
    def firma_palabras(self) -> strawberry.scalars.JSON:
        return self.firma_palabras or []

    @strawberry_django.field
    def firma_estructura(self) -> strawberry.scalars.JSON:
        return self.firma_estructura or {}

    @strawberry_django.field
    def lote_nombre(self) -> Optional[str]:
        return self.lote.nombre_archivo_original if self.lote else None


@strawberry.type
class ParejaSugeridaType:
    pagina_anverso_id: strawberry.ID
    pagina_reverso_id: strawberry.ID


@strawberry.type
class PalabraSugeridaType:
    palabra: str
    es_obligatoria: bool
    seleccionada: bool


@strawberry.type
class SugerenciasAdminType:
    suficientes_ejemplos: bool
    total_ejemplos: int
    mensaje: Optional[str]
    siempre: list[PalabraSugeridaType]
    suelen: list[PalabraSugeridaType]
    ya_no_aparecen: list[PalabraSugeridaType]


@strawberry_django.type(
    Grupo,
    fields=[
        'id', 'total_paginas', 'estado', 'created_at',
    ],
)
class GrupoType:
    unidad: Optional[UnidadType]
    tipo_documento_sugerido: Optional[TipoDocumentoType]

    @strawberry_django.field
    def lote_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.lote_id))

    @strawberry_django.field
    def firma_consolidada(self) -> strawberry.scalars.JSON:
        return self.firma_consolidada or {}

    @strawberry_django.field
    def paginas(self) -> list[PaginaType]:
        docs = list(self.documentos.all().order_by('id'))
        if docs:
            ordenadas = []
            vistas = set()
            for d in docs:
                for p in d.get_paginas_ordenadas():
                    if p.id not in vistas and p.grupo_id == self.id:
                        ordenadas.append(p)
                        vistas.add(p.id)
            for p in self.paginas.all().order_by('nro_pagina_en_pdf', 'id'):
                if p.id not in vistas:
                    ordenadas.append(p)
            return ordenadas
        return list(self.paginas.all().order_by('nro_pagina_en_pdf', 'id'))

    @strawberry_django.field
    def documentos(self) -> list[DocumentoType]:
        return list(self.documentos.all().order_by('id'))

    @strawberry_django.field
    def parejas_sugeridas(self) -> list[ParejaSugeridaType]:
        from .agrupador import detectar_parejas_consecutivas
        pags = list(self.paginas.all().order_by('nro_pagina_en_pdf'))
        parejas = detectar_parejas_consecutivas(pags)
        return [
            ParejaSugeridaType(
                pagina_anverso_id=strawberry.ID(str(p1.id)),
                pagina_reverso_id=strawberry.ID(str(p2.id)),
            )
            for p1, p2 in parejas
        ]


@strawberry_django.type(
    Lote,
    fields=[
        'id', 'estado', 'nombre_archivo_original',
        'total_paginas', 'total_grupos', 'created_at',
    ],
)
class LoteType:
    unidad: Optional[UnidadType]
    persona: Optional[PersonaType]

    @strawberry_django.field
    def borrador_agrupamiento(self) -> strawberry.scalars.JSON:
        return self.borrador_agrupamiento or {}

    @strawberry_django.field
    def grupos(self) -> list[GrupoType]:
        qs = list(self.grupos.exclude(estado='fusionado').order_by('id'))
        normales = [g for g in qs if g.estado != 'descartadas']
        descartadas = [g for g in qs if g.estado == 'descartadas']
        return normales + descartadas

    @strawberry_django.field
    def paginas(self) -> list[PaginaType]:
        return list(self.paginas.all().order_by('nro_pagina_en_pdf'))

    @strawberry_django.field
    def documentos(self) -> list[DocumentoType]:
        return list(self.documentos.all().order_by('id'))

    @strawberry_django.field
    def parejas_sugeridas(self) -> list[ParejaSugeridaType]:
        from .agrupador import detectar_parejas_consecutivas
        pags = list(self.paginas.all().order_by('nro_pagina_en_pdf'))
        parejas = detectar_parejas_consecutivas(pags)
        return [
            ParejaSugeridaType(
                pagina_anverso_id=strawberry.ID(str(p1.id)),
                pagina_reverso_id=strawberry.ID(str(p2.id)),
            )
            for p1, p2 in parejas
        ]


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
    persona: Optional[PersonaType]
    tipo_documento: Optional[TipoDocumentoType]
    unidad: Optional[UnidadType]

    @strawberry_django.field
    def lote(self) -> Optional[LoteType]:
        return self.lote

    @strawberry_django.field
    def grupo_id(self) -> Optional[strawberry.ID]:
        return strawberry.ID(str(self.grupo_id)) if self.grupo_id else None

    @strawberry_django.field
    def paginas(self) -> list[PaginaType]:
        return self.get_paginas_ordenadas()

    @strawberry_django.field
    def es_doble_cara(self) -> bool:
        return bool(self.es_doble_cara)

    @strawberry_django.field
    def nombre_final(self) -> str:
        return self.nombre_final or ''

    @strawberry_django.field
    def total_paginas(self) -> int:
        return self.total_paginas

    @strawberry_django.field
    def duplicado_de(self) -> Optional[strawberry.ID]:
        return strawberry.ID(str(self.duplicado_de_id)) if self.duplicado_de_id else None



@strawberry.type
class DocumentoByPersona:
    persona_id: int
    documentos: list[DocumentoType]
    total_paginas: int
    clasificados: int
    pendientes: int


@strawberry.type
class EstadisticasDigitalizacionType:
    total_documentos: int
    total_clasificados: int
    total_verificados: int
    total_dudosos: int
    total_sin_clasificar: int
    total_duplicados: int
    total_pendientes: int
    tasa_efectividad: float
    sugerencias_pendientes: int


@strawberry.type
class LoteRevisionType:
    lote: LoteType
    documentos_incompletos: list[DocumentoType]
    paginas_huerfanas: list[PaginaType]


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
    def tipos_documento(self, info: strawberry.types.Info, activo: Optional[bool] = None) -> list[TipoDocumentoType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = TipoDocumento.objects.filter(unidad=unidad)
        except Exception:
            qs = TipoDocumento.objects.none()
        if activo is not None:
            qs = qs.filter(activo=activo)
        return qs

    @strawberry.field
    def tipo_documento(self, info: strawberry.types.Info, id: int) -> Optional[TipoDocumentoType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            return TipoDocumento.objects.filter(id=id, unidad=unidad).first()
        except Exception:
            return None

    @strawberry.field
    def documentos_persona(self, info: strawberry.types.Info, persona_id: int) -> DocumentoByPersona:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            documentos = Documento.objects.filter(persona_id=persona_id, unidad=unidad)
        except Exception:
            documentos = Documento.objects.none()
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
    def documentos_pendientes(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Documento.objects.filter(
                unidad=unidad,
                estado__in=['pendiente', 'sin_clasificar'],
                tipo_documento__isnull=True,
            ).order_by('id')
        except Exception:
            qs = Documento.objects.none()
        return _paginar(qs, limit, offset)

    @strawberry.field
    def estadisticas_digitalizacion(self, info: strawberry.types.Info) -> EstadisticasDigitalizacionType:
        """Métricas globales para el Dashboard de digitalización filtradas por unidad."""
        from apps.core.tenancy import get_unidad_from_info
        from django.db.models import Count, Q

        try:
            unidad = get_unidad_from_info(info)
            doc_qs = Documento.objects.filter(unidad=unidad)
            sug_qs = SugerenciaKeyword.objects.filter(tipo_documento__unidad=unidad, aceptada__isnull=True)
        except Exception:
            doc_qs = Documento.objects.none()
            sug_qs = SugerenciaKeyword.objects.none()

        agregados = doc_qs.aggregate(
            total=Count('id'),
            clasificados=Count('id', filter=Q(estado='clasificado')),
            verificados=Count('id', filter=Q(estado='verificado')),
            dudosos=Count('id', filter=Q(estado='dudosa')),
            sin_clasificar=Count('id', filter=Q(estado='sin_clasificar')),
            duplicados=Count('id', filter=Q(estado='duplicado')),
            pendientes=Count('id', filter=Q(estado='pendiente')),
        )
        total = agregados['total'] or 0
        clasificados = agregados['clasificados'] or 0
        verificados = agregados['verificados'] or 0
        dudosos = agregados['dudosos'] or 0
        sin_clasificar = agregados['sin_clasificar'] or 0
        duplicados = agregados['duplicados'] or 0
        pendientes = agregados['pendientes'] or 0

        efectivos = clasificados + verificados
        tasa = round((efectivos / total) * 100.0, 1) if total > 0 else 0.0
        sug_pendientes = sug_qs.count()

        return EstadisticasDigitalizacionType(
            total_documentos=total,
            total_clasificados=clasificados,
            total_verificados=verificados,
            total_dudosos=dudosos,
            total_sin_clasificar=sin_clasificar,
            total_duplicados=duplicados,
            total_pendientes=pendientes,
            tasa_efectividad=tasa,
            sugerencias_pendientes=sug_pendientes,
        )

    @strawberry.field
    def documentos_recientes(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = 5,
    ) -> list[DocumentoType]:
        """Últimos folios procesados en la unidad del usuario."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Documento.objects.filter(unidad=unidad).select_related('persona', 'tipo_documento').order_by('-created_at', '-id')
        except Exception:
            qs = Documento.objects.none()
        if limit is not None:
            qs = qs[:limit]
        return list(qs)

    # ------------------------------------------------------------------
    # Colas de revision filtradas por unidad
    # ------------------------------------------------------------------

    @strawberry.field
    def documentos_dudosos(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        """Paginas con tipo asignado pero eleccion no defendible."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Documento.objects.filter(
                unidad=unidad,
                estado='dudosa',
            ).order_by('score', 'id')
        except Exception:
            qs = Documento.objects.none()
        return _paginar(qs, limit, offset)

    @strawberry.field
    def documentos_sin_clasificar(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        """Paginas donde el clasificador no encontro ningun tipo."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Documento.objects.filter(
                unidad=unidad,
                estado__in=['pendiente', 'sin_clasificar'],
                tipo_documento__isnull=True,
            ).order_by('id')
        except Exception:
            qs = Documento.objects.none()
        return _paginar(qs, limit, offset)

    @strawberry.field
    def documentos_duplicados(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[DocumentoType]:
        """Paginas marcadas como copia perceptual de otra ya presente."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Documento.objects.filter(
                unidad=unidad,
                estado='duplicado',
            ).order_by('id')
        except Exception:
            qs = Documento.objects.none()
        return _paginar(qs, limit, offset)

    @strawberry.field
    def sugerencias_keyword(
        self,
        info: strawberry.types.Info,
        tipo_documento_id: int,
    ) -> list[SugerenciaKeywordType]:
        """Sugerencias estadísticas de palabras clave para un tipo de documento."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            return SugerenciaKeyword.objects.filter(
                tipo_documento_id=tipo_documento_id,
                tipo_documento__unidad=unidad,
                aceptada__isnull=True,
            ).order_by('-ratio', '-frecuencia')
        except Exception:
            return []

    @strawberry.field
    def lotes(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
        estado: Optional[str] = None,
    ) -> list[LoteType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Lote.objects.filter(unidad=unidad)
        except Exception:
            return []
        if estado:
            qs = qs.filter(estado=estado)
        return list(_paginar(qs.order_by('-created_at'), limit, offset))

    @strawberry.field
    def lote(self, info: strawberry.types.Info, id: strawberry.ID) -> Optional[LoteType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            return Lote.objects.filter(id=int(id), unidad=unidad).first()
        except Exception:
            return None

    @strawberry.field
    def lote_revision(
        self,
        info: strawberry.types.Info,
        lote_id: strawberry.ID,
    ) -> Optional[LoteRevisionType]:
        """Devuelve los documentos incompletos y las páginas huérfanas de un lote para la pantalla de revisión."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            lote = Lote.objects.filter(id=int(str(lote_id)), unidad=unidad).first()
            if not lote:
                return None

            incompletos = list(Documento.objects.filter(lote=lote, unidad=unidad, estado='incompleto').order_by('id'))

            # Páginas del lote que no están en documentos activos (o están en estado sin_agrupar)
            paginas_en_docs = Documento.objects.filter(
                lote=lote, unidad=unidad
            ).exclude(estado='descartado').values_list('paginas__id', flat=True)

            huerfanas = list(
                Pagina.objects.filter(lote=lote, unidad=unidad)
                .exclude(id__in=paginas_en_docs)
                .exclude(descartable=True)
                .order_by('nro_pagina_en_pdf')
            )

            return LoteRevisionType(
                lote=lote,
                documentos_incompletos=incompletos,
                paginas_huerfanas=huerfanas,
            )
        except Exception:
            return None

    @strawberry.field
    def grupos(self, info: strawberry.types.Info, lote_id: strawberry.ID) -> list[GrupoType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = list(Grupo.objects.filter(lote_id=int(lote_id), unidad=unidad).exclude(estado='fusionado').order_by('id'))
            normales = [g for g in qs if g.estado != 'descartadas']
            descartadas = [g for g in qs if g.estado == 'descartadas']
            return normales + descartadas
        except Exception:
            return []

    @strawberry.field
    def paginas(
        self,
        info: strawberry.types.Info,
        lote_id: Optional[strawberry.ID] = None,
        grupo_id: Optional[strawberry.ID] = None,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
    ) -> list[PaginaType]:
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Pagina.objects.filter(unidad=unidad)
        except Exception:
            return []
        if lote_id:
            qs = qs.filter(lote_id=int(lote_id))
        if grupo_id:
            qs = qs.filter(grupo_id=int(grupo_id))
        return list(_paginar(qs.order_by('nro_pagina_en_pdf'), limit, offset))

    @strawberry.field
    def paginas_duplicadas(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
    ) -> list[PaginaType]:
        """Devuelve las páginas marcadas como duplicadas dentro de la unidad del request."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Pagina.objects.filter(unidad=unidad, estado='duplicada')
        except Exception:
            return []
        return list(_paginar(qs.order_by('-created_at', 'id'), limit, offset))

    @strawberry.field
    def paginas_sin_agrupar(
        self,
        info: strawberry.types.Info,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
    ) -> list[PaginaType]:
        """Devuelve las páginas con estado 'sin_agrupar' y no descartables de la unidad del request."""
        from apps.core.tenancy import get_unidad_from_info
        try:
            unidad = get_unidad_from_info(info)
            qs = Pagina.objects.filter(unidad=unidad, estado='sin_agrupar', descartable=False)
        except Exception:
            return []
        return list(_paginar(qs.order_by('-created_at', 'id'), limit, offset))

    @strawberry.field
    def sugerencias_admin(
        self,
        info: strawberry.types.Info,
        tipo_id: strawberry.ID,
    ) -> SugerenciasAdminType:
        """Devuelve sugerencias estadísticas en lenguaje natural para un tipo de documento de la unidad (Fase 10)."""
        from apps.core.tenancy import get_unidad_from_info
        from .agrupador import calcular_sugerencias_admin

        unidad = get_unidad_from_info(info)
        tipo = TipoDocumento.objects.filter(id=int(str(tipo_id)), unidad=unidad).first()
        if not tipo:
            raise ValueError(f"Tipo de documento {tipo_id} no encontrado en la unidad actual")

        resultado = calcular_sugerencias_admin(tipo)
        return SugerenciasAdminType(
            suficientes_ejemplos=resultado['suficientes_ejemplos'],
            total_ejemplos=resultado['total_ejemplos'],
            mensaje=resultado['mensaje'],
            siempre=[PalabraSugeridaType(**item) for item in resultado['siempre']],
            suelen=[PalabraSugeridaType(**item) for item in resultado['suelen']],
            ya_no_aparecen=[PalabraSugeridaType(**item) for item in resultado['ya_no_aparecen']],
        )