import httpx

from config import GEOAPIFY_API_KEY
from database import get_supabase


GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"

DEFAULT_CATEGORIES = ",".join(
    [
        "catering.restaurant",
        "catering.fast_food",
        "catering.cafe",
        "catering.bar",
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
    rows = await buscar_proximos(lat, lng, raio_metros, tipo_culinaria, limit, categories)
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

    if tipo_culinaria:
        params["name"] = tipo_culinaria

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(GEOAPIFY_PLACES_URL, params=params)
        response.raise_for_status()
        data = response.json()

    rows = [_feature_para_row(feature) for feature in data.get("features", [])]
    return [row for row in rows if row["external_id"] and row["nome"]]


def _salvar_catalogo(rows: list[dict]) -> None:
    try:
        (
            get_supabase()
            .table("place_catalogo")
            .upsert(rows, on_conflict="provider,external_id")
            .execute()
        )
    except Exception as exc:
        print(f"[geoapify] erro ao salvar catalogo: {exc}")


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
