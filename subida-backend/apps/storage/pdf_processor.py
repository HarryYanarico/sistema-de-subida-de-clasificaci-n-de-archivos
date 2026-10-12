import io
import re
import fitz
from .clasificador import ResultadoClasificacion, clasificar
from .services import MinIOService

# Escala del pixmap usado para calcular el pHash. No hace falta resolucion
# alta: el pHash mira estructura, no detalle, y el mismo factor alimenta al
# endpoint de miniaturas que ya existe.
ESCALA_PHASH = 0.5


class PDFProcessor:
    def __init__(self):
        self.storage = MinIOService()

    def process_pdf(self, persona_codigo: str, filename: str, file_content: bytes,
                    persona=None) -> list[dict]:
        if persona is None:
            persona = self._resolver_persona(persona_codigo)
        doc = fitz.open(stream=file_content, filetype="pdf")
        original_key = self.storage.upload_pdf(persona_codigo, filename, file_content)
        results = []

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()

            tipo_documento = None
            resultado = ResultadoClasificacion()

            if not self._is_blank(text):
                resultado = self._classify_local(text)
                tipo_documento = resultado.tipo_ganador

            results.append({
                'pagina_numero': page_num + 1,
                'texto_extraido': text,
                'archivo_original': original_key,
                'tipo_documento': tipo_documento,
                'score': resultado.score_ganador if tipo_documento else None,
                'keywords_matcheadas': resultado.keywords_matcheadas if tipo_documento else [],
                'es_dudosa': resultado.es_dudosa and tipo_documento is not None,
                'phash': self._calcular_phash(page),
            })

        doc.close()
        return results

    @staticmethod
    def _calcular_phash(page) -> str | None:
        """pHash de la pagina, o None si la imagen no se puede leer.

        El pixmap se queda en memoria y se descarta: el proyecto ya renderiza
        las miniaturas on-the-fly en `DocumentoThumbnailView`, asi que guardar
        un PNG por pagina en MinIO seria duplicar el almacenamiento sin ganar
        nada (el pHash no necesita volver a mirar la imagen).
        """
        try:
            import imagehash
            from PIL import Image

            pix = page.get_pixmap(matrix=fitz.Matrix(ESCALA_PHASH, ESCALA_PHASH))
            with Image.open(io.BytesIO(pix.tobytes('png'))) as imagen:
                return str(imagehash.phash(imagen))
        except Exception:
            # Una pagina ilegible no debe tumbar la ingesta completa: se
            # clasifica igual, solo se pierde la deteccion de duplicados.
            return None

    @staticmethod
    def _resolver_persona(persona_codigo: str):
        """Resuelve la persona por codigo (unico global en single-tenant)."""
        from apps.personas.models import Persona

        return Persona.objects.filter(codigo=persona_codigo).first()

    def _is_blank(self, text: str) -> bool:
        if not text or not text.strip():
            return True
        clean = re.sub(r'\s+', '', text)
        return len(clean) < 10

    def _classify_local(self, text: str) -> ResultadoClasificacion:
        from apps.documentos.models import TipoDocumento

        tipos = TipoDocumento.objects.filter(activo=True)
        return clasificar(text, tipos)
