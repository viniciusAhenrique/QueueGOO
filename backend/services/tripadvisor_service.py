import httpx

from config import TRIPADVISOR_API_KEY
from database import get_supabase


BASE_URL = "https://api.content.tripadvisor.com/api/v1"


async def enriquecer_restaurante(item: dict) -> dict | None:
    if not TRIPADVISOR_API_KEY:
        return None

    location_id = item.get("tripadvisor_location_id")
    if not location_id:
        location_id = await _buscar_location_id(item)
        if location_id:
            _salvar_location_id(item, location_id)

    if not location_id:
        return None

    detalhes, fotos = await _buscar_detalhes_e_fotos(location_id)
    if not detalhes:
        return None

    fotos_formatadas = [_formatar_foto(foto) for foto in fotos]
    fotos_formatadas = [foto for foto in fotos_formatadas if foto.get("url")]

    return {
        "fonte": "tripadvisor",
        "location_id": str(location_id),
        "rating": _float_ou_none(detalhes.get("rating")),
        "num_reviews": _int_ou_none(detalhes.get("num_reviews")),
        "ranking": (detalhes.get("ranking_data") or {}).get("ranking_string"),
        "web_url": detalhes.get("web_url"),
        "rating_image_url": detalhes.get("rating_image_url"),
        "fotos": fotos_formatadas,
        "atribuicao": "Tripadvisor",
    }


async def _buscar_location_id(item: dict) -> str | None:
    nome = item.get("nome")
    lat = item.get("latitude")
    lng = item.get("longitude")
    if not nome or lat is None or lng is None:
        return None

    params = {
        "key": TRIPADVISOR_API_KEY,
        "searchQuery": nome,
        "category": "restaurants",
        "latLong": f"{lat},{lng}",
        "radius": 500,
        "radiusUnit": "m",
        "language": "pt",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{BASE_URL}/location/search", params=params)
        response.raise_for_status()
        data = response.json()

    resultados = data.get("data") or []
    if not resultados:
        return None

    melhor = resultados[0]
    return str(melhor.get("location_id")) if melhor.get("location_id") else None


async def _buscar_detalhes_e_fotos(location_id: str) -> tuple[dict | None, list[dict]]:
    params = {
        "key": TRIPADVISOR_API_KEY,
        "language": "pt",
        "currency": "BRL",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        detalhes_response = await client.get(
            f"{BASE_URL}/location/{location_id}/details",
            params=params,
        )
        detalhes_response.raise_for_status()

        fotos_response = await client.get(
            f"{BASE_URL}/location/{location_id}/photos",
            params={**params, "limit": 5},
        )
        fotos_response.raise_for_status()

    fotos_data = fotos_response.json()
    return detalhes_response.json(), fotos_data.get("data") or []


def _salvar_location_id(item: dict, location_id: str) -> None:
    item_id = item.get("id")
    provider = item.get("provider")
    external_id = item.get("external_id")

    try:
        if item_id:
            (
                get_supabase()
                .table("place_catalogo")
                .update({"tripadvisor_location_id": location_id})
                .eq("id", item_id)
                .execute()
            )
        elif provider and external_id:
            (
                get_supabase()
                .table("place_catalogo")
                .update({"tripadvisor_location_id": location_id})
                .eq("provider", provider)
                .eq("external_id", external_id)
                .execute()
            )
    except Exception as exc:
        print(f"[tripadvisor] nao foi possivel salvar location_id: {exc}")


def _formatar_foto(foto: dict) -> dict:
    images = foto.get("images") or {}
    imagem = images.get("large") or images.get("medium") or images.get("small") or {}
    return {
        "url": imagem.get("url"),
        "legenda": foto.get("caption"),
        "atribuicao": "Tripadvisor",
    }


def _float_ou_none(valor) -> float | None:
    if valor is None:
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _int_ou_none(valor) -> int | None:
    if valor is None:
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None
