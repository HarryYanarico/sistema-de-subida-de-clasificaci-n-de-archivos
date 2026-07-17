import re
import fitz
from django.conf import settings
from .services import MinIOService


class PDFProcessor:
    def __init__(self):
        self.storage = MinIOService()
        self._ai_classifier = None

    @property
    def ai_classifier(self):
        if self._ai_classifier is None:
            from .ai_classifier import GeminiClassifier
            self._ai_classifier = GeminiClassifier()
        return self._ai_classifier

    def process_pdf(self, persona_codigo: str, filename: str, file_content: bytes) -> list[dict]:
        from apps.personas.models import Persona

        persona = Persona.objects.filter(codigo=persona_codigo).first()
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

            tipo_documento = None

            if not self._is_blank(text):
                tipo_documento, score = self._classify_local(text)

                if tipo_documento is None:
                    sanitized = self._sanitize_text_for_ai(text, persona)
                    tipo_documento = self._classify_with_ai(sanitized)

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

    def _is_blank(self, text: str) -> bool:
        if not text or not text.strip():
            return True
        clean = re.sub(r'\s+', '', text)
        return len(clean) < 10

    def _classify_local(self, text: str) -> tuple:
        from apps.documentos.models import TipoDocumento

        tipos = TipoDocumento.objects.filter(activo=True)
        texto_lower = text.lower()
        mejor_tipo = None
        max_score = 0

        for tipo in tipos:
            if tipo.lista_requiere:
                tiene_requerida = False
                for palabra in tipo.lista_requiere:
                    if palabra in texto_lower:
                        tiene_requerida = True
                        break
                if not tiene_requerida:
                    continue

            if tipo.lista_excluye:
                excluido = False
                for slug in tipo.lista_excluye:
                    if slug in texto_lower:
                        excluido = True
                        break
                if excluido:
                    continue

            score = 0
            for palabra, peso in tipo.lista_palabras_clave_con_pesos:
                if palabra in texto_lower:
                    score += peso

            if score >= tipo.score_minimo and score > max_score:
                max_score = score
                mejor_tipo = tipo

        return mejor_tipo, max_score

    def _sanitize_text_for_ai(self, text: str, persona) -> str:
        sanitized = text

        if persona:
            campos = [
                persona.nombres,
                persona.apellidos,
                persona.ci,
                persona.email,
                persona.telefono,
                persona.codigo,
            ]
            for valor in campos:
                if valor:
                    escaped = re.escape(str(valor))
                    sanitized = re.sub(escaped, '', sanitized, flags=re.IGNORECASE)

        sanitized = re.sub(r'\d+', '', sanitized)

        sanitized = re.sub(r'\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b', '', sanitized)
        sanitized = re.sub(r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'\b\d{1,2}\s+de\s+\w+\b', '', sanitized, flags=re.IGNORECASE)

        sanitized = re.sub(r'[^\w\s.,;:!?¿¡\-]', '', sanitized)
        sanitized = re.sub(r'\s+', ' ', sanitized).strip()

        return sanitized

    def _classify_with_ai(self, sanitized_text: str):
        from apps.documentos.models import TipoDocumento

        if not self.ai_classifier.is_available:
            return None

        tipos = list(
            TipoDocumento.objects.filter(activo=True)
            .values('nombre', 'slug')
        )

        if not tipos:
            return None

        slug = self.ai_classifier.classify(sanitized_text, tipos)
        if slug:
            return TipoDocumento.objects.filter(slug=slug).first()
        return None
