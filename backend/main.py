from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os

from database import testar_conexao
import firebase_admin
from firebase_admin import credentials

from config import (
    ALLOWED_ORIGINS,
    EM_PRODUCAO,
    FIREBASE_SERVICE_ACCOUNT_JSON,
    FIREBASE_SERVICE_ACCOUNT_PATH,
)
from routes import auth, restaurantes, lotacao

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

    if FIREBASE_SERVICE_ACCOUNT_JSON:
        cred = credentials.Certificate(json.loads(FIREBASE_SERVICE_ACCOUNT_JSON))
    elif FIREBASE_SERVICE_ACCOUNT_PATH and os.path.exists(FIREBASE_SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
    elif not EM_PRODUCAO and os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
    else:
        raise RuntimeError(
            "Credenciais do Firebase Admin nao encontradas. Defina "
            "FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_SERVICE_ACCOUNT_PATH."
        )

    firebase_admin.initialize_app(cred)


inicializar_firebase()

# ============================================================
# ROTAS
# Cada arquivo em routes/ é responsável por um domínio
# A lógica de negócio fica nos services/, nunca aqui
# ============================================================
app.include_router(auth.router,         prefix="/auth",        tags=["Auth"])
app.include_router(restaurantes.router, prefix="/restaurantes", tags=["Restaurantes"])
app.include_router(lotacao.router,      prefix="/lotacao",      tags=["Lotação"])

# ============================================================
# EVENTOS
# ============================================================
@app.on_event("startup")
async def startup():
    testar_conexao()  # confirma conexão com Supabase ao subir

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "QueueGOO API"}
