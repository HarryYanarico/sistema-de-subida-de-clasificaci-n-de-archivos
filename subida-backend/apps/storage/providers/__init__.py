from .base import ArchivoRemoto, ErrorArchivo, ErrorProveedor, ProveedorRemoto
from .google_drive import GoogleDriveProveedor

PROVEEDORES = {
    'google_drive': GoogleDriveProveedor,
}


def obtener_proveedor(origen):
    clase = PROVEEDORES.get(origen.tipo)
    if clase is None:
        disponibles = ', '.join(sorted(PROVEEDORES)) or 'ninguno'
        raise ErrorProveedor(
            f'El tipo de origen "{origen.tipo}" todavía no está implementado. '
            f'Tipos disponibles: {disponibles}'
        )
    return clase(origen)


__all__ = [
    'ArchivoRemoto',
    'ErrorArchivo',
    'ErrorProveedor',
    'ProveedorRemoto',
    'GoogleDriveProveedor',
    'PROVEEDORES',
    'obtener_proveedor',
]
