from fastapi import APIRouter, Depends, HTTPException, status
from uuid import uuid4

from database import get_supabase
from services.firebase_service import verificar_token, get_uid, get_email, get_nome, get_foto

router = APIRouter()


@router.post("/primeiro-acesso")
def primeiro_acesso(usuario_firebase=Depends(verificar_token)):
    """
    Chamado pelo app logo apos o login.
    Cria o usuario no Supabase caso ainda nao exista.
    """
    uid = get_uid(usuario_firebase)
    usuario = _buscar_usuario_por_uid(uid)

    if usuario:
        return _serializar(usuario)

    novo_usuario = {
        "id": str(uuid4()),
        "firebase_uid": uid,
        "email": get_email(usuario_firebase) or "",
        "nome": get_nome(usuario_firebase) or "Usuario QueueGOO",
        "foto_url": get_foto(usuario_firebase),
        "ativo": True,
        "conformidade_lgpd": False,
    }

    try:
        response = (
            get_supabase()
            .table("usuario")
            .upsert(novo_usuario, on_conflict="firebase_uid")
            .execute()
        )
    except Exception as e:
        detalhe = str(e)
        if "row-level security" in detalhe.lower():
            detalhe = (
                "A tabela usuario esta bloqueando inserts por Row Level Security. "
                "Configure SUPABASE_SERVICE_ROLE_KEY no backend/.env com a service_role key "
                "do Supabase, ou crie uma policy de insert segura para essa tabela."
            )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao criar usuario no Supabase: {detalhe}",
        )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase nao retornou o usuario criado.",
        )

    return _serializar(response.data[0])


@router.get("/perfil")
def get_perfil(usuario_firebase=Depends(verificar_token)):
    usuario = _buscar_usuario_obrigatorio(get_uid(usuario_firebase))
    return _serializar(usuario)


@router.put("/perfil")
def atualizar_perfil(
    dados: dict,
    usuario_firebase=Depends(verificar_token),
):
    uid = get_uid(usuario_firebase)
    _buscar_usuario_obrigatorio(uid)

    campos_permitidos = {"nome", "telefone", "tipo_comida_favorito", "conformidade_lgpd"}
    dados_filtrados = {
        campo: valor
        for campo, valor in dados.items()
        if campo in campos_permitidos
    }

    if not dados_filtrados:
        return _serializar(_buscar_usuario_obrigatorio(uid))

    try:
        response = (
            get_supabase()
            .table("usuario")
            .update(dados_filtrados)
            .eq("firebase_uid", uid)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao atualizar usuario no Supabase: {e}",
        )

    if not response.data:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    return _serializar(response.data[0])


def _buscar_usuario_por_uid(uid: str) -> dict | None:
    try:
        response = (
            get_supabase()
            .table("usuario")
            .select("*")
            .eq("firebase_uid", uid)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao buscar usuario no Supabase: {e}",
        )

    return response.data[0] if response.data else None


def _buscar_usuario_obrigatorio(uid: str) -> dict:
    usuario = _buscar_usuario_por_uid(uid)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario nao encontrado. Chame /auth/primeiro-acesso antes.",
        )
    return usuario


def _serializar(usuario: dict) -> dict:
    return {
        "id": usuario.get("id"),
        "firebase_uid": usuario.get("firebase_uid"),
        "nome": usuario.get("nome"),
        "email": usuario.get("email"),
        "telefone": usuario.get("telefone"),
        "foto_url": usuario.get("foto_url"),
        "tipo_comida_favorito": usuario.get("tipo_comida_favorito"),
        "conformidade_lgpd": usuario.get("conformidade_lgpd", False),
        "criado_em": usuario.get("criado_em"),
    }
