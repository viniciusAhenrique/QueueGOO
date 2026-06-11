from html import escape

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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


@app.get("/evento", response_class=HTMLResponse, tags=["Eventos"])
def convite_evento(eventId: str = ""):
    event_id = escape(eventId.strip())
    app_scheme = os.getenv("PUBLIC_APP_SCHEME", "queuegoo").strip() or "queuegoo"
    app_download_url = os.getenv(
        "PUBLIC_APP_DOWNLOAD_URL",
        "https://expo.dev/accounts/guripitcka/projects/QueueGo/builds",
    ).strip()
    app_link = f"{app_scheme}://screens/evento?eventId={event_id}" if event_id else f"{app_scheme}://"

    return f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Convite QueueGOO</title>
    <style>
      body {{
        margin: 0;
        font-family: Arial, sans-serif;
        background: #e3f2fd;
        color: #1e232c;
      }}
      main {{
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }}
      section {{
        width: 100%;
        max-width: 440px;
        background: #ffffff;
        border: 1px solid #b3e5fc;
        border-radius: 12px;
        padding: 22px;
        box-shadow: 0 14px 30px rgba(13, 71, 161, 0.16);
      }}
      h1 {{
        margin: 0 0 8px;
        font-size: 24px;
        color: #0d47a1;
      }}
      p {{
        margin: 8px 0;
        line-height: 1.45;
      }}
      .code {{
        margin: 14px 0;
        padding: 10px;
        border-radius: 8px;
        background: #f8fcff;
        border: 1px solid #b3e5fc;
        word-break: break-all;
        font-size: 13px;
      }}
      a {{
        display: block;
        margin-top: 10px;
        padding: 13px 14px;
        border-radius: 8px;
        text-align: center;
        text-decoration: none;
        font-weight: 700;
      }}
      .primary {{
        background: #0d47a1;
        color: #ffffff;
      }}
      .secondary {{
        background: #e3f2fd;
        color: #0d47a1;
      }}
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Convite QueueGOO</h1>
        <p>Voce recebeu um convite para um evento no QueueGOO.</p>
        <p>Abra o app para confirmar presenca e acompanhar a conversa.</p>
        {f'<div class="code">Codigo do evento: {event_id}</div>' if event_id else ''}
        <a class="primary" href="{app_link}">Abrir no app</a>
        <a class="secondary" href="{escape(app_download_url)}">Baixar ou testar o app</a>
      </section>
    </main>
  </body>
</html>"""
