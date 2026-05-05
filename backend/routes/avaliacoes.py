from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator

from database import get_db
from services.firebase_service import verificar_token, get_uid
from models.usuario import Usuario
from models.restaurante import Restaurante
from models.avaliacao import Avaliacao
from models.reserva import Reserva

router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class AvaliacaoInput(BaseModel):
    restaurante_id: str
    nota:           int
    comentario:     str | None = None
    reserva_id:     str | None = None   # opcional — vincula à reserva se informado

    @field_validator("nota")
    @classmethod
    def nota_valida(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Nota deve ser entre 1 e 5.")
        return v


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/")
def criar_avaliacao(
    dados: AvaliacaoInput,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Usuário avalia um restaurante após a visita.
    Regras:
    - Nota entre 1 e 5
    - Uma avaliação por restaurante por reserva (unique no banco)
    - Se reserva_id for informado, verifica se a reserva é do usuário
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)

    restaurante = db.query(Restaurante).filter_by(id=dados.restaurante_id, ativo=True).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante não encontrado.")

    # Se vinculado a uma reserva, valida que é do próprio usuário e está concluída
    if dados.reserva_id:
        reserva = db.query(Reserva).filter_by(
            id=dados.reserva_id,
            usuario_id=str(usuario.id),
        ).first()

        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva não encontrada.")

        if reserva.status != "concluida":
            raise HTTPException(
                status_code=400,
                detail="Só é possível avaliar após a reserva ser concluída.",
            )

    # Verifica duplicidade
    ja_avaliou = db.query(Avaliacao).filter_by(
        usuario_id=str(usuario.id),
        restaurante_id=dados.restaurante_id,
        reserva_id=dados.reserva_id,
    ).first()

    if ja_avaliou:
        raise HTTPException(status_code=409, detail="Você já avaliou este restaurante para esta visita.")

    avaliacao = Avaliacao(
        usuario_id=str(usuario.id),
        restaurante_id=dados.restaurante_id,
        reserva_id=dados.reserva_id,
        nota=dados.nota,
        comentario=dados.comentario,
        moderado=False,
    )
    db.add(avaliacao)
    db.commit()
    db.refresh(avaliacao)

    return _serializar(avaliacao)


@router.get("/restaurante/{restaurante_id}")
def listar_avaliacoes_restaurante(
    restaurante_id: str,
    pagina:  int = Query(1, ge=1),
    limite:  int = Query(20, le=50),
    _        = Depends(verificar_token),
    db: Session = Depends(get_db),
):
    """
    Lista as avaliações aprovadas de um restaurante com paginação.
    Retorna também a média e o total.
    """
    restaurante = db.query(Restaurante).filter_by(id=restaurante_id).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante não encontrado.")

    query = db.query(Avaliacao).filter_by(
        restaurante_id=restaurante_id,
        moderado=False,
    ).order_by(Avaliacao.criado_em.desc())

    total     = query.count()
    avaliacoes = query.offset((pagina - 1) * limite).limit(limite).all()

    # Média calculada no Python (evita query extra)
    todas_notas = db.query(Avaliacao.nota).filter_by(
        restaurante_id=restaurante_id, moderado=False
    ).all()
    media = round(sum(n[0] for n in todas_notas) / len(todas_notas), 1) if todas_notas else 0

    return {
        "media":   media,
        "total":   total,
        "pagina":  pagina,
        "dados":   [_serializar(a) for a in avaliacoes],
    }


@router.get("/minhas")
def minhas_avaliacoes(
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """Lista todas as avaliações feitas pelo usuário logado."""
    usuario    = _buscar_usuario(get_uid(usuario_firebase), db)
    avaliacoes = db.query(Avaliacao).filter_by(
        usuario_id=str(usuario.id)
    ).order_by(Avaliacao.criado_em.desc()).all()

    return [_serializar(a) for a in avaliacoes]


@router.delete("/{avaliacao_id}")
def deletar_avaliacao(
    avaliacao_id:    str,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Remove uma avaliação do usuário logado.
    Usuário só pode deletar as próprias avaliações.
    """
    usuario   = _buscar_usuario(get_uid(usuario_firebase), db)
    avaliacao = db.query(Avaliacao).filter_by(
        id=avaliacao_id, usuario_id=str(usuario.id)
    ).first()

    if not avaliacao:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada.")

    db.delete(avaliacao)
    db.commit()

    return {"mensagem": "Avaliação removida com sucesso."}


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


def _serializar(avaliacao: Avaliacao) -> dict:
    cache = avaliacao.restaurante.cache if avaliacao.restaurante else None
    return {
        "id":               str(avaliacao.id),
        "nota":             avaliacao.nota,
        "comentario":       avaliacao.comentario,
        "moderado":         avaliacao.moderado,
        "criado_em":        avaliacao.criado_em.isoformat() if avaliacao.criado_em else None,
        "reserva_id":       str(avaliacao.reserva_id) if avaliacao.reserva_id else None,
        # Dados do restaurante
        "restaurante_id":   str(avaliacao.restaurante_id),
        "restaurante_nome": cache.nome if cache else None,
        "restaurante_foto": cache.foto_url if cache else None,
        # Dados do usuário
        "usuario_id":       str(avaliacao.usuario_id),
        "usuario_nome":     avaliacao.usuario.nome if avaliacao.usuario else None,
        "usuario_foto":     avaliacao.usuario.foto_url if avaliacao.usuario else None,
    }