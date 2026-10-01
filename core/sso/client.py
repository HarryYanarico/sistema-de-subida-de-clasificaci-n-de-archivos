"""
Cliente HTTP del IdP admincentral.

Encapsula las dos llamadas que cada sistema externo necesita hacer:

  exchange_ticket(ticket)      → POST /api/sso/exchange-ticket
  refresh_token(refresh_token) → POST /api/sso/refresh

Ambas devuelven el mismo contrato:
  access_token, refresh_token, permissions[], pv, token_type, expires_in

Los settings que consume están declarados en `config.py`.
"""

import logging

import requests

from . import config

logger = logging.getLogger(__name__)


def _headers(**extra: str) -> dict:
    cabeceras = {
        "API-Key":      config.api_key(),
        "Content-Type": "application/json",
        "User-Agent":   config.user_agent(),
    }
    cabeceras.update(extra)
    return cabeceras


def exchange_ticket(ticket: str) -> dict:
    """
    Canjea un ticket UUID de un solo uso por access token, refresh y permisos.

    Raises:
        requests.HTTPError:      admincentral devolvió 4xx/5xx.
        requests.ConnectionError: admincentral no responde.
    """
    resp = requests.post(
        f"{config.url_idp()}/api/sso/exchange-ticket",
        headers=_headers(),
        json={"ticket": ticket, "api_key": config.system_key()},
        timeout=config.http_timeout(),
    )
    resp.raise_for_status()
    return resp.json()


def refresh_token(refresh_token_str: str) -> dict:
    """
    Renueva el access token. El IdP re-verifica dispositivo autorizado y
    ventana horaria en cada renovación.

    Raises:
        requests.HTTPError:      token expirado o rechazado (401/403).
        requests.ConnectionError: admincentral no responde.
    """
    resp = requests.post(
        f"{config.url_idp()}/api/sso/refresh",
        headers=_headers(**{"X-SSO-API-Key": config.system_key()}),
        json={"refresh_token": refresh_token_str},
        timeout=config.http_timeout(),
    )
    resp.raise_for_status()
    return resp.json()
