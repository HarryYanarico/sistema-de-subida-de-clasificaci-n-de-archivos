import fitz  # PyMuPDF
from django.conf import settings
from .services import MinIOService


class PDFProcessor:
    def __init__(self):
        self.storage = MinIOService()

    def process_pdf(self, persona_codigo: str, filename: str, file_content: bytes) -> list[dict]:
        doc = fitz.open(stream=file_content, filetype="pdf")
        original_key = self.storage.upload_pdf(persona_codigo, filename, file_content)
        results = []

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()

            pdf_page = fitz.open()
            pdf_page.insert_pdf(doc, from_page=page_num, to_page=page_num)
            page_bytes = pdf_page.tobytes()
            page_key = self.storage.upload_pagina(persona_codigo, page_num + 1, page_bytes)

            tipo_documento = self._classify(text)

            results.append({
                'pagina_numero': page_num + 1,
                'texto_extraido': text,
                'archivo_original': original_key,
                'archivo_pagina': page_key,
                'tipo_documento': tipo_documento,
            })

            pdf_page.close()

        doc.close()
        return results

    def _classify(self, text: str):
        from apps.documentos.models import TipoDocumento

        tipos = TipoDocumento.objects.filter(activo=True)
        texto_lower = text.lower()
        mejor_tipo = None
        max_coincidencias = 0

        for tipo in tipos:
            palabras = tipo.lista_palabras_clave
            coincidencias = sum(1 for p in palabras if p in texto_lower)
            if coincidencias > max_coincidencias:
                max_coincidencias = coincidencias
                mejor_tipo = tipo

        return mejor_tipo if max_coincidencias > 0 else None
