from apps.users.tokens import validar_token


class BearerAuthMiddleware:
    """Middleware para autenticar peticiones HTTP con cabecera Authorization: Bearer <token>."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION') or getattr(request, 'headers', {}).get('Authorization', '')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            user = validar_token(token)
            if user:
                request.user = user
        return self.get_response(request)
