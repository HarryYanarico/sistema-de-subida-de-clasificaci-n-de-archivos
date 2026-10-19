"""Deteccion de paginas duplicadas por perceptual hash.

Un pHash es un hash de 64 bits que representa la estructura visual de una
imagen. Dos escaneos del mismo documento dan hashes casi iguales aunque
cambien el brillo, el angulo o la compresion; por eso se comparan por distancia
Hamming y no por igualdad.

La comparacion es O(n) sobre los documentos. Con el volumen actual
(60 documentos) es irrelevante; si llegara a decenas de miles habria que
indexar por bloques de bits.
"""

# Distancia Hamming maxima para considerar que dos paginas son la misma.
# pHash tolera compresion y reescaneo; 5 de 64 bits es un margen conservador
# para no fusionar documentos distintos, que es el error caro aqui.
UMBRAL_HAMMING = 5


def distancia_hamming(phash_a: str, phash_b: str) -> int:
    """Cantidad de bits distintos entre dos pHashes hexadecimales.

    Un pHash siempre tiene 16 digitos hexadecimales (64 bits). Los que lleguen
    con otra longitud se comparan solo en la parte comun: truncarlos a la
    izquierda daria un resultado sin sentido, y comparar de mas daria falso.
    """
    if not phash_a or not phash_b:
        return 64

    a, b = phash_a.lower(), phash_b.lower()
    largo = min(len(a), len(b))

    if largo == 0:
        return 64

    xor = int(a[:largo], 16) ^ int(b[:largo], 16)
    return bin(xor).count('1')


def son_duplicados(phash_a: str, phash_b: str, umbral: int = UMBRAL_HAMMING) -> bool:
    return distancia_hamming(phash_a, phash_b) <= umbral


def buscar_duplicado(phash, excluir_id=None, unidad=None):
    """Devuelve el documento original que coincide con `phash` dentro de la misma unidad.

    Solo mira documentos con `phash` calculado.
    """
    if not phash:
        return None

    from apps.documentos.models import Documento

    qs = Documento.objects.filter(
        phash__isnull=False,
    ).exclude(phash='')

    if unidad is not None:
        if isinstance(unidad, int) or (isinstance(unidad, str) and str(unidad).isdigit()):
            qs = qs.filter(unidad_id=int(unidad))
        elif hasattr(unidad, 'id'):
            qs = qs.filter(unidad_id=unidad.id)
        else:
            qs = qs.filter(unidad=unidad)

    if excluir_id is not None:
        qs = qs.exclude(id=excluir_id)

    for doc_id, candidato in qs.values_list('id', 'phash'):
        if son_duplicados(phash, candidato):
            return doc_id

    return None


def buscar_pagina_duplicada(phash, excluir_id=None, unidad=None):
    """Devuelve el id de la Pagina confirmada que coincide con `phash` dentro de la misma unidad.

    Solo mira paginas con `phash` calculado y que esten en estado 'confirmada'.
    """
    if not phash:
        return None

    from apps.documentos.models import Pagina

    qs = Pagina.objects.filter(
        phash__isnull=False,
        estado='confirmada',
    ).exclude(phash='')

    if unidad is not None:
        if isinstance(unidad, int) or (isinstance(unidad, str) and str(unidad).isdigit()):
            qs = qs.filter(unidad_id=int(unidad))
        elif hasattr(unidad, 'id'):
            qs = qs.filter(unidad_id=unidad.id)
        else:
            qs = qs.filter(unidad=unidad)

    if excluir_id is not None:
        qs = qs.exclude(id=excluir_id)

    for pag_id, candidato in qs.values_list('id', 'phash'):
        if son_duplicados(phash, candidato):
            return pag_id

    return None

