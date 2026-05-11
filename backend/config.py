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
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "queuegoo-media")

# Google
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_PLACES_FALLBACK_ENABLED = os.getenv("GOOGLE_PLACES_FALLBACK_ENABLED", "false").lower() == "true"
GOOGLE_PLACES_REFRESH_MIN_RESULTS = int(os.getenv("GOOGLE_PLACES_REFRESH_MIN_RESULTS", "6"))
GOOGLE_PLACES_REFRESH_TTL_MINUTES = int(os.getenv("GOOGLE_PLACES_REFRESH_TTL_MINUTES", "120"))
POPULARTIMES_FALLBACK_ENABLED = os.getenv("POPULARTIMES_FALLBACK_ENABLED", "false").lower() == "true"

# Places alternativos
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
GEOAPIFY_ON_DEMAND_ENABLED = os.getenv("GEOAPIFY_ON_DEMAND_ENABLED", "true").lower() == "true"
GEOAPIFY_REFRESH_MIN_RESULTS = int(os.getenv("GEOAPIFY_REFRESH_MIN_RESULTS", "18"))
GEOAPIFY_REFRESH_LIMIT = int(os.getenv("GEOAPIFY_REFRESH_LIMIT", "100"))
NOMINATIM_USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "QueueGOO/1.0 contato@queuegoo.local")
TRIPADVISOR_API_KEY = os.getenv("TRIPADVISOR_API_KEY")
TRIPADVISOR_ENRICHMENT_ENABLED = os.getenv("TRIPADVISOR_ENRICHMENT_ENABLED", "false").lower() == "true"

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
    "FIREBASE_PROJECT_ID":  FIREBASE_PROJECT_ID,
}

if GOOGLE_PLACES_FALLBACK_ENABLED:
    OBRIGATORIAS["GOOGLE_API_KEY"] = GOOGLE_API_KEY

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
