# ============================================================
# QueueGOO - database.py
# Cliente Supabase usado pelo backend.
# ============================================================
from fastapi import HTTPException, status
from sqlalchemy.orm import declarative_base
from supabase import Client, create_client

from config import SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


# Mantido temporariamente para os models SQLAlchemy existentes importarem Base
# enquanto a migracao para Supabase Client avanca por rota.
Base = declarative_base()

supabase_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
supabase: Client = create_client(SUPABASE_URL, supabase_key)


def get_supabase() -> Client:
    return supabase


def get_db():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Esta rota ainda usa SQLAlchemy. Migre-a para o Supabase Client "
            "ou use uma rota ja refatorada."
        ),
    )


def testar_conexao():
    try:
        supabase.table("usuario").select("id").limit(1).execute()
        print("Supabase conectado com sucesso.")
    except Exception as e:
        raise ConnectionError(f"Falha ao conectar no Supabase: {e}")
