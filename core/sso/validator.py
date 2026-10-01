"""
Validación del estado de la sesión SSO, por request.

Compara los claims del JWT contra el estado local en Redis. Si difieren, la
sesión fue alterada en admincentral después de emitirse el token.

Orden de validación:

  0. marca de revocación → rechaza. Es la señal explícita: un admin cerró la
                           sesión, o el IdP la cerró por inactividad.
  1. pv (perms_version)  → solo se registra en log. Los permisos se releen de
                           Redis en cada request, así que un pv desactualizado
                           no requiere cortar la sesión.
  2. dv (device_version) → un mismatch revoca: el dispositivo fue dado de baja.

  tw_end (horario)       → deshabilitado. La validación de ventana horaria se
                           retiró; `SSO_EXPIRED_CODE` se mantiene porque los
                           frontends ya lo manejan y el IdP puede emitirlo.

El paso 0 y la limpieza de la marca en `state.seed_from_jwt()` son una sola
pieza: si existiera el paso 0 sin la limpieza, un usuario que se re-loguea
legítimamente quedaría rechazado hasta que expire la marca (24 h). No toques
uno sin mirar el otro.

Por qué el paso 0 hace falta si el `dv` ya corta: admincentral siempre manda
`device_revoked` junto a `session_revoked`, así que el `dv` alcanzaba para
cortar — pero con el mensaje equivocado ("Dispositivo revocado") y sin poder
distinguir un cierre por inactividad de una baja de dispositivo. El paso 0 da
el motivo real.
"""

import logging

from .errores import CodigosError, error_auth
from .state import (
    get_local_dv,
    get_local_pv,
    motivo_revocacion,
    set_local_dv,
    set_local_pv,
)

logger = logging.getLogger(__name__)

# Alias históricos — los frontends ya los usan. La definición canónica está
# en `errores.CodigosError`, junto al resto de los códigos.
SSO_REVOKED_CODE = CodigosError.SSO_SESSION_REVOKED
SSO_EXPIRED_CODE = CodigosError.SSO_SESSION_EXPIRED

#: Mensaje al usuario según el motivo que informó admincentral.
_MENSAJES_REVOCACION = {
    "idle":            "Tu sesión se cerró por inactividad. Por favor, vuelve a ingresar.",
    "device_revoked":  "Dispositivo revocado. Contacta al administrador del sistema.",
}
_MENSAJE_REVOCACION_GENERICO = "Tu sesión fue cerrada. Por favor, vuelve a ingresar."


def validar_estado_sso(token_payload: dict) -> None:
    """
    Valida la sesión contra Redis local. Solo actúa sobre tokens sso_access.

    Con cache frío (Redis vacío o reiniciado) siembra el valor del JWT y
    permite el request: fail-open consciente, documentado en `state.py`.

    Raises:
        GraphQLError: si la sesión debe rechazarse.
    """
    if token_payload.get("token_type") != "sso_access":
        return

    user_id = token_payload.get("sub", "")
    rol_id  = token_payload.get("rol_id", "")
    pv_jwt  = token_payload.get("pv")
    dv_jwt  = token_payload.get("dv")

    _validar_revocacion(user_id)
    _validar_pv(user_id, rol_id, pv_jwt)
    _validar_dv(user_id, dv_jwt)


def _validar_revocacion(user_id: str) -> None:
    """Paso 0: la sesión fue cerrada explícitamente en admincentral."""
    if not user_id:
        return

    motivo = motivo_revocacion(user_id)
    if motivo is None:
        return

    logger.info("SSO: sesión revocada user=%s motivo=%s", user_id, motivo)
    raise error_auth(
        _MENSAJES_REVOCACION.get(motivo, _MENSAJE_REVOCACION_GENERICO),
        CodigosError.SSO_SESSION_REVOKED,
    )


def _validar_pv(user_id: str, rol_id: str, pv_jwt) -> None:
    """Mismatch de perms_version: solo se registra, no corta la sesión."""
    if pv_jwt is None or not rol_id:
        return

    local_pv = get_local_pv(rol_id)
    if local_pv is None:
        set_local_pv(rol_id, int(pv_jwt))
    elif local_pv != int(pv_jwt):
        logger.info(
            "SSO: pv mismatch user=%s rol=%s pv_jwt=%s pv_local=%s — "
            "permisos actualizados en Redis, sesión continúa",
            user_id, rol_id, pv_jwt, local_pv,
        )


def _validar_dv(user_id: str, dv_jwt) -> None:
    """Mismatch de device_version: el dispositivo fue revocado."""
    if dv_jwt is None or not user_id:
        return

    local_dv = get_local_dv(user_id)
    if local_dv is None:
        set_local_dv(user_id, int(dv_jwt))
        return

    if local_dv != int(dv_jwt):
        logger.warning(
            "SSO: dv mismatch user=%s dv_jwt=%s dv_local=%s — dispositivo revocado",
            user_id, dv_jwt, local_dv,
        )
        raise error_auth(
            "Dispositivo revocado. Contacta al administrador del sistema.",
            CodigosError.SSO_SESSION_REVOKED,
        )
