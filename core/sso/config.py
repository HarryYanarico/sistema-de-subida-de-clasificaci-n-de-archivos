"""
Punto único de lectura de la configuración del paquete SSO.

Antes cada módulo hacía su propio `getattr(settings, ...)`. El default de
`URL_API_SSO` estaba escrito en `client.py` y otra vez en `jwks.py`; el de
`SSO_SYSTEM_SLUG` era `""` en `jwt.py` pero `"sistema"` en `consumer.py`;
la URL de Redis se resolvía con una cascada en `notify.py` y con el cache de
Django en `state.py`. Centralizar evita que esos defaults diverjan y deja en
un solo archivo la respuesta a "¿qué configura este paquete?".

Todo son funciones, no constantes de módulo: el valor se lee en cada llamada,
así `override_settings` funciona en tests. Con constantes, el valor quedaba
congelado en el momento del import.
"""

from django.conf import settings

_DEFAULT_IDP   = "http://admincentral-backend:8003"
_DEFAULT_REDIS = "redis://localhost:6379/1"

_TTL_ESTADO     = 60 * 60 * 24 * 7   # 7 días — coincide con el refresh_token
_TTL_REVOCACION = 60 * 60 * 24       # 24 h — marca de sesión revocada
_MAX_AGE_COOKIE = 60 * 60 * 24       # 24 h — cubre la ventana de 8 h con margen

# Nombres con los que el IdP puede emitir la app dentro de un token legacy.
# El SSO usa indistintamente guion y guion bajo; ambas variantes son válidas.
_APP_NAMES_LEGACY = frozenset({
    "sistema-tramites", "sistema_tramites",
    "sistema-titulos",  "sistema_titulos",
})


def _s(nombre: str, default=None):
    return getattr(settings, nombre, default)


# ─────────────────────────────────────────────────────────────── IdP

def url_idp() -> str:
    """URL base del IdP admincentral, sin barra final."""
    return str(_s("URL_API_SSO", _DEFAULT_IDP)).rstrip("/")


def api_key() -> str:
    """Header `API-Key` — debe coincidir con VALID_API_KEYS en admincentral."""
    return _s("SSO_API_KEY", "")


def system_key() -> str:
    """Clave de este sistema. `SSO_TRAMITES_SYSTEM_KEY` es un alias histórico."""
    return _s("SSO_SYSTEM_KEY", "") or _s("SSO_TRAMITES_SYSTEM_KEY", "")


def system_slug() -> str:
    """
    Slug de este sistema: nombra la cola AMQP y viaja como `aud` en el JWT.

    Sin default a propósito — un slug inventado es peor que ninguno. Cada
    llamador decide qué hacer con el vacío: `consumer.py` cae a "sistema"
    para nombrar la cola, `tokens.py` omite la validación de audiencia.
    """
    return _s("SSO_SYSTEM_SLUG", "")


def http_timeout() -> int:
    """Timeout de las llamadas al IdP, en segundos."""
    return int(_s("SSO_HTTP_TIMEOUT", 10))


def user_agent() -> str:
    """
    User-Agent identificable: el middleware anti-bots de admincentral responde
    429 al UA por defecto de requests ("python-requests/x.y").

    Se deriva del slug para que cada sistema se anuncie como sí mismo. Antes
    era la constante literal "certificaciones-backend/1.0", así que al copiar
    el paquete los ocho sistemas se identificaban como certificaciones.
    """
    slug = system_slug() or "sistema"
    return _s("SSO_USER_AGENT", f"{slug}-backend/1.0 (sso-client)")


# ─────────────────────────────────────────────────────────────── JWT

def llave_publica_raw() -> str:
    """Valor crudo de JWT_LLAVE_PUBLICA (puede traer '\\n' literales)."""
    return _s("JWT_LLAVE_PUBLICA", "") or ""


def saltar_verificacion_dev() -> bool:
    """
    Bypass de verificación de firma para desarrollo.

    Exige las DOS condiciones: JWT_SKIP_VERIFY_DEV=True *y* DEBUG=True. Nunca
    puede activarse por accidente en producción con DEBUG apagado.
    """
    return bool(_s("JWT_SKIP_VERIFY_DEV", False)) and bool(_s("DEBUG", False))


def nombres_app_legacy() -> frozenset:
    """Nombres de app aceptados al leer permisos de un token legacy."""
    return frozenset(_s("SSO_APP_NAMES_LEGACY", _APP_NAMES_LEGACY))


# ─────────────────────────────────────────────────────────────── Cookies

def cookie_secure() -> bool:
    """
    Flag `Secure` de las cookies de sesión.

    ⚠ Las guías de integración documentan una variable `USE_HTTPS` en el .env,
    pero el paquete NO la lee: lee este setting. Si tu proyecto usa USE_HTTPS,
    hay que cablearla explícitamente en settings.py:

        SSO_COOKIE_SECURE = os.getenv("USE_HTTPS", "False") == "True"

    Sin esa línea, poner USE_HTTPS=False no tiene ningún efecto: las cookies
    salen con Secure=True (el default de acá) y sobre HTTP el navegador las
    descarta en silencio. Es la causa del clásico "Sesión Inválida".
    """
    return bool(_s("SSO_COOKIE_SECURE", True))


def cookie_samesite() -> str:
    return _s("SSO_COOKIE_SAMESITE", "Lax")


def cookie_httponly() -> bool:
    """
    `HttpOnly` del access token. Default False — comportamiento histórico:
    el frontend React lee el JWT desde document.cookie.

    ⚠ Con False, cualquier XSS puede robar el token de sesión. Si tu frontend
    no necesita leerlo (por ejemplo, obtiene los datos del usuario por GraphQL),
    poné SSO_COOKIE_HTTPONLY = True y ganás esa mitigación sin tocar el paquete.
    El refresh token va HttpOnly siempre, sin importar este setting.
    """
    return bool(_s("SSO_COOKIE_HTTPONLY", False))


def cookie_max_age() -> int:
    return int(_s("SSO_COOKIE_MAX_AGE", _MAX_AGE_COOKIE))


# ─────────────────────────────────────────────────────── Redis y AMQP

def redis_url() -> str:
    """
    URL de Redis para pub/sub (notify y el stream SSE).

    Ojo: `state.py` NO usa esto — usa el cache de Django (CACHES['default']).
    Ambas rutas tienen que apuntar al mismo Redis. Las guías de integración
    cablean las dos desde REDIS_CACHE_URL, por eso en la práctica coinciden;
    esta cascada existe para que sigan coincidiendo si se define solo una.
    """
    for nombre in ("SSO_REDIS_URL", "REDIS_CACHE_URL"):
        url = _s(nombre)
        if url:
            return url
    try:
        return settings.CACHES["default"]["LOCATION"]
    except (AttributeError, KeyError, TypeError):
        return _DEFAULT_REDIS


def amqp_url() -> str:
    """URL de RabbitMQ del IdP. Vacía → el consumer queda inactivo."""
    return _s("SSO_AMQP_URL", "")


def ttl_estado() -> int:
    """TTL en segundos de las claves pv/dv/perms en Redis local."""
    return int(_s("SSO_ESTADO_TTL", _TTL_ESTADO))


def ttl_revocacion() -> int:
    """
    TTL en segundos de la marca de sesión revocada.

    Solo es una red de seguridad: la marca se borra en cuanto el usuario
    vuelve a entrar legítimamente (`seed_from_jwt`). El TTL cubre el caso de
    que nunca vuelva, para que la clave no quede en Redis para siempre.
    Debe superar cómodamente la vida del refresh token.
    """
    return int(_s("SSO_TTL_REVOCACION", _TTL_REVOCACION))
