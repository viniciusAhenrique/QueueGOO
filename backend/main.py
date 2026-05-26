from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from pathlib import Path

from database import testar_conexao
import firebase_admin
from firebase_admin import credentials

from config import (
    ALLOWED_ORIGINS,
    EM_PRODUCAO,
    FIREBASE_SERVICE_ACCOUNT_JSON,
    FIREBASE_SERVICE_ACCOUNT_PATH,
)
from routes import auth, restaurantes, lotacao, uploads, diagnostico

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="QueueGOO API",
    version="1.0.0",
)

origens_cors = ALLOWED_ORIGINS if ALLOWED_ORIGINS else ([] if EM_PRODUCAO else ["*"])

# CORS — em producao, configure ALLOWED_ORIGINS com os dominios do app web.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Firebase Admin SDK — para validar tokens JWT do app
def inicializar_firebase():
    if firebase_admin._apps:
        return

    service_account_path = Path(FIREBASE_SERVICE_ACCOUNT_PATH) if FIREBASE_SERVICE_ACCOUNT_PATH else None
    if service_account_path and not service_account_path.is_absolute():
        service_account_path = BASE_DIR / service_account_path

    if FIREBASE_SERVICE_ACCOUNT_JSON:
        cred = credentials.Certificate(_carregar_service_account_json(FIREBASE_SERVICE_ACCOUNT_JSON))
    elif service_account_path and service_account_path.exists():
        cred = credentials.Certificate(str(service_account_path))
    elif not EM_PRODUCAO and (BASE_DIR / "serviceAccountKey.json").exists():
        cred = credentials.Certificate(str(BASE_DIR / "serviceAccountKey.json"))
    else:
        raise RuntimeError(
            "Credenciais do Firebase Admin nao encontradas. Defina "
            "FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_SERVICE_ACCOUNT_PATH."
        )

    firebase_admin.initialize_app(cred)


def _carregar_service_account_json(raw_json: str) -> dict:
    service_account_json = raw_json.strip()
    if (
        len(service_account_json) >= 2
        and service_account_json[0] == service_account_json[-1]
        and service_account_json[0] in {"'", '"'}
    ):
        service_account_json = service_account_json[1:-1].strip()

    try:
        return json.loads(service_account_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON invalido. No Render, cole o JSON puro "
            "sem aspas simples envolvendo todo o valor."
        ) from exc


inicializar_firebase()

# ============================================================
# ROTAS
# Cada arquivo em routes/ é responsável por um domínio
# A lógica de negócio fica nos services/, nunca aqui
# ============================================================
app.include_router(auth.router,         prefix="/auth",        tags=["Auth"])
app.include_router(restaurantes.router, prefix="/restaurantes", tags=["Restaurantes"])
app.include_router(lotacao.router,      prefix="/lotacao",      tags=["Lotação"])
app.include_router(uploads.router,      prefix="/uploads",      tags=["Uploads"])
app.include_router(diagnostico.router,  prefix="/diagnostico",  tags=["Diagnostico"])

# ============================================================
# EVENTOS
# ============================================================
@app.on_event("startup")
async def startup():
    testar_conexao()  # confirma conexão com Supabase ao subir

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "QueueGOO API"}
