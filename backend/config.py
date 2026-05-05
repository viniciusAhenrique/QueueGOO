# ============================================================
# QueueGOO — config.py
# Porta de entrada única para todas as configurações.
# Nenhum outro arquivo usa os.getenv() diretamente.
# ============================================================
import os
from pathlib import Path
from dotenv import load_dotenv

# Etapa 1: carrega o .env se existir (desenvolvimento)
# Em produção, as variáveis já estão no ambiente do servidor
load_dotenv(Path(__file__).resolve().parent / ".env")

# ============================================================
# VARIÁVEIS
# ============================================================

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# Google
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Firebase
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

# App
APP_ENV = os.getenv("APP_ENV", "development")
DEBUG   = os.getenv("DEBUG", "false").lower() == "true"
PORT    = int(os.getenv("PORT", "8000"))
ALLOWED_ORIGINS = [
    origem.strip()
    for origem in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origem.strip()
]

# ============================================================
# VALIDAÇÃO — falha imediatamente se faltar algo crítico
# ============================================================
OBRIGATORIAS = {
    "SUPABASE_URL":         SUPABASE_URL,
    "SUPABASE_KEY":         SUPABASE_KEY,
    "GOOGLE_API_KEY":       GOOGLE_API_KEY,
    "FIREBASE_PROJECT_ID":  FIREBASE_PROJECT_ID,
}

faltando = [nome for nome, valor in OBRIGATORIAS.items() if not valor]

if faltando:
    raise EnvironmentError(
        f"\n❌ Variáveis de ambiente obrigatórias não definidas: {faltando}"
        f"\n👉 Copie .env.example para .env e preencha os valores."
    )

# ============================================================
# DERIVADAS
# ============================================================
EM_PRODUCAO     = APP_ENV == "production"
EM_DEVELOPMENT  = APP_ENV == "development"
