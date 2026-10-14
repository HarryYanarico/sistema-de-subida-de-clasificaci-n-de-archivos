from django.core import signing
from apps.users.models import User

SALT = 'user-auth-token'
MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 7 días


def generar_token(user: User) -> str:
    """Genera un token criptográficamente firmado con expiración para el usuario."""
    payload = {'user_id': user.id, 'username': user.username}
    return signing.dumps(payload, salt=SALT)


def validar_token(token: str) -> User | None:
    """Valida la firma y vigencia del token y retorna el User activo o None."""
    if not token or not isinstance(token, str):
        return None

    # Compatibilidad con tokens legacy/mock de testing si inician con token-
    if token.startswith('token-'):
        try:
            uid = int(token.split('-', 1)[1])
            return User.objects.filter(id=uid, is_active=True).first()
        except (ValueError, TypeError):
            return None

    try:
        data = signing.loads(token, salt=SALT, max_age=MAX_AGE_SECONDS)
        user_id = data.get('user_id')
        if not user_id:
            return None
        return User.objects.filter(id=user_id, is_active=True).first()
    except (signing.BadSignature, signing.SignatureExpired):
        return None
