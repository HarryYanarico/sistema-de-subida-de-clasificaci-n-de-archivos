"""Clasificador local de documentos por palabras clave.

Modulo puro a proposito: no importa modelos de Django ni toca la base. Recibe
los objetos `TipoDocumento` activos y trabaja con duck
typing (`palabras_clave`, `keywords_obligatorias`), asi que se puede probar sin
base de datos y reutilizar desde la ingesta y desde la mutation
`clasificarDocumento`.

Tolera OCR sujo comparando palabra por palabra con `rapidfuzz` en vez de hacer
`substring`: un escaneo real produce `F4ctur4`, `T0tal a p4gar` o falta de
acentos, y la comparacion literal no encuentra nada.
"""

import unicodedata
from dataclasses import dataclass, field

from rapidfuzz import fuzz

# Similitud minima (0-100) para aceptar una palabra del texto como la keyword.
#
# El plan fijaba 85, pero con 85 el caso de OCR que el propio plan menciona
# (`F4ctur4` ~ `factura`) puntua 76.9 y se pierde. Medido sobre una muestra de
# pares con y sin error de OCR, 75 acepta los casos con substituted typos y
# descarta los ruidos largos. El guardia de longitud de abajo es lo que evita que
# al bajar a 75 entre 'estatal' como si fuera 'total'.
UMBRAL_COINCIDENCIA = 75

# El ruido de OCR por sustitucion conserva la longitud de la palabra
# (factura -> f4ctur4, 7 caracteres). Exigir longitudes compatibles descarta de
# entrada los falsos positivos que comparten solo sufijos o prefijos:
# 'estatal'/'total', 'manufactura'/'factura', 'noticia'/'notas'.
TOLERANCIA_LONGITUD = 1

# Separacion minima entre el ganador y el segundo, en proporcion del ganador.
# Por debajo de esto la eleccion es tan cerrada que conviene mandarla a revision
# humana en vez de presentarla como un hecho.
MARGEN_DUDOSO = 0.15

# Peso por defecto cuando `palabras_clave` no trae el formato `palabra:peso`.
PESO_POR_DEFECTO = 1

# Bonus para una coincidencia literal sobre una aproximada. Asi el texto limpio
# siempre gana por encima de una aproximacion con la misma keyword.
BONUS_EXACTA = 1


@dataclass
class ResultadoClasificacion:
    tipo_ganador: object | None = None
    score_ganador: float = 0.0
    score_segundo: float = 0.0
    keywords_matcheadas: list[str] = field(default_factory=list)
    es_dudosa: bool = False

    @property
    def hay_match(self) -> bool:
        return self.tipo_ganador is not None and self.score_ganador > 0


def normalizar(texto: str) -> str:
    """Minúsculas, sin acentos, sin puntuación y con espacios colapsados.

    Conserva los dígitos a propósito: `T0tal` tiene que quedar `t0tal` para que
    el fuzzy lo acerque a `total`, no desaparecer.
    """
    if not texto:
        return ''
    descompuesto = unicodedata.normalize('NFKD', texto)
    sin_acentos = ''.join(c for c in descompuesto if not unicodedata.combining(c))
    return ' '.join(
        ''.join(c if c.isalnum() else ' ' for c in sin_acentos.lower()).split()
    )


def parsear_palabras_clave(palabras_clave: str) -> list[tuple[str, int]]:
    """`"certificado:3, acta de nacimiento"` -> `[('certificado', 3), ...]`.

    El peso se acota a 1-5, igual que en el modelo. Una entrada sin `:` o con
    un peso ilegible vale `PESO_POR_DEFECTO`.
    """
    resultado = []
    for item in (palabras_clave or '').split(','):
        item = item.strip()
        if not item:
            continue
        palabra, _, peso_crudo = item.partition(':')
        palabra = palabra.strip().lower()
        if not palabra:
            continue
        try:
            peso = int(peso_crudo.strip())
        except ValueError:
            peso = PESO_POR_DEFECTO
        resultado.append((palabra, max(1, min(5, peso))))
    return resultado


def coincide(keyword: str, texto_norm: str, umbral: int = UMBRAL_COINCIDENCIA) -> bool:
    """¿La keyword aparece en el texto, de forma exacta o tolerante a OCR?"""
    keyword_norm = normalizar(keyword)
    if not keyword_norm:
        return False
    return (
        _coincide_exacta(keyword_norm, texto_norm)
        or _coincide_aproximada(keyword_norm, texto_norm, umbral)
    )


def _coincide_exacta(keyword_norm: str, texto_norm: str) -> bool:
    """¿La keyword aparece completa, con limites de palabra?

    Se buscan los espacios flanking para que 'total' no matchee dentro de
    'estatal'. Tambien cubre keywords de varias palabras ('acta de
    nacimiento'), que un match por token suelta no puede encontrar.
    """
    return f' {keyword_norm} ' in f' {texto_norm} '


def _coincide_aproximada(keyword_norm: str, texto_norm: str, umbral: int) -> bool:
    """¿Alguna palabra se parece a la keyword dentro del umbral?

    Se compara contra palabras sueltas y no contra el texto entero: con
    `partial_ratio` sobre la pagina completa casi cualquier palabra resulta
    compatible con cualquier otra y el score deja de discriminar. Ademas se
    exige que las longitudes sean compatibles, porque el error de OCR por
    sustitucion no cambia la cantidad de caracteres.
    """
    for palabra in texto_norm.split():
        if abs(len(palabra) - len(keyword_norm)) > TOLERANCIA_LONGITUD:
            continue
        if fuzz.partial_ratio(keyword_norm, palabra) >= umbral:
            return True
    return False


def _puntuar(tipo, texto_norm, umbral_coincidencia):
    """(score, keywords_matcheadas) para un tipo, o `None` si el gate lo descarta.

    El gate de `keywords_obligatorias` se lee con `getattr` porque el campo se
    agrega en la migracion de la fase siguiente y este modulo tiene que seguir
    funcionando con y sin el.
    """
    for obligatoria in getattr(tipo, 'keywords_obligatorias', None) or []:
        if not coincide(obligatoria, texto_norm, umbral_coincidencia):
            return None

    score = 0
    matcheadas = []
    for palabra, peso in parsear_palabras_clave(tipo.palabras_clave):
        keyword_norm = normalizar(palabra)
        if _coincide_exacta(keyword_norm, texto_norm):
            score += peso * (1 + BONUS_EXACTA)
            matcheadas.append(palabra)
        elif _coincide_aproximada(keyword_norm, texto_norm, umbral_coincidencia):
            score += peso
            matcheadas.append(palabra)
    return score, matcheadas


def clasificar(
    texto: str,
    tipos,
    *,
    margen: float = MARGEN_DUDOSO,
    umbral_coincidencia: int = UMBRAL_COINCIDENCIA,
) -> ResultadoClasificacion:
    """El tipo con mayor score, o un resultado vacio si ninguno matchea.

    `tipos` debe venir ya acotado a los tipos activos.
    """
    texto_norm = normalizar(texto)
    if not texto_norm:
        return ResultadoClasificacion()

    ranking = []
    for tipo in tipos:
        puntaje = _puntuar(tipo, texto_norm, umbral_coincidencia)
        if puntaje is None or puntaje[0] <= 0:
            continue
        ranking.append((puntaje[0], tipo, puntaje[1]))

    if not ranking:
        return ResultadoClasificacion()

    # El desempate por nombre mantiene el resultado determinista entre corridas
    # cuando dos tipos empatan en score.
    ranking.sort(key=lambda item: (-item[0], str(item[1].nombre)))
    score_ganador, ganador, matcheadas = ranking[0]
    score_segundo = ranking[1][0] if len(ranking) > 1 else 0.0

    es_dudosa = (score_ganador - score_segundo) < margen * max(score_ganador, 1)
    return ResultadoClasificacion(
        tipo_ganador=ganador,
        score_ganador=float(score_ganador),
        score_segundo=float(score_segundo),
        keywords_matcheadas=matcheadas,
        es_dudosa=es_dudosa,
    )


def estado_desde_resultado(resultado: ResultadoClasificacion, tipo=None) -> str:
    """Traduce el resultado a un valor de `Documento.estado`.

    `sin_clasificar` no es lo mismo que `dudosa`: la primera es "no se encontro
    nada", la segunda es "encontre algo pero no puedo defender la eleccion".
    """
    tipo = tipo if tipo is not None else resultado.tipo_ganador
    if tipo is None:
        return 'sin_clasificar'
    return 'dudosa' if resultado.es_dudosa else 'clasificado'


def estado_desde_pagina(result: dict, es_duplicado: bool = False) -> str:
    """Igual que `estado_desde_resultado`, para el dict que emite `process_pdf`.

    La ingesta consume diccionarios, no el dataclass: separar las dos firmas
    evita tener que reconstruir un ResultadoClasificacion en cada pagina.

    `es_duplicado` pisa el resultado: si la pagina ya existia, hay
    una copia y esta no entra en las colas de revision, aunque el clasificador
    haya encontrado un tipo.
    """
    if es_duplicado:
        return 'duplicado'
    if result.get('tipo_documento') is None:
        return 'sin_clasificar'
    return 'dudosa' if result.get('es_dudosa') else 'clasificado'
