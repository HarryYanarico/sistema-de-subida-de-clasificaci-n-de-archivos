from apps.documentos.models import Documento, TipoDocumento
from apps.personas.models import Persona


class DatosGraphQL:
    """Datos minimos para ejercitar las queries y mutaciones (single-tenant)."""

    @classmethod
    def crear(cls):
        # Los seeds historicos (17 tipos) compiten en el scoring global: se
        # desactivan para que los tests de clasificacion sean deterministicos.
        TipoDocumento.objects.all().update(activo=False)

        from apps.core.models import Unidad
        legacy, _ = Unidad.objects.get_or_create(codigo='LEGACY', defaults={'nombre': 'Unidad Legacy Transitoria'})

        persona = Persona.objects.create(
            unidad=legacy,
            codigo='310000001',
            nombres='Juan',
            apellidos='Perez',
            ci='1234567',
        )
        Persona.objects.create(
            unidad=legacy,
            codigo='310000002',
            nombres='Maria',
            apellidos='Lopez',
        )

        tipo = TipoDocumento.objects.create(
            unidad=legacy,
            nombre='Certificado de Nacimiento',
            slug='certificado-de-nacimiento',
            palabras_clave='certificado,nacimiento:3',
        )
        TipoDocumento.objects.create(
            unidad=legacy,
            nombre='Comprobante de Pago',
            slug='comprobante-de-pago',
            palabras_clave='comprobante,pago',
            activo=False,
        )

        clasificado = Documento.objects.create(
            unidad=legacy,
            persona=persona,
            tipo_documento=tipo,
            archivo_original='originales/1.pdf',
            pagina_numero=1,
            texto_extraido='CERTIFICADO DE NACIMIENTO',
            estado='clasificado',
        )
        pendiente = Documento.objects.create(
            unidad=legacy,
            persona=persona,
            archivo_original='originales/1.pdf',
            pagina_numero=2,
            texto_extraido='texto sin coincidir',
            estado='pendiente',
        )

        return {
            'persona': persona,
            'tipo': tipo,
            'clasificado': clasificado,
            'pendiente': pendiente,
        }
