"""
Vistas del cliente SSO.

  SSOCallbackView       GET  /api/sso/callback?ticket=<uuid>
  SSORefreshSessionView POST /api/sso/refresh-session
  SSOEventsView         GET  /api/sso/events   (stream SSE)
"""

import json
import logging

import jwt
import requests as _req
from django.http import (
    HttpResponse,
    JsonResponse,
    StreamingHttpResponse,
)
from django.views import View

from . import config
from .client import exchange_ticket, refresh_token as idp_refresh
from .notify import canal_rol, canal_usuario
from .state import get_local_dv, get_local_pv, motivo_revocacion, seed_from_jwt

logger = logging.getLogger(__name__)

_KEEPALIVE_TIMEOUT = 25


def _set_session_cookies(response, access_token: str, refresh_token: str) -> None:
    """
    Establece las cookies de sesión.

    El refresh token es HttpOnly siempre. El access token depende de
    `SSO_COOKIE_HTTPONLY` (default False, histórico: el frontend lo lee desde
    document.cookie). Ver la advertencia en config.cookie_httponly().
    """
    comunes = {
        "samesite": config.cookie_samesite(),
        "secure":   config.cookie_secure(),
        "max_age":  config.cookie_max_age(),
    }
    response.set_cookie(
        "sso_access_token", access_token,
        httponly=config.cookie_httponly(), **comunes,
    )
    response.set_cookie(
        "sso_refresh_token", refresh_token,
        httponly=True, **comunes,
    )


def _sembrar_estado(data: dict) -> tuple[str, str]:
    """
    Extrae los tokens de la respuesta del IdP y siembra el estado local.

    `permissions` ausente → None → `seed_from_jwt` no toca el caché existente,
    en vez de pisarlo con una lista vacía.

    El token se decodifica sin verificar firma a propósito: viene recién
    entregado por el IdP en una llamada servidor-a-servidor, no del cliente.
    """
    access_token  = data["access_token"]
    refresh_token = data["refresh_token"]

    try:
        payload = jwt.decode(
            access_token,
            options={"verify_signature": False},
            algorithms=["RS256"],
        )
        seed_from_jwt(payload, permissions=data.get("permissions"))
    except Exception as exc:
        logger.warning("SSO: error sembrando estado en Redis: %s", exc)

    return access_token, refresh_token


class SSOCallbackView(View):
    """Canjea el ticket por JWT y establece las cookies de sesión."""

    def get(self, request):
        ticket = request.GET.get("ticket", "").strip()
        if not ticket:
            return JsonResponse({"error": "ticket requerido"}, status=400)

        try:
            data = exchange_ticket(ticket)
        except _req.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 400
            return JsonResponse({"error": "ticket inválido o expirado"}, status=status)
        except Exception as exc:
            logger.error("SSOCallbackView: error al contactar el IdP: %s", exc)
            return JsonResponse({"error": "error al contactar el IdP"}, status=502)

        access_token, refresh_token = _sembrar_estado(data)

        # Devuelve 200 con meta-refresh en vez de 302: setea las cookies por
        # headers HTTP y redirige sin JavaScript, así no lo bloquea el CSP.
        response = HttpResponse(
            '<!DOCTYPE html><html><head><meta charset="utf-8">'
            '<meta http-equiv="refresh" content="0;url=/">'
            '</head><body>Iniciando sesión…</body></html>',
            content_type="text/html; charset=utf-8",
        )
        _set_session_cookies(response, access_token, refresh_token)
        return response


class SSORefreshSessionView(View):
    """Renueva el access token usando la cookie de refresh."""

    def post(self, request):
        sso_refresh = request.COOKIES.get("sso_refresh_token", "")
        if not sso_refresh:
            return JsonResponse({"error": "sin refresh token"}, status=401)

        try:
            data = idp_refresh(sso_refresh)
        except _req.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 401
            return JsonResponse(
                {"error": "sesión expirada, volver a iniciar sesión"}, status=status
            )
        except Exception as exc:
            logger.error("SSORefreshSessionView: error al contactar el IdP: %s", exc)
            return JsonResponse({"error": "error al contactar el IdP"}, status=502)

        access_token, refresh_token = _sembrar_estado(data)

        response = JsonResponse({"ok": True})
        _set_session_cookies(response, access_token, refresh_token)
        return response


class SSOEventsView(View):
    """
    Stream SSE de eventos de sesión en tiempo real.

    Emite dos eventos:
      permission_change  cambiaron los permisos del rol → el frontend renueva
                         la sesión y relee los permisos, sin logout
      session_revoked    la sesión fue cerrada → el frontend cierra sesión

    Se suscribe a dos canales: el del rol (permisos) y el del usuario
    (revocación). El del usuario solo si el token trae `sub`.

    Generador async a propósito: bajo uvicorn, un generador síncrono obliga a
    Django a puentear cada iteración a un hilo (sync_to_async), lo que bajo
    carga corta la conexión a medio stream (ERR_INCOMPLETE_CHUNKED_ENCODING).

    ⚠ PENDIENTE — este endpoint NO verifica la firma del token.
    Decodifica con verify_signature=False y acepta HS256, y usa el `rol_id`
    resultante para elegir a qué canal suscribirse. Cualquiera puede forjar un
    token sin firmar y escuchar el canal de otro rol. El dato expuesto es
    mínimo (solo "hubo un cambio"), pero es autenticación rota y permite abrir
    conexiones sin credenciales. La corrección es usar
    `DecodificadorJWT.decodificar_token`.
    """

    async def get(self, request):
        access_token = request.COOKIES.get("sso_access_token", "")
        if not access_token:
            return HttpResponse(status=401)

        try:
            payload = jwt.decode(
                access_token,
                options={"verify_signature": False},
                algorithms=["RS256", "HS256"],
            )
            rol_id  = str(payload.get("rol_id", "")).strip()
            user_id = str(payload.get("sub", "")).strip()
            pv_jwt  = payload.get("pv")
            dv_jwt  = payload.get("dv")
        except Exception:
            return HttpResponse(status=401)

        if not rol_id:
            return HttpResponse(status=401)

        response = StreamingHttpResponse(
            self._event_stream(rol_id, user_id, pv_jwt, dv_jwt),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    # ───────────────────────────────────────────── formato de eventos

    @staticmethod
    def _sse(evento: str, datos: dict) -> str:
        return f"event: {evento}\ndata: {json.dumps(datos)}\n\n"

    @classmethod
    def _evento_permisos(cls, rol_id: str) -> str:
        return cls._sse("permission_change", {"rolId": rol_id})

    @classmethod
    def _evento_revocacion(cls, user_id: str, motivo: str) -> str:
        return cls._sse("session_revoked", {"userId": user_id, "reason": motivo or ""})

    # ───────────────────────────────────────────── chequeo al conectar

    @staticmethod
    def _revocacion_pendiente(user_id: str, dv_jwt) -> str | None:
        """
        ¿Hay que expulsar a este navegador apenas se conecta?

        Cubre el caso de que la revocación haya ocurrido con el navegador
        cerrado o sin red: el PUBLISH se perdió porque no había nadie
        escuchando, pero el estado quedó en Redis. Sin este chequeo, el
        usuario revocado reabriría la pestaña y seguiría trabajando hasta su
        próxima acción.

        Devuelve el motivo, o None si la sesión está sana.
        """
        if not user_id:
            return None
        try:
            motivo = motivo_revocacion(user_id)
            if motivo:
                return motivo

            # Red de seguridad por si se perdió el evento session_revoked pero
            # sí se aplicó el device_revoked. Se compara con `>` y no con `!=`
            # (como hace el validator) porque acá solo interesa el caso
            # "revocado después de emitirse este token": un dv local MENOR
            # significa que nos falta un evento, no que haya una revocación.
            dv_local = get_local_dv(user_id)
            if dv_local is not None and dv_jwt is not None and int(dv_local) > int(dv_jwt):
                return "device_revoked"
        except Exception:
            pass
        return None

    @staticmethod
    def _nombre_canal(msg) -> str:
        canal = msg.get("channel")
        if isinstance(canal, (bytes, bytearray)):
            return canal.decode("utf-8", "replace")
        return str(canal or "")

    @staticmethod
    def _cuerpo(msg) -> str:
        dato = msg.get("data")
        if isinstance(dato, (bytes, bytearray)):
            return dato.decode("utf-8", "replace")
        return str(dato or "")

    # ───────────────────────────────────────────────────── el stream

    @classmethod
    async def _event_stream(cls, rol_id: str, user_id: str, pv_jwt, dv_jwt):
        import redis.asyncio as _redis_async

        canal_permisos   = canal_rol(rol_id)
        canal_revocacion = canal_usuario(user_id) if user_id else None

        r = _redis_async.from_url(config.redis_url())
        pubsub = r.pubsub(ignore_subscribe_messages=True)
        await pubsub.subscribe(*[c for c in (canal_permisos, canal_revocacion) if c])

        try:
            yield ": keep-alive\n\n"

            # 1. ¿La sesión ya estaba revocada antes de conectarnos?
            motivo = cls._revocacion_pendiente(user_id, dv_jwt)
            if motivo is not None:
                yield cls._evento_revocacion(user_id, motivo)
                return   # expulsado: no tiene sentido mantener el stream

            # 2. ¿Los permisos cambiaron mientras el navegador estaba cerrado?
            try:
                pv_local = get_local_pv(rol_id)
                if pv_local is not None and pv_jwt is not None and int(pv_local) > int(pv_jwt):
                    yield cls._evento_permisos(rol_id)
            except Exception:
                pass

            # 3. Escuchar hasta que el navegador se vaya o lo expulsemos.
            while True:
                msg = await pubsub.get_message(timeout=_KEEPALIVE_TIMEOUT)
                if msg is None:
                    yield ": ping\n\n"
                    continue
                if msg.get("type") != "message":
                    continue

                if canal_revocacion and cls._nombre_canal(msg) == canal_revocacion:
                    yield cls._evento_revocacion(user_id, cls._cuerpo(msg))
                    return

                yield cls._evento_permisos(rol_id)

        except GeneratorExit:
            pass
        finally:
            try:
                await pubsub.unsubscribe()
                await pubsub.close()
                await r.close()
            except Exception:
                pass
