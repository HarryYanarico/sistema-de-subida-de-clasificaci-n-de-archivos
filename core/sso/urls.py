"""
Rutas del cliente SSO.

Traen el prefijo `api/sso/` incorporado. Montarlas SIN prefijo adicional:

    from core.sso.urls import urlpatterns as sso_urlpatterns
    urlpatterns = [...] + sso_urlpatterns

Usar `path("sso/", include("core.sso.urls"))` produce `/sso/api/sso/callback`
y el callback deja de coincidir con el registrado en admincentral.
"""

from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .views import SSOCallbackView, SSOEventsView, SSORefreshSessionView

urlpatterns = [
    path("api/sso/callback",        SSOCallbackView.as_view(),                     name="sso-callback"),
    path("api/sso/refresh-session", csrf_exempt(SSORefreshSessionView.as_view()),  name="sso-refresh-session"),
    path("api/sso/events",          SSOEventsView.as_view(),                       name="sso-events"),
]
