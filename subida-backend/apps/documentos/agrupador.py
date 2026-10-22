"""Motor de agrupamiento estadístico y determinista por firmas (sin IA).

Calcula firmas de palabras, estructura y pHash para páginas individuales,
las agrupa mediante agrupamiento aglomerativo jerárquico según umbral de
similitud, y las contrasta contra tipos de documento existentes respetando
la unidad (multi-tenant).

IMPORTANTE: Este módulo no importa modelos de Django directamente a nivel
de módulo para mantener el motor desacoplado, altamente comprobable y libre
de dependencias circulares.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional, Union
import re
import unicodedata
from collections import Counter


STOPWORDS_ES = {
    'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'aquel', 'aquella',
    'aquellas', 'aquellos', 'aqui', 'arriba', 'asi', 'atras', 'aun', 'aunque',
    'bajo', 'bien', 'cabe', 'cada', 'casi', 'cerca', 'cierto', 'como', 'con',
    'conmigo', 'conseguir', 'consigo', 'contigo', 'contra', 'cual', 'cuales',
    'cualquier', 'cualquiera', 'cuan', 'cuando', 'cuanto', 'cuanta', 'cuantos',
    'cuantas', 'de', 'dejar', 'del', 'demas', 'demasiada', 'demasiado', 'dentro',
    'desde', 'donde', 'dos', 'el', 'ella', 'ellas', 'ello', 'ellos', 'emplear',
    'en', 'encima', 'entonces', 'entre', 'era', 'erais', 'eramos', 'eran', 'eras',
    'eres', 'es', 'esa', 'esas', 'ese', 'eso', 'esos', 'esta', 'estaba', 'estado',
    'estais', 'estamos', 'estan', 'estar', 'estas', 'este', 'esto', 'estos',
    'estoy', 'fin', 'fue', 'fueron', 'fui', 'fuimos', 'ha', 'habeis', 'haber',
    'habia', 'habiais', 'habiamos', 'habian', 'habias', 'han', 'has', 'hasta',
    'hay', 'hacer', 'haces', 'hacia', 'hago', 'he', 'hecho', 'hemos', 'hube',
    'hubo', 'igual', 'incluso', 'jamas', 'junto', 'la', 'lado', 'las', 'le',
    'les', 'lo', 'los', 'mas', 'me', 'medio', 'mejor', 'menos', 'mi', 'mia',
    'mias', 'mientras', 'mio', 'mios', 'mis', 'misma', 'mismas', 'mismo', 'mismos',
    'modo', 'mucha', 'muchas', 'muchisimo', 'mucho', 'muchos', 'muy', 'nada',
    'nadie', 'ni', 'ningun', 'ninguna', 'ninguno', 'no', 'nos', 'nosotras',
    'nosotros', 'nuestra', 'nuestras', 'nuestro', 'nuestros', 'nunca', 'o', 'os',
    'otra', 'otras', 'otro', 'otros', 'para', 'parecer', 'pero', 'poca', 'pocas',
    'poco', 'pocos', 'podeis', 'podemos', 'poder', 'podria', 'podriais', 'podriamos',
    'podrian', 'podrias', 'por', 'porque', 'primero', 'puede', 'pueden', 'puedo',
    'pues', 'que', 'quedo', 'querer', 'quien', 'quienes', 'quiza', 'quizas',
    'sabe', 'sabeis', 'sabemos', 'saben', 'saber', 'sabes', 'se', 'segun',
    'ser', 'si', 'siempre', 'siendo', 'sin', 'sino', 'so', 'sobre', 'sois',
    'solamente', 'solo', 'somos', 'son', 'soy', 'sr', 'sra', 'su', 'sus',
    'suya', 'suyas', 'suyo', 'suyos', 'tal', 'tambien', 'tampoco', 'tan',
    'tanto', 'te', 'teneis', 'tenemos', 'tener', 'tengo', 'ti', 'tiempo',
    'tiene', 'tienen', 'toda', 'todas', 'todavia', 'todo', 'todos', 'tras',
    'tu', 'tus', 'tuya', 'tuyas', 'tuyo', 'tuyos', 'un', 'una', 'unas',
    'uno', 'unos', 'usa', 'usais', 'usamos', 'usan', 'usar', 'usas', 'uso',
    'usted', 'ustedes', 'va', 'vais', 'vamos', 'van', 'varias', 'varios',
    'vaya', 'verdad', 'via', 'vosotras', 'vosotros', 'voy', 'vuestra',
    'vuestras', 'vuestro', 'vuestros', 'y', 'ya', 'yo'
}

PATRONES_REGEX = {
    'fecha': re.compile(
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{2,4}\b'
    ),
    'monto_bs': re.compile(
        r'\b(?:bs|bob|bolivianos|bs\.)\s*[:.]?\s*\d+(?:[.,]\d+)?\b'
    ),
    'monto_usd': re.compile(
        r'\b(?:us\$|\$|usd|dolares)\s*[:.]?\s*\d+(?:[.,]\d+)?\b'
    ),
    'nit': re.compile(
        r'\b(?:nit|n\.i\.t\.)\s*[:.]?\s*\d{6,14}\b'
    ),
    'ci': re.compile(
        r'\b(?:c\.?i\.?|cedula|carnet)\s*[:.]?\s*\d{5,10}\b'
    ),
    'numero_doc': re.compile(
        r'\b(?:nro|no|numero|n°|nº)\s*[:.]?\s*\d+\b'
    ),
    'codigo_autorizacion': re.compile(
        r'\b(?:autorizacion|cuf|codigo|control)\s*[:.]?\s*[a-z0-9-]{6,}\b'
    ),
}


@dataclass
class Firma:
    palabras: list[str]
    estructura: dict[str, Any]
    phash: Optional[str] = None
    descartable: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            'palabras': self.palabras,
            'estructura': self.estructura,
            'phash': self.phash,
            'descartable': self.descartable,
        }


@dataclass
class GrupoResultado:
    paginas: list[Any]
    total_paginas: int
    firma_consolidada: dict[str, Any]
    unidad_id: Optional[Any] = None
    tipo_documento_sugerido: Optional[Any] = None
    estado: str = 'nuevo'


def normalizar(texto: str) -> str:
    """Minúsculas, quitar acentos (NFKD), colapsar espacios, eliminar caracteres no alfanuméricos."""
    if not texto:
        return ""
    texto = texto.lower()
    # NFKD descompone acentos: 'á' -> 'a' + '\u0301'
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    # Quitar cualquier carácter no alfanumérico dejando espacios
    texto = re.sub(r'[^a-z0-9\s]', ' ', texto)
    # Colapsar espacios consecutivos
    return re.sub(r'\s+', ' ', texto).strip()


def extraer_firma(pagina: Any) -> Firma:
    """Extrae la firma estadística y estructural de una página dada.

    Si el texto normalizado tiene menos de 10 caracteres, la página se marca
    automáticamente como descartable (hojas en blanco, páginas con OCR nulo).
    """
    if isinstance(pagina, dict):
        texto_raw = pagina.get('texto_ocr') or pagina.get('texto_extraido') or ''
        phash = pagina.get('phash')
    else:
        texto_raw = getattr(pagina, 'texto_ocr', '') or getattr(pagina, 'texto_extraido', '') or ''
        phash = getattr(pagina, 'phash', None)

    texto_norm = normalizar(texto_raw)

    # Páginas con len(texto_normalizado) < 10 se marcan descartable=True
    if len(texto_norm) < 10:
        firma = Firma(
            palabras=[],
            estructura={"largo": "corto", "ratio_numeros": 0.0, "patrones": []},
            phash=phash,
            descartable=True,
        )
        _actualizar_objeto_pagina(pagina, firma)
        return firma

    # 1. firma_palabras: top 20 palabras normalizadas tras quitar stopwords
    tokens = texto_norm.split()
    tokens_filtrados = [
        t for t in tokens if len(t) > 2 and t not in STOPWORDS_ES and not t.isdigit()
    ]
    counter = Counter(tokens_filtrados)
    top_20 = [word for word, _ in counter.most_common(20)]

    # 2. firma_estructura: {largo: "corto|medio|largo", ratio_numeros, patrones}
    total_chars = len(texto_norm)
    if total_chars < 200:
        largo = "corto"
    elif total_chars <= 1000:
        largo = "medio"
    else:
        largo = "largo"

    digits_count = sum(1 for c in texto_raw if c.isdigit())
    alpha_num_count = sum(1 for c in texto_raw if c.isalnum())
    ratio_numeros = round(digits_count / max(1, alpha_num_count), 3)

    # Detectar patrones mediante expresiones regulares
    texto_lower = texto_raw.lower()
    patrones_detectados = []
    for nombre_patron, regex in PATRONES_REGEX.items():
        if regex.search(texto_lower) or regex.search(texto_norm):
            patrones_detectados.append(nombre_patron)

    estructura = {
        "largo": largo,
        "ratio_numeros": ratio_numeros,
        "patrones": patrones_detectados,
    }

    firma = Firma(
        palabras=top_20,
        estructura=estructura,
        phash=phash,
        descartable=False,
    )
    _actualizar_objeto_pagina(pagina, firma)
    return firma


def _actualizar_objeto_pagina(pagina: Any, firma: Firma) -> None:
    """Actualiza los campos de firma en el objeto o diccionario de la página."""
    if isinstance(pagina, dict):
        pagina['firma_palabras'] = firma.palabras
        pagina['firma_estructura'] = firma.estructura
        pagina['descartable'] = firma.descartable
    else:
        if hasattr(pagina, 'firma_palabras'):
            setattr(pagina, 'firma_palabras', firma.palabras)
        if hasattr(pagina, 'firma_estructura'):
            setattr(pagina, 'firma_estructura', firma.estructura)
        if hasattr(pagina, 'descartable'):
            setattr(pagina, 'descartable', firma.descartable)


def _obtener_palabras(f: Any) -> list[str]:
    if isinstance(f, dict):
        return f.get('palabras', f.get('firma_palabras', []))
    if hasattr(f, 'palabras'):
        return getattr(f, 'palabras', [])
    return []


def _obtener_estructura(f: Any) -> dict[str, Any]:
    if isinstance(f, dict):
        return f.get('estructura', f.get('firma_estructura', {}))
    if hasattr(f, 'estructura'):
        return getattr(f, 'estructura', {})
    return {}


def _obtener_phash(f: Any) -> Optional[str]:
    if isinstance(f, dict):
        return f.get('phash')
    return getattr(f, 'phash', None)


def similitud_palabras(f1: Any, f2: Any) -> float:
    """Coeficiente de Jaccard sobre las top-20 palabras."""
    palabras_1 = set(_obtener_palabras(f1))
    palabras_2 = set(_obtener_palabras(f2))
    if not palabras_1 and not palabras_2:
        return 0.0
    union = palabras_1 | palabras_2
    if not union:
        return 0.0
    return len(palabras_1 & palabras_2) / len(union)


def similitud_estructura(f1: Any, f2: Any) -> float:
    """Compara largo categórico, ratio de caracteres numéricos y patrones coincidentes."""
    e1 = _obtener_estructura(f1)
    e2 = _obtener_estructura(f2)

    # 1. Similitud de largo (30% de la estructura)
    l1 = e1.get('largo', 'medio')
    l2 = e2.get('largo', 'medio')
    if l1 == l2:
        sim_largo = 1.0
    elif (l1 == 'medio' and l2 in ('corto', 'largo')) or (l2 == 'medio' and l1 in ('corto', 'largo')):
        sim_largo = 0.5
    else:
        sim_largo = 0.0

    # 2. Similitud de ratio numérico (30% de la estructura)
    r1 = float(e1.get('ratio_numeros', 0.0))
    r2 = float(e2.get('ratio_numeros', 0.0))
    sim_ratio = max(0.0, 1.0 - abs(r1 - r2))

    # 3. Similitud de patrones regex (40% de la estructura)
    pat1 = set(e1.get('patrones', []))
    pat2 = set(e2.get('patrones', []))
    if not pat1 and not pat2:
        sim_patrones = 1.0
    else:
        union_pat = pat1 | pat2
        sim_patrones = len(pat1 & pat2) / len(union_pat) if union_pat else 0.0

    return 0.3 * sim_largo + 0.3 * sim_ratio + 0.4 * sim_patrones


def distancia_hamming(phash_a: Optional[str], phash_b: Optional[str]) -> int:
    """Cantidad de bits distintos entre dos pHashes hexadecimales (64 bits)."""
    if not phash_a or not phash_b:
        return 64
    try:
        a, b = str(phash_a).lower(), str(phash_b).lower()
        largo = min(len(a), len(b))
        if largo == 0:
            return 64
        xor = int(a[:largo], 16) ^ int(b[:largo], 16)
        return bin(xor).count('1')
    except Exception:
        return 64


def similitud_phash(p1: Optional[str], p2: Optional[str]) -> Optional[float]:
    """Similitud perceptual basada en distancia de Hamming invertida (64 bits)."""
    if not p1 or not p2:
        return None
    try:
        dist = distancia_hamming(p1, p2)
        return max(0.0, 1.0 - (dist / 64.0))
    except Exception:
        return None


def similitud_total(f1: Any, f2: Any) -> float:
    """Promedio ponderado: palabras (0.6), estructura (0.3), phash (0.1 si existe)."""
    sim_p = similitud_palabras(f1, f2)
    sim_e = similitud_estructura(f1, f2)
    phash1 = _obtener_phash(f1)
    phash2 = _obtener_phash(f2)
    sim_h = similitud_phash(phash1, phash2) if (phash1 and phash2) else None

    if sim_h is not None:
        return round(0.6 * sim_p + 0.3 * sim_e + 0.1 * sim_h, 4)
    else:
        # Ponderación proporcional sin phash
        return round((0.6 * sim_p + 0.3 * sim_e) / 0.9, 4)


def _obtener_unidad_id(obj: Any) -> Any:
    """Extrae el identificador de unidad de un objeto o diccionario."""
    if isinstance(obj, dict):
        return obj.get('unidad_id') or obj.get('unidad')
    u = getattr(obj, 'unidad_id', None)
    if u is not None:
        return u
    u_obj = getattr(obj, 'unidad', None)
    if u_obj is not None:
        return getattr(u_obj, 'id', getattr(u_obj, 'codigo', u_obj))
    return None


def _construir_firma_consolidada(paginas_grupo: list[Any]) -> dict[str, Any]:
    """Consolida las firmas de las páginas que componen un grupo."""
    todas_palabras = []
    largos = []
    ratios = []
    patrones = set()

    for p in paginas_grupo:
        f = getattr(p, '_firma_calculada', None) or extraer_firma(p)
        palabras = _obtener_palabras(f)
        todas_palabras.extend(palabras)
        est = _obtener_estructura(f)
        largos.append(est.get('largo', 'medio'))
        ratios.append(float(est.get('ratio_numeros', 0.0)))
        patrones.update(est.get('patrones', []))

    counter = Counter(todas_palabras)
    top_20 = [word for word, _ in counter.most_common(20)]

    dominant_largo = Counter(largos).most_common(1)[0][0] if largos else 'medio'
    mean_ratio = round(sum(ratios) / max(1, len(ratios)), 3)

    return {
        'palabras': top_20,
        'firma_palabras': top_20,
        'estructura': {
            'largo': dominant_largo,
            'ratio_numeros': mean_ratio,
            'patrones': sorted(list(patrones)),
        },
        'firma_estructura': {
            'largo': dominant_largo,
            'ratio_numeros': mean_ratio,
            'patrones': sorted(list(patrones)),
        },
    }


def agrupar(
    paginas: list[Any],
    umbral: float = 0.6,
    paginas_confirmadas: Optional[list[Any]] = None,
) -> list[GrupoResultado]:
    """Agrupa páginas por similitud estadística usando agrupamiento aglomerativo jerárquico.

    Reglas de negocio:
    - Páginas con len(texto_normalizado) < 10 se marcan descartable=True y no se agrupan.
    - Páginas duplicadas (distancia Hamming pHash <= 5 contra páginas confirmadas de la misma unidad)
      se marcan con estado='duplicada' y no se agrupan.
    - Si el lote tiene < 2 páginas válidas, devuelve un solo grupo (o vacío si no hay válidas).
    - Páginas de dos unidades distintas nunca se agrupan juntas (aislamiento multi-tenant).
    """
    if not paginas:
        return []

    # 1. Extraer firmas, separar descartables y detectar duplicadas
    paginas_por_unidad: dict[Any, list[tuple[Any, Firma]]] = {}

    for p in paginas:
        f = getattr(p, '_firma_calculada', None) or extraer_firma(p)
        setattr(p, '_firma_calculada', f)
        if f.descartable:
            continue

        u_id = _obtener_unidad_id(p)
        phash_p = f.phash or _obtener_phash(p)

        # Fase 6: Deduplicación por pHash contra páginas confirmadas de la misma unidad
        es_dup = False
        if phash_p:
            if paginas_confirmadas is not None:
                for pc in paginas_confirmadas:
                    pc_uid = _obtener_unidad_id(pc)
                    # Aislamiento multi-tenant: solo comparar páginas de la misma unidad
                    if u_id is not None and pc_uid is not None and str(u_id) != str(pc_uid):
                        continue
                    pc_phash = _obtener_phash(pc)
                    if pc_phash and distancia_hamming(phash_p, pc_phash) <= 5:
                        es_dup = True
                        break
            else:
                try:
                    from .deduplicacion import buscar_pagina_duplicada
                    excluir_id = getattr(p, 'id', None) if not isinstance(p, dict) else p.get('id')
                    dup_id = buscar_pagina_duplicada(phash_p, excluir_id=excluir_id, unidad=u_id)
                    if dup_id is not None:
                        es_dup = True
                except Exception:
                    pass

        if es_dup:
            if isinstance(p, dict):
                p['estado'] = 'duplicada'
            else:
                setattr(p, 'estado', 'duplicada')
                if hasattr(p, 'save') and getattr(p, 'id', None):
                    try:
                        p.save(update_fields=['estado'])
                    except Exception:
                        pass
            continue

        if u_id not in paginas_por_unidad:
            paginas_por_unidad[u_id] = []
        paginas_por_unidad[u_id].append((p, f))

    resultados_totales: list[GrupoResultado] = []

    # 2. Agrupar por cada unidad de forma estrictamente aislada
    for u_id, items in paginas_por_unidad.items():
        if not items:
            continue

        # Regla: Si el lote tiene < 2 páginas, devolver un solo grupo
        if len(items) == 1:
            p_unica, f_unica = items[0]
            fc = _construir_firma_consolidada([p_unica])
            resultados_totales.append(
                GrupoResultado(
                    paginas=[p_unica],
                    total_paginas=1,
                    firma_consolidada=fc,
                    unidad_id=u_id,
                )
            )
            continue

        # Clustering aglomerativo jerárquico con promedio entre grupos (average linkage)
        # Inicializar: cada página es su propio cluster
        clusters: list[list[int]] = [[i] for i in range(len(items))]

        # Precalcular matriz de similitudes
        n = len(items)
        sim_matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            sim_matrix[i][i] = 1.0
            for j in range(i + 1, n):
                sim = similitud_total(items[i][1], items[j][1])
                sim_matrix[i][j] = sim
                sim_matrix[j][i] = sim

        while len(clusters) > 1:
            mejor_sim = -1.0
            mejor_par = None

            for ci in range(len(clusters)):
                for cj in range(ci + 1, len(clusters)):
                    c1 = clusters[ci]
                    c2 = clusters[cj]
                    # Promedio de similitud entre todos los pares de páginas
                    sim_promedio = sum(sim_matrix[x][y] for x in c1 for y in c2) / (len(c1) * len(c2))
                    if sim_promedio > mejor_sim:
                        mejor_sim = sim_promedio
                        mejor_par = (ci, cj)

            if mejor_par is not None and mejor_sim >= umbral:
                ci, cj = mejor_par
                nuevo_cluster = clusters[ci] + clusters[cj]
                # Quitar en orden inverso para preservar índices
                clusters.pop(cj)
                clusters.pop(ci)
                clusters.append(nuevo_cluster)
            else:
                break

        # Construir objetos GrupoResultado
        for cl in clusters:
            pags_cl = [items[idx][0] for idx in cl]
            fc = _construir_firma_consolidada(pags_cl)
            resultados_totales.append(
                GrupoResultado(
                    paginas=pags_cl,
                    total_paginas=len(pags_cl),
                    firma_consolidada=fc,
                    unidad_id=u_id,
                )
            )

    return resultados_totales


def comparar_con_tipos(
    grupo: Any, tipos: list[Any], umbral: float = 0.7
) -> Optional[Any]:
    """Compara la firma consolidada del grupo contra la firma consolidada de cada tipo.

    - Filtra estrictamente por la unidad del grupo.
    - Si el mejor match supera el umbral (default 0.7), devuelve ese tipo.
    - Si no supera el umbral o no pertenece a la misma unidad, devuelve None.
    """
    g_unidad = _obtener_unidad_id(grupo)
    if isinstance(grupo, dict):
        firma_g = grupo.get('firma_consolidada', {})
    else:
        firma_g = getattr(grupo, 'firma_consolidada', {}) or {}

    mejor_tipo = None
    mejor_score = -1.0

    for tipo in tipos:
        # Aislamiento multi-tenant por unidad
        t_unidad = _obtener_unidad_id(tipo)
        if g_unidad is not None and t_unidad is not None and g_unidad != t_unidad:
            continue

        # Extraer firma consolidada del tipo
        if isinstance(tipo, dict):
            firma_t = tipo.get('firma_consolidada', {})
            palabras_clave_raw = tipo.get('palabras_clave', '')
        else:
            firma_t = getattr(tipo, 'firma_consolidada', {}) or {}
            palabras_clave_raw = getattr(tipo, 'palabras_clave', '')

        # Si el tipo aún no tiene firma_consolidada pero tiene palabras_clave,
        # construir una firma sintética a partir de las keywords para retrocompatibilidad
        palabras_t = _obtener_palabras(firma_t)
        if not palabras_t and palabras_clave_raw:
            palabras_t = [
                p.split(':')[0].strip().lower()
                for p in palabras_clave_raw.split(',')
                if p.strip()
            ]
            firma_t = {
                'palabras': palabras_t,
                'estructura': firma_t.get('estructura', {'largo': 'medio', 'ratio_numeros': 0.1, 'patrones': []}),
            }

        sim = similitud_total(firma_g, firma_t)
        if sim > mejor_score:
            mejor_score = sim
            mejor_tipo = tipo

    if mejor_score >= umbral:
        return mejor_tipo

    return None


def detectar_parejas_consecutivas(
    paginas: list[Any],
    umbral_similitud: float = 0.5,
    max_chars_reverso: int = 200,
) -> list[tuple[Any, Any]]:
    """Detecta parejas de páginas consecutivas candidatas a anverso/reverso.

    Reglas:
    - Mismo `pdf_origen` y misma `unidad`.
    - Consecutivas en numeración física (`nro_pagina_en_pdf` N y N+1).
    - `similitud_total(firma_N, firma_N+1) > umbral_similitud` (default 0.5)
      Y al menos una de las dos páginas tiene menos de `max_chars_reverso` (default 200) caracteres.
    - Ambas páginas deben ser no descartables.
    - Páginas de distintas unidades NUNCA se emparejan.
    - Devuelve pares disjuntos `[(p1, p2), ...]`.
    """
    if not paginas or len(paginas) < 2:
        return []

    # 1. Agrupar por (unidad_id, pdf_origen)
    grupos_archivo: dict[tuple[Any, str], list[Any]] = {}

    for p in paginas:
        u_id = _obtener_unidad_id(p)
        if isinstance(p, dict):
            pdf = p.get('pdf_origen') or p.get('archivo_original') or ''
        else:
            pdf = getattr(p, 'pdf_origen', '') or getattr(p, 'archivo_original', '') or ''

        clave = (u_id, pdf)
        if clave not in grupos_archivo:
            grupos_archivo[clave] = []
        grupos_archivo[clave].append(p)

    def _obtener_nro(p: Any) -> int:
        if isinstance(p, dict):
            return int(p.get('nro_pagina_en_pdf') or p.get('pagina_numero') or 1)
        return int(getattr(p, 'nro_pagina_en_pdf', None) or getattr(p, 'pagina_numero', 1) or 1)

    def _obtener_len_texto(p: Any) -> int:
        if isinstance(p, dict):
            t = p.get('texto_ocr') or p.get('texto_extraido') or ''
        else:
            t = getattr(p, 'texto_ocr', '') or getattr(p, 'texto_extraido', '') or ''
        return len(t.strip())

    parejas_detectadas: list[tuple[Any, Any]] = []

    # 2. Evaluar consecutividad dentro de cada archivo y unidad
    for (u_id, pdf), pags in grupos_archivo.items():
        if len(pags) < 2:
            continue

        pags_ordenadas = sorted(pags, key=_obtener_nro)
        i = 0
        while i < len(pags_ordenadas) - 1:
            p_actual = pags_ordenadas[i]
            p_siguiente = pags_ordenadas[i + 1]

            nro1 = _obtener_nro(p_actual)
            nro2 = _obtener_nro(p_siguiente)

            # Deben ser páginas consecutivas en el mismo PDF (N y N+1)
            if nro2 == nro1 + 1:
                f1 = getattr(p_actual, '_firma_calculada', None) or extraer_firma(p_actual)
                f2 = getattr(p_siguiente, '_firma_calculada', None) or extraer_firma(p_siguiente)

                sim = similitud_total(f1, f2)
                len1 = _obtener_len_texto(p_actual)
                len2 = _obtener_len_texto(p_siguiente)

                # Condición: similitud_total > 0.5 Y al menos una tiene < 200 caracteres de texto
                if sim > umbral_similitud and (len1 < max_chars_reverso or len2 < max_chars_reverso):
                    parejas_detectadas.append((p_actual, p_siguiente))
                    i += 2  # Consumir ambas páginas del par
                    continue

            i += 1

    return parejas_detectadas


def actualizar_firma_tipo_documento(tipo: Any, paginas_nuevas: list[Any]) -> dict[str, Any]:
    """Actualiza la firma consolidada y ejemplos_paginas de un TipoDocumento de forma incremental (FIFO máx 20).

    Cada vez que se confirma un Documento (Fase 5 o Fase 7):
    - Se incorporan las nuevas páginas a `ejemplos_paginas` (hasta un máximo de 20, FIFO).
    - Se recalcula `firma_consolidada` con el promedio de las palabras (top 20 por frecuencia agregada)
      y estructura promedio.
    """
    if not tipo or not paginas_nuevas:
        return {}

    ejemplos_mgr = getattr(tipo, 'ejemplos_paginas', None)
    if ejemplos_mgr is not None and hasattr(ejemplos_mgr, 'add'):
        for p in paginas_nuevas:
            ejemplos_mgr.add(p)

        # FIFO: Mantener como máximo los 20 más recientes por ID descendente
        if hasattr(ejemplos_mgr, 'order_by'):
            ejemplos_qs = ejemplos_mgr.order_by('-id')[:20]
            ejemplos_lista = list(ejemplos_qs)
            ejemplos_mgr.set(ejemplos_lista)
        else:
            ejemplos_lista = list(ejemplos_mgr.all())[-20:]
    else:
        ejemplos_lista = paginas_nuevas

    nueva_firma = _construir_firma_consolidada(ejemplos_lista)

    if hasattr(tipo, 'firma_consolidada'):
        tipo.firma_consolidada = nueva_firma
        if hasattr(tipo, 'save'):
            tipo.save(update_fields=['firma_consolidada'])
    elif isinstance(tipo, dict):
        tipo['firma_consolidada'] = nueva_firma

    return nueva_firma


def calcular_sugerencias_admin(tipo: Any) -> dict[str, Any]:
    """Calcula sugerencias en lenguaje natural para el administrador al editar un TipoDocumento (Fase 10).

    - > 80% de ejemplos_paginas -> 'siempre' ("Siempre aparecen en este tipo").
    - 30% - 80% de ejemplos_paginas -> 'suelen' ("Suelen aparecer").
    - < 30% que estaban configuradas antes -> 'ya_no_aparecen' ("Ya no aparecen. ¿Quitar?").
    Si hay menos de 3 ejemplos_paginas, devuelve suficientes_ejemplos=False.
    """
    ejemplos_mgr = getattr(tipo, 'ejemplos_paginas', None)
    if ejemplos_mgr is not None and hasattr(ejemplos_mgr, 'all'):
        ejemplos = list(ejemplos_mgr.all())
    elif isinstance(tipo, dict):
        ejemplos = tipo.get('ejemplos_paginas', [])
    else:
        ejemplos = []

    total_ejemplos = len(ejemplos)
    if total_ejemplos < 3:
        return {
            'suficientes_ejemplos': False,
            'total_ejemplos': total_ejemplos,
            'mensaje': 'Aún no hay suficientes documentos para sugerir palabras',
            'siempre': [],
            'suelen': [],
            'ya_no_aparecen': [],
        }

    # Palabras configuradas actualmente
    palabras_raw = (
        getattr(tipo, 'palabras_clave', '')
        if not isinstance(tipo, dict)
        else tipo.get('palabras_clave', '')
    )
    palabras_configuradas = set()
    if palabras_raw:
        for item in str(palabras_raw).split(','):
            w = item.split(':')[0].strip().lower()
            if w:
                palabras_configuradas.add(normalizar(w))

    obligatorias_raw = (
        getattr(tipo, 'keywords_obligatorias', [])
        if not isinstance(tipo, dict)
        else tipo.get('keywords_obligatorias', [])
    )
    obligatorias_set = {normalizar(w) for w in (obligatorias_raw or [])}
    palabras_configuradas.update(obligatorias_set)

    # Recolectar palabras por cada documento de ejemplo
    palabras_por_doc: list[set[str]] = []
    for p in ejemplos:
        f = getattr(p, '_firma_calculada', None) or extraer_firma(p)
        palabras_doc = set(_obtener_palabras(f))
        texto = getattr(p, 'texto_ocr', '') if not isinstance(p, dict) else p.get('texto_ocr', '')
        if texto:
            tokens = [
                t
                for t in normalizar(texto).split()
                if len(t) > 2 and t not in STOPWORDS_ES and not t.isdigit()
            ]
            palabras_doc.update(tokens)
        palabras_por_doc.append(palabras_doc)

    # Conteo de frecuencia de documentos
    doc_freq = Counter()
    for doc_set in palabras_por_doc:
        for w in doc_set:
            doc_freq[w] += 1

    siempre = []
    suelen = []

    for w, count in doc_freq.most_common(40):
        ratio = count / total_ejemplos
        item = {
            'palabra': w,
            'es_obligatoria': w in obligatorias_set,
            'seleccionada': (w in palabras_configuradas) or (ratio >= 0.8),
        }
        if ratio >= 0.8:
            siempre.append(item)
        elif ratio >= 0.3:
            suelen.append(item)

    # Palabras que estaban antes pero ya no aparecen (o aparecen en < 30%)
    ya_no_aparecen = []
    for w in sorted(palabras_configuradas):
        ratio = doc_freq.get(w, 0) / total_ejemplos
        if ratio < 0.3:
            ya_no_aparecen.append({
                'palabra': w,
                'es_obligatoria': w in obligatorias_set,
                'seleccionada': False,  # Sugerir quitar
            })

    return {
        'suficientes_ejemplos': True,
        'total_ejemplos': total_ejemplos,
        'mensaje': None,
        'siempre': siempre,
        'suelen': suelen,
        'ya_no_aparecen': ya_no_aparecen,
    }


