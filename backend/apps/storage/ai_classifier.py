import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class GeminiClassifier:
    def __init__(self):
        self.api_key = getattr(settings, 'GEMINI_API_KEY', '')
        self.model = None
        self._configure()

    def _configure(self):
        if not self.api_key:
            logger.warning('GEMINI_API_KEY no configurada. Clasificación IA deshabilitada.')
            return

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            logger.info('Gemini clasificador inicializado correctamente.')
        except ImportError:
            logger.error('google-generativeai no instalado. pip install google-generativeai')
        except Exception as e:
            logger.error(f'Error configurando Gemini: {e}')

    @property
    def is_available(self):
        return self.model is not None

    def classify(self, text: str, tipos_documento: list[dict]) -> str | None:
        if not self.is_available:
            return None

        if not text or len(text.strip()) < 20:
            return None

        text_truncated = text[:500]

        tipos_nombres = '\n'.join(
            f'- {t["nombre"]}' for t in tipos_documento
        )

        prompt = f"""Eres un clasificador de documentos escaneados de una universidad en Bolivia.
Analiza el siguiente texto extraido de un documento y clasificalo en UNO de estos tipos de documento.

Tipos de documento disponibles:
{tipos_nombres}

Reglas:
- Responde UNICAMENTE con el nombre exacto del tipo de documento de la lista.
- Si no puedes determinar el tipo, responde: SIN_CLASIFICAR
- No incluyas explicaciones, solo el nombre exacto.

Texto del documento:
{text_truncated}"""

        try:
            response = self.model.generate_content(prompt)
            respuesta = response.text.strip()

            respuesta_limpia = respuesta.strip('"\'').strip()

            if 'SIN_CLASIFICAR' in respuesta_limpia.upper():
                return None

            for tipo in tipos_documento:
                if tipo['nombre'].lower() == respuesta_limpia.lower():
                    return tipo['slug']

            for tipo in tipos_documento:
                if tipo['nombre'].lower() in respuesta_limpia.lower():
                    return tipo['slug']

            logger.warning(f'Gemini respondio tipo no reconocido: {respuesta_limpia}')
            return None

        except Exception as e:
            logger.error(f'Error en clasificacion Gemini: {e}')
            return None
