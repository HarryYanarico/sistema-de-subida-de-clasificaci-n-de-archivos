import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class GeminiClassifier:
    def __init__(self):
        self.api_key = getattr(settings, 'GEMINI_API_KEY', '')
        self.client = None
        self._configure()

    def _configure(self):
        if not self.api_key:
            logger.warning('GEMINI_API_KEY no configurada. Clasificación IA deshabilitada.')
            return

        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            logger.info('Gemini clasificador inicializado correctamente.')
        except ImportError:
            logger.error('google-genai no instalado. pip install google-genai')
        except Exception as e:
            logger.error(f'Error configurando Gemini: {e}')

    @property
    def is_available(self):
        return self.client is not None

    def suggest_classification(self, text: str, tipos_documento: list[dict]) -> dict:
        if not self.is_available:
            return {'tipo_sugerido': None, 'palabras_clave': '', 'es_nuevo_tipo': False, 'nombre_sugerido': ''}

        if not text or len(text.strip()) < 20:
            return {'tipo_sugerido': None, 'palabras_clave': '', 'es_nuevo_tipo': False, 'nombre_sugerido': ''}

        text_truncated = text[:1000]

        tipos_nombres = '\n'.join(
            f'- {t["nombre"]}' for t in tipos_documento
        )

        prompt = f"""Eres un clasificador de documentos escaneados de una universidad en Bolivia.
Analiza el siguiente texto extraido de un documento.

Tipos de documento disponibles:
{tipos_nombres}

Instrucciones:
1. Determina a qué tipo de documento corresponde el texto. Si ninguno es adecuado, responde "NUEVO" y sugiere un nombre para el nuevo tipo.
2. Extrae palabras clave relevantes del texto que permitan identificar este tipo de documento.

Responde EXACTAMENTE en este formato (3 líneas):
TIPO: [nombre exacto del tipo de documento de la lista, o NUEVO si no existe uno adecuado]
NOMBRE_NUEVO: [si TIPO es NUEVO, sugiere un nombre corto y descriptivo para el tipo. Si TIPO no es NUEVO, dejalo vacio]
KEYWORDS: [lista de palabras clave separadas por coma, en minusculas, sin acentos]

Ejemplo 1 (tipo existente):
TIPO: Certificado de Nacimiento
NOMBRE_NUEVO:
KEYWORDS: certificado, nacimiento, registro civil, partida, nacido

Ejemplo 2 (tipo nuevo):
TIPO: NUEVO
NEMON_NUEVO: Libreta de Notas
KEYWORDS: libreta, notas, calificaciones, promedio, semestre

Texto del documento:
{text_truncated}"""

        try:
            response = self.client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
            )
            respuesta = response.text.strip()

            tipo_sugerido = None
            palabras_clave = ''
            es_nuevo_tipo = False
            nombre_sugerido = ''

            for line in respuesta.split('\n'):
                line = line.strip()
                if line.upper().startswith('TIPO:'):
                    raw_tipo = line[5:].strip().strip('"\'').strip()
                    if raw_tipo.upper() == 'NUEVO':
                        es_nuevo_tipo = True
                    else:
                        for tipo in tipos_documento:
                            if tipo['nombre'].lower() == raw_tipo.lower():
                                tipo_sugerido = tipo
                                break
                        if not tipo_sugerido:
                            for tipo in tipos_documento:
                                if tipo['nombre'].lower() in raw_tipo.lower():
                                    tipo_sugerido = tipo
                                    break
                elif line.upper().startswith('NOMBRE_NUEVO:'):
                    nombre_sugerido = line[12:].strip().strip('"\'').strip()
                elif line.upper().startswith('KEYWORDS:'):
                    keywords_raw = line[9:].strip().strip('"\'').strip()
                    palabras_clave = keywords_raw

            return {
                'tipo_sugerido': tipo_sugerido,
                'palabras_clave': palabras_clave,
                'es_nuevo_tipo': es_nuevo_tipo,
                'nombre_sugerido': nombre_sugerido,
                'raw_response': respuesta,
            }

        except Exception as e:
            logger.error(f'Error en sugerencia Gemini: {e}')
            return {'tipo_sugerido': None, 'palabras_clave': '', 'es_nuevo_tipo': False, 'nombre_sugerido': '', 'raw_response': str(e)}

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
            response = self.client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
            )
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
