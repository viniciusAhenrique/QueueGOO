from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, time

from database import get_db
from services.firebase_service import verificar_token, get_uid
from models.usuario import Usuario
from models.restaurante import Restaurante
from models.reserva import Reserva
from models.historico import HistoricoVisita

router = APIRouter()


# ============================================================
# SCHEMAS — validação de entrada com Pydantic
# ============================================================

class ReservaInput(BaseModel):
    restaurante_id:  str
    data_reserva:    date
    horario_reserva: time
    num_pessoas:     int
    observacoes:     str | None = None


class AtualizarStatusInput(BaseModel):
    status: str  # confirmada | cancelada | concluida | no_show


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/")
def criar_reserva(
    dados: ReservaInput,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Cria uma reserva para o usuário logado.
    O código de confirmação é gerado automaticamente pelo trigger do banco.
    Status inicial: pendente (aguarda confirmação do restaurante).
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)

    restaurante = db.query(Restaurante).filter_by(
        id=dados.restaurante_id, ativo=True
    ).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante não encontrado.")

    if not restaurante.aceita_reservas:
        raise HTTPException(status_code=400, detail="Este restaurante não aceita reservas.")

    if dados.num_pessoas < 1:
        raise HTTPException(status_code=400, detail="Número de pessoas deve ser ao menos 1.")

    # Verifica se o usuário já tem reserva ativa neste restaurante nesta data
    reserva_existente = db.query(Reserva).filter_by(
        usuario_id=usuario.id,
        restaurante_id=dados.restaurante_id,
        data_reserva=dados.data_reserva,
    ).filter(Reserva.status.in_(["pendente", "confirmada"])).first()

    if reserva_existente:
        raise HTTPException(
            status_code=409,
            detail="Você já tem uma reserva ativa neste restaurante para esta data.",
        )

    reserva = Reserva(
        usuario_id=str(usuario.id),
        restaurante_id=dados.restaurante_id,
        data_reserva=dados.data_reserva,
        horario_reserva=dados.horario_reserva,
        num_pessoas=dados.num_pessoas,
        observacoes=dados.observacoes,
        status="pendente",
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)

    return _serializar(reserva)


@router.get("/minhas")
def listar_minhas_reservas(
    status_filtro:   str = Query(None, description="pendente | confirmada | cancelada | concluida | no_show"),
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Lista todas as reservas do usuário logado.
    Filtra por status se informado.
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)

    query = db.query(Reserva).filter_by(usuario_id=usuario.id)

    if status_filtro:
        query = query.filter(Reserva.status == status_filtro)

    reservas = query.order_by(Reserva.data_reserva.desc()).all()
    return [_serializar(r) for r in reservas]


@router.get("/{reserva_id}")
def get_reserva(
    reserva_id:      str,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """Retorna detalhes de uma reserva específica do usuário."""
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)
    reserva = _buscar_reserva_do_usuario(reserva_id, str(usuario.id), db)
    return _serializar(reserva)


@router.patch("/{reserva_id}/cancelar")
def cancelar_reserva(
    reserva_id:      str,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Usuário cancela a própria reserva.
    Só é possível cancelar reservas com status pendente ou confirmada.
    """
    usuario = _buscar_usuario(get_uid(usuario_firebase), db)
    reserva = _buscar_reserva_do_usuario(reserva_id, str(usuario.id), db)

    if reserva.status not in ("pendente", "confirmada"):
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível cancelar uma reserva com status '{reserva.status}'.",
        )

    reserva.status = "cancelada"
    db.commit()
    db.refresh(reserva)

    return {"mensagem": "Reserva cancelada com sucesso.", **_serializar(reserva)}


@router.patch("/{reserva_id}/status")
def atualizar_status(
    reserva_id: str,
    dados: AtualizarStatusInput,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Atualiza o status de uma reserva.
    Usado pelo proprietário do restaurante para confirmar, concluir ou marcar no-show.
    Status válidos: confirmada | cancelada | concluida | no_show
    """
    STATUS_VALIDOS = {"confirmada", "cancelada", "concluida", "no_show"}

    if dados.status not in STATUS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Status inválido. Use: {STATUS_VALIDOS}",
        )

    reserva = db.query(Reserva).filter_by(id=reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    reserva.status = dados.status
    db.commit()

    # Se concluída, registra no histórico de visitas do usuário
    if dados.status == "concluida":
        _registrar_visita(reserva, db)

    db.refresh(reserva)
    return _serializar(reserva)


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


def _buscar_reserva_do_usuario(reserva_id: str, usuario_id: str, db: Session) -> Reserva:
    reserva = db.query(Reserva).filter_by(id=reserva_id, usuario_id=usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")
    return reserva


def _registrar_visita(reserva: Reserva, db: Session):
    """Cria um registro no histórico de visitas quando a reserva é concluída."""
    visita = HistoricoVisita(
        usuario_id=str(reserva.usuario_id),
        restaurante_id=str(reserva.restaurante_id),
        data_visita=reserva.data_reserva,
        origem="reserva",
    )
    db.add(visita)
    db.commit()


def _serializar(reserva: Reserva) -> dict:
    cache = reserva.restaurante.cache if reserva.restaurante else None
    return {
        "id":                  str(reserva.id),
        "status":              reserva.status,
        "codigo_confirmacao":  reserva.codigo_confirmacao,
        "data_reserva":        str(reserva.data_reserva),
        "horario_reserva":     str(reserva.horario_reserva),
        "num_pessoas":         reserva.num_pessoas,
        "observacoes":         reserva.observacoes,
        "criado_em":           reserva.criado_em.isoformat() if reserva.criado_em else None,
        # Dados do restaurante via cache Google
        "restaurante_id":      str(reserva.restaurante_id),
        "restaurante_nome":    cache.nome if cache else None,
        "restaurante_endereco": cache.endereco if cache else None,
        "restaurante_foto":    cache.foto_url if cache else None,
    }