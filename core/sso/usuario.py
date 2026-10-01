"""
Usuario en memoria construido a partir del JWT.

El sistema es stateless: no hay tabla de usuarios local. `UsuarioExterno`
expone la interfaz mínima que Django y los guards esperan (`is_authenticated`,
`has_perm`, `is_superuser`) para poder inyectarse en `request.user` sin
depender del modelo de usuario de Django.
"""

from dataclasses import dataclass, field
from typing import Set


@dataclass
class UsuarioExterno:
    user_id: str
    username: str
    nombre_completo: str
    email: str
    codigo_funcionario: str
    codigo_unidad: str
    cargo: str
    permisos: Set[str] = field(default_factory=set)
    is_authenticated: bool = True
    is_superuser: bool = False
    # Solo presente en tokens sso_access
    rol_id: str = ''

    @classmethod
    def desde_dict(cls, datos: dict) -> 'UsuarioExterno':
        """
        Mapea los datos ya normalizados por `DecodificadorJWT` al objeto.
        Sirve igual para token legacy (access) y para el nuevo (sso_access):
        la normalización de formatos ocurre antes, en `tokens.py`.
        """
        return cls(
            user_id=datos.get('id_usuario'),
            username=datos.get('nombre_usuario'),
            nombre_completo=datos.get('nombre'),
            email=datos.get('correo'),
            codigo_funcionario=datos.get('codigo_usuario'),
            codigo_unidad=datos.get('unidad_codigo'),
            cargo=datos.get('cargo'),
            permisos=datos.get('permisos', set()),
            rol_id=datos.get('rol_id', ''),
        )

    def has_perm(self, perm: str) -> bool:
        return perm in self.permisos or self.is_superuser

    @property
    def is_anonymous(self) -> bool:
        return not self.is_authenticated
