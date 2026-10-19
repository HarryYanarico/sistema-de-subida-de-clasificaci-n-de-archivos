from collections import Counter, defaultdict
from apps.documentos.models import Documento, TipoDocumento, SugerenciaKeyword
from apps.storage.clasificador import normalizar, parsear_palabras_clave

STOPWORDS = {
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
    'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'o',
    'este', 'si', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'tambien',
    'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos',
    'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto',
    'mi', 'antes', 'algunos', 'unos', 'yo', 'otro', 'otras', 'otra', 'ella',
    'era', 'fue', 'son', 'ser', 'ha', 'han', 'sido', 'tiene', 'tienen', 'estan', 'folio', 'pagina'
}


def generar_sugerencias_keywords(min_docs: int = 5, top: int = 5, limpiar: bool = False, unidad=None) -> dict:
    """Analiza documentos verificados por humanos para sugerir de forma estadística
    nuevas palabras clave por TipoDocumento, sin IA externa, filtrando por unidad.
    """
    if limpiar:
        del_qs = SugerenciaKeyword.objects.filter(aceptada__isnull=True)
        if unidad is not None:
            del_qs = del_qs.filter(tipo_documento__unidad=unidad)
        del_qs.delete()

    qs_verificados = Documento.objects.filter(
        estado='verificado',
        tipo_documento__isnull=False,
    ).exclude(texto_extraido='').select_related('tipo_documento')

    if unidad is not None:
        qs_verificados = qs_verificados.filter(unidad=unidad)

    total_verificados = qs_verificados.count()
    if total_verificados == 0:
        return {
            'success': False,
            'message': 'No existen documentos verificados con texto extraído para analizar.',
            'total_generadas': 0,
            'total_verificados': 0,
        }

    docs_por_tipo = defaultdict(int)
    freq_por_tipo = defaultdict(Counter)

    for doc in qs_verificados:
        tipo_id = doc.tipo_documento_id
        docs_por_tipo[tipo_id] += 1
        texto = normalizar(doc.texto_extraido)
        palabras = {
            w for w in texto.split()
            if len(w) >= 4 and not w.isdigit() and w not in STOPWORDS
        }
        for p in palabras:
            freq_por_tipo[tipo_id][p] += 1

    tipos = {t.id: t for t in TipoDocumento.objects.filter(id__in=docs_por_tipo.keys())}
    sugerencias_creadas = 0

    for tipo_id, tipo in tipos.items():
        docs_este_tipo = docs_por_tipo[tipo_id]
        docs_otros_tipos = total_verificados - docs_este_tipo

        palabras_existentes = {p for p, _ in parsear_palabras_clave(tipo.palabras_clave)}
        palabras_existentes.update(tipo.keywords_obligatorias or [])

        candidatas = []
        for palabra, f_tipo in freq_por_tipo[tipo_id].items():
            if palabra in palabras_existentes:
                continue

            f_otros = sum(
                freq_por_tipo[otro_id].get(palabra, 0)
                for otro_id in docs_por_tipo
                if otro_id != tipo_id
            )

            p_tipo = f_tipo / docs_este_tipo
            p_otros = (f_otros + 0.5) / (max(1, docs_otros_tipos) + 1.0)
            ratio = p_tipo / p_otros

            if ratio >= 1.2:
                candidatas.append((palabra, ratio, f_tipo))

        candidatas.sort(key=lambda x: (x[1], x[2]), reverse=True)
        top_candidatas = candidatas[:top]

        for palabra, ratio, f_tipo in top_candidatas:
            _, created = SugerenciaKeyword.objects.update_or_create(
                tipo_documento=tipo,
                palabra=palabra,
                defaults={
                    'ratio': round(ratio, 2),
                    'frecuencia': f_tipo,
                    'aceptada': None,
                },
            )
            if created:
                sugerencias_creadas += 1

    msg = f"Se analizaron {total_verificados} documentos y se generaron {sugerencias_creadas} nuevas sugerencias."
    if total_verificados < min_docs:
        msg += f" (Aviso: hay {total_verificados} documentos verificados, se recomiendan ≥ {min_docs} para máxima precisión)."

    return {
        'success': True,
        'message': msg,
        'total_generadas': sugerencias_creadas,
        'total_verificados': total_verificados,
    }
