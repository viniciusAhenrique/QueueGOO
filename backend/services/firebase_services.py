from firebase_admin import auth
from fastapi import Header, HTTPException, status


# ============================================================
# VERIFICAÇÃO DE TOKEN
# ============================================================

def verificar_token(authorization: str = Header(...)) -> dict:
    """
    Dependency do FastAPI — valida o token JWT enviado pelo app.

    O app React Native obtém o token assim:
        const token = await getAuth().currentUser.getIdToken()

    E envia em toda requisição autenticada:
        Authorization: Bearer <token>

    Retorna o payload decodificado com uid, email, etc.
    Lança HTTPException 401 se o token for inválido ou expirado.

    Uso nas rotas:
        @router.get("/perfil")
        def get_perfil(usuario = Depends(verificar_token)):
            uid = usuario["uid"]
            ...
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato inválido. Use: Authorization: Bearer <token>",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = auth.verify_id_token(token)
        return payload

    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Faça login novamente.",
        )

    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente.",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Erro na autenticação: {str(e)}",
        )


# ============================================================
# HELPERS
# ============================================================

def get_uid(usuario: dict) -> str:
    """Extrai o firebase_uid do payload decodificado."""
    return usuario["uid"]


def get_email(usuario: dict) -> str | None:
    """Extrai o email do payload. Pode ser None em logins sociais sem email."""
    return usuario.get("email")


def get_nome(usuario: dict) -> str | None:
    """
    Extrai o nome do payload.
    Disponível quando o usuário fez login com Google/Apple.
    Pode ser None em login com email/senha sem perfil configurado.
    """
    return usuario.get("name")


def get_foto(usuario: dict) -> str | None:
    """Extrai a foto de perfil do payload (login social)."""
    return usuario.get("picture")


def usuario_e_admin(usuario: dict) -> bool:
    """
    Verifica se o usuário tem claim customizada de admin.
    Para setar a claim no Firebase:
        auth.set_custom_user_claims(uid, {"admin": True})
    """
    claims = usuario.get("admin", False)
    return bool(claims)