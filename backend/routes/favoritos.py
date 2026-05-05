from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from services.firebase_service import verificar_token, get_uid
from models.usuario import Usuario
from models.restaurante import Restaurante
from models.favorito import Favorito

router = APIRouter()


@router.get("/")
def listar_favoritos(
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Retorna todos os restaurantes favoritados pelo usuário logado.
    Inclui os dados do Google Places via cache.
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)

    favoritos = (
        db.query(Favorito)
        .filter_by(usuario_id=usuario.id)
        .order_by(Favorito.adicionado_em.desc())
        .all()
    )

    return [_serializar_favorito(f) for f in favoritos]


@router.post("/{restaurante_id}")
def adicionar_favorito(
    restaurante_id:  str,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Adiciona um restaurante aos favoritos do usuário.
    Retorna 409 se já estiver favoritado.
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)

    restaurante = db.query(Restaurante).filter_by(id=restaurante_id, ativo=True).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante não encontrado.")

    # Verifica se já está favoritado
    ja_existe = db.query(Favorito).filter_by(
        usuario_id=usuario.id,
        restaurante_id=restaurante_id,
    ).first()

    if ja_existe:
        raise HTTPException(status_code=409, detail="Restaurante já está nos favoritos.")

    favorito = Favorito(usuario_id=usuario.id, restaurante_id=restaurante.id)
    db.add(favorito)
    db.commit()
    db.refresh(favorito)

    return {"mensagem": "Adicionado aos favoritos.", "id": str(favorito.id)}


@router.delete("/{restaurante_id}")
def remover_favorito(
    restaurante_id:  str,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Remove um restaurante dos favoritos do usuário.
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)

    favorito = db.query(Favorito).filter_by(
        usuario_id=usuario.id,
        restaurante_id=restaurante_id,
    ).first()

    if not favorito:
        raise HTTPException(status_code=404, detail="Favorito não encontrado.")

    db.delete(favorito)
    db.commit()

    return {"mensagem": "Removido dos favoritos."}


@router.get("/verificar/{restaurante_id}")
def verificar_favorito(
    restaurante_id:  str,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Verifica se um restaurante está nos favoritos do usuário.
    Útil para o app saber se deve mostrar o coração cheio ou vazio.
    """
    usuario  = _buscar_usuario(get_uid(usuario_firebase), db)
    favorito = db.query(Favorito).filter_by(
        usuario_id=usuario.id,
        restaurante_id=restaurante_id,
    ).first()

    return {"favoritado": favorito is not None}


# ============================================================
# HELPERS INTERNOS
# ============================================================

def _buscar_usuario(uid: str, db: Session) -> Usuario:
    usuario = db.query(Usuario).filter_by(firebase_uid=uid).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado. Chame /auth/primeiro-acesso antes.",
        )
    return usuario


def _serializar_favorito(favorito: Favorito) -> dict:
    restaurante = favorito.restaurante
    cache       = restaurante.cache if restaurante else None

    return {
        "favorito_id":      str(favorito.id),
        "adicionado_em":    favorito.adicionado_em.isoformat(),
        "restaurante_id":   str(restaurante.id) if restaurante else None,
        "google_place_id":  restaurante.google_place_id if restaurante else None,
        "aceita_reservas":  restaurante.aceita_reservas if restaurante else None,
        # Dados do Google Places (via cache)
        "nome":             cache.nome if cache else None,
        "endereco":         cache.endereco if cache else None,
        "foto_url":         cache.foto_url if cache else None,
        "categoria":        cache.categoria_culinaria if cache else None,
        "nota_google":      float(cache.nota_google) if cache and cache.nota_google else None,
    }