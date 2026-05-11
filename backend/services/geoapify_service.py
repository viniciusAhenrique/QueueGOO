import httpx

from config import GEOAPIFY_API_KEY
from database import get_supabase


GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
GEOAPIFY_DETAILS_URL = "https://api.geoapify.com/v2/place-details"

DEFAULT_CATEGORIES = ",".join(
    [
        "catering",
    ]
)

MARKET_CATEGORIES = ",".join(
    [
        "commercial.supermarket",
        "commercial.food_and_drink",
    ]
)


async def buscar_e_salvar_proximos(
    lat: float,
    lng: float,
    raio_metros: int = 1500,
    tipo_culinaria: str | None = None,
    limit: int = 80,
    categories: str = DEFAULT_CATEGORIES,
) -> list[dict]:
    rows = await buscar_proximos(
        lat,
        lng,
        raio_metros,
        tipo_culinaria,
        limit,
        _categories_para_filtro(tipo_culinaria, categories),
    )
    if rows:
        _salvar_catalogo(rows)
    return rows


async def buscar_proximos(
    lat: float,
    lng: float,
    raio_metros: int = 1500,
    tipo_culinaria: str | None = None,
    limit: int = 80,
    categories: str = DEFAULT_CATEGORIES,
) -> list[dict]:
    if not GEOAPIFY_API_KEY:
        return []

    params = {
        "categories": categories,
        "filter": f"circle:{lng},{lat},{raio_metros}",
        "bias": f"proximity:{lng},{lat}",
        "limit": min(max(limit, 1), 100),
        "lang": "pt",
        "apiKey": GEOAPIFY_API_KEY,
    }

    if tipo_culinaria and not _filtro_mercado(tipo_culinaria):
        params["name"] = tipo_culinaria

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(GEOAPIFY_PLACES_URL, params=params)
        response.raise_for_status()
        data = response.json()

    rows = [_feature_para_row(feature) for feature in data.get("features", [])]
    return [row for row in rows if row["external_id"] and row["nome"]]


async def buscar_detalhes(place_id: str) -> dict | None:
    if not GEOAPIFY_API_KEY or not place_id:
        return None

    params = {
        "id": place_id,
        "features": "details",
        "lang": "pt",
        "apiKey": GEOAPIFY_API_KEY,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(GEOAPIFY_DETAILS_URL, params=params)
        response.raise_for_status()
        data = response.json()

    for feature in data.get("features", []):
        properties = feature.get("properties") or {}
        if properties.get("feature_type") == "details":
            return _feature_para_detalhes(properties)

    features = data.get("features") or []
    if not features:
        return None
    return _feature_para_detalhes(features[0].get("properties") or {})


def _salvar_catalogo(rows: list[dict]) -> None:
    try:
        resposta = (
            get_supabase()
            .table("place_catalogo")
            .upsert(rows, on_conflict="provider,external_id")
            .execute()
        )
        total = len(resposta.data or rows)
        exemplos = ", ".join(row.get("nome", "sem nome") for row in rows[:5])
        print(f"[place_catalog] geoapify salvou {total} restaurantes: {exemplos}")
    except Exception as exc:
        print(f"[geoapify] erro ao salvar catalogo: {exc}")


def _categories_para_filtro(tipo_culinaria: str | None, categories: str) -> str:
    if _filtro_mercado(tipo_culinaria):
        return MARKET_CATEGORIES
    return categories


def _filtro_mercado(tipo_culinaria: str | None) -> bool:
    termo = (tipo_culinaria or "").strip().lower()
    return termo in {"mercado", "mercados", "supermercado", "supermarket", "grocery", "grocery_or_supermarket"}


def _feature_para_row(feature: dict) -> dict:
    properties = feature.get("properties", {})
    datasource = properties.get("datasource") or {}
    raw = datasource.get("raw") or {}
    categories = properties.get("categories") or []

    return {
        "provider": "geoapify",
        "external_id": properties.get("place_id"),
        "nome": properties.get("name") or properties.get("address_line1"),
        "endereco": properties.get("formatted") or _montar_endereco(properties),
        "latitude": properties.get("lat"),
        "longitude": properties.get("lon"),
        "telefone": raw.get("phone") or raw.get("contact:phone"),
        "site_url": raw.get("website") or raw.get("contact:website"),
        "categoria": categories[0] if categories else None,
        "tipos": categories,
        "foto_url": None,
        "horario_texto": _normalizar_horarios(raw.get("opening_hours")),
        "nota": None,
        "total_avaliacoes": None,
        "ativo": True,
    }


def _feature_para_detalhes(properties: dict) -> dict:
    contact = properties.get("contact") or {}
    raw = (properties.get("datasource") or {}).get("raw") or {}
    wiki = properties.get("wiki_and_media") or {}
    catering = properties.get("catering") or {}

    telefone = (
        contact.get("phone")
        or raw.get("phone")
        or raw.get("contact:phone")
        or _primeiro_valor(contact.get("phone_other"))
    )
    site_url = properties.get("website") or contact.get("website") or raw.get("website")
    foto_url = wiki.get("image")
    horario_texto = _normalizar_horarios(properties.get("opening_hours") or raw.get("opening_hours"))

    extras = {
        "descricao": properties.get("description"),
        "cozinha": catering.get("cuisine"),
        "reserva": catering.get("reservation"),
        "capacidade": catering.get("capacity"),
        "delivery": properties.get("delivery"),
        "takeaway": properties.get("takeaway"),
        "outdoor_seating": properties.get("outdoor_seating"),
        "wheelchair": properties.get("wheelchair"),
        "estacionamento": (
            properties.get("parking")
            or raw.get("parking")
            or raw.get("amenity:parking")
            or raw.get("parking:lane:both")
        ),
        "playground": raw.get("playground") or raw.get("kids_area") or raw.get("leisure"),
        "aceita_cartao": (
            raw.get("payment:credit_cards")
            or raw.get("payment:debit_cards")
            or raw.get("payment:cards")
        ),
    }

    return {
        "telefone": telefone,
        "site_url": site_url,
        "foto_url": foto_url,
        "horario_texto": horario_texto,
        "geoapify_extras": {chave: valor for chave, valor in extras.items() if valor not in (None, "")},
    }


def _montar_endereco(properties: dict) -> str | None:
    partes = [
        properties.get("street"),
        properties.get("housenumber"),
        properties.get("suburb"),
        properties.get("city"),
        properties.get("state"),
    ]
    texto = ", ".join(str(parte) for parte in partes if parte)
    return texto or None


def _normalizar_horarios(opening_hours) -> list[str]:
    if not opening_hours:
        return []
    if isinstance(opening_hours, list):
        return [str(item) for item in opening_hours]
    return [str(opening_hours)]


def _primeiro_valor(valor) -> str | None:
    if isinstance(valor, list) and valor:
        return str(valor[0])
    if valor:
        return str(valor)
    return None
