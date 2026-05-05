import httpx
import json
import populartimes
from datetime import datetime, timedelta, timezone
from typing import Generator
from sqlalchemy.orm import Session

from config import GOOGLE_API_KEY
from models.restaurante import RestauranteCache


PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place"
CACHE_TTL_HORAS = 24  

async def get_dados_restaurante(restaurante_id: str, place_id: str, db: Session) -> dict:

    cache = db.query(RestauranteCache).filter_by(restaurante_id=restaurante_id).first()

    if _cache_valido(cache):
        return _cache_para_dict(cache)

    dados_google = await _buscar_place_details(place_id)

    if dados_google:
        cache = _salvar_cache(restaurante_id, dados_google, cache, db)

    return _cache_para_dict(cache) if cache else {}


async def _buscar_apenas_restaurantes_proximos(lat: float, lng: float, raio_metros: int = 1500, tipo_culinaria: str = None) -> list:
    params = {
        "location": f"{lat},{lng}",
        "radius":   raio_metros,
        "type":     "restaurant",
        "key":      GOOGLE_API_KEY,
    }

    if tipo_culinaria:
        params["keyword"] = tipo_culinaria

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PLACES_BASE_URL}/nearbysearch/json", params=params)
        response.raise_for_status()
        data = response.json()

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise Exception(f"Google Places erro: {data.get('status')} — {data.get('error_message', '')}")

    return [_formatar_resultado_nearby(r) for r in data.get("results", [])]


async def buscar_restaurantes_proximos(lat: float, lng: float, raio_metros: int = 1500, tipo_culinaria: str = None) -> list:
    tipos_busca = ["restaurant"] if tipo_culinaria else ["restaurant", "supermarket"]
    resultados_por_place_id = {}

    async with httpx.AsyncClient() as client:
        for tipo_google in tipos_busca:
            params = {
                "location": f"{lat},{lng}",
                "radius":   raio_metros,
                "type":     tipo_google,
                "key":      GOOGLE_API_KEY,
            }

            if tipo_culinaria:
                params["keyword"] = tipo_culinaria

            response = await client.get(f"{PLACES_BASE_URL}/nearbysearch/json", params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                raise Exception(f"Google Places erro: {data.get('status')} â€” {data.get('error_message', '')}")

            for resultado in data.get("results", []):
                place_id = resultado.get("place_id")
                if place_id:
                    resultados_por_place_id[place_id] = resultado

    return [_formatar_resultado_nearby(r) for r in resultados_por_place_id.values()]


async def buscar_detalhes_por_place_id(place_id: str) -> dict | None:
    dados = await _buscar_place_details(place_id)
    if not dados:
        return None

    fotos = dados.get("photos", [])
    foto_ref = fotos[0].get("photo_reference") if fotos else None
    location = dados.get("geometry", {}).get("location", {})

    return {
        "google_place_id": place_id,
        "nome": dados.get("name"),
        "endereco": dados.get("formatted_address"),
        "latitude": location.get("lat"),
        "longitude": location.get("lng"),
        "telefone": dados.get("formatted_phone_number"),
        "site_url": dados.get("website"),
        "google_maps_url": dados.get("url"),
        "reservavel_google": dados.get("reservable"),
        "tipos": dados.get("types", []),
        "foto_url": _montar_url_foto(foto_ref) if foto_ref else None,
        "horarios": dados.get("opening_hours", {}).get("weekday_text", []),
        "nota_google": dados.get("rating"),
        "total_avaliacoes_google": dados.get("user_ratings_total"),
    }


async def buscar_por_texto(texto: str, lat: float = None, lng: float = None) -> list:
    params = {
        "query": f"{texto} restaurante mercado",
        "key":   GOOGLE_API_KEY,
    }

    if lat and lng:
        params["location"] = f"{lat},{lng}"
        params["radius"]   = 10000

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PLACES_BASE_URL}/textsearch/json", params=params)
        response.raise_for_status()
        data = response.json()

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise Exception(f"Google Places erro: {data.get('status')}")

    return [_formatar_resultado_nearby(r) for r in data.get("results", [])]


async def geocodificar_endereco(endereco: str) -> dict:
    params = {
        "address": endereco,
        "key":     GOOGLE_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
        response.raise_for_status()
        data = response.json()

    if data.get("status") != "OK" or not data.get("results"):
        return {}

    resultado = data["results"][0]
    loc = resultado["geometry"]["location"]

    return {
        "endereco_formatado": resultado.get("formatted_address"),
        "latitude":           loc["lat"],
        "longitude":          loc["lng"],
    }


async def invalidar_cache(restaurante_id: str, db: Session):
    cache = db.query(RestauranteCache).filter_by(restaurante_id=restaurante_id).first()
    if cache:
        cache.atualizado_em = datetime(2000, 1, 1, tzinfo=timezone.utc)
        db.commit()

def get_lotacao_atual(place_id: str) -> dict:
    try:
        data    = populartimes.get_id(GOOGLE_API_KEY, place_id)
        lotacao = data.get("current_popularity")  
        return {"place_id": place_id, "lotacao": lotacao}
    except Exception as e:
        print(f"[populartimes] Erro em {place_id}: {e}")
        return {"place_id": place_id, "lotacao": None}


def get_lotacao_lote_stream(place_ids: list[str]) -> Generator[str, None, None]:
    """
        from fastapi.responses import StreamingResponse
        from services import google_service

        @router.post("/lotacao-lote")
        def lotacao_lote(dados: dict):
            place_ids = dados.get("place_ids", [])
            return StreamingResponse(
                google_service.get_lotacao_lote_stream(place_ids),
                media_type="text/plain"
            )
    """
    for place_id in place_ids:
        resultado = get_lotacao_atual(place_id)
        yield json.dumps(resultado) + "\n"

def _cache_valido(cache: RestauranteCache) -> bool:
    if not cache or not cache.atualizado_em:
        return False

    atualizado = cache.atualizado_em
    if atualizado.tzinfo is None:
        atualizado = atualizado.replace(tzinfo=timezone.utc)

    return (datetime.now(timezone.utc) - atualizado) < timedelta(hours=CACHE_TTL_HORAS)


async def _buscar_place_details(place_id: str) -> dict | None:
    fields = ",".join([
        "name",
        "formatted_address",
        "geometry",
        "formatted_phone_number",
        "website",
        "url",
        "reservable",
        "types",
        "photos",
        "opening_hours",
        "rating",
        "user_ratings_total",
    ])

    params = {
        "place_id": place_id,
        "fields":   fields,
        "language": "pt-BR",
        "key":      GOOGLE_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PLACES_BASE_URL}/details/json", params=params)
        response.raise_for_status()
        data = response.json()

    if data.get("status") != "OK":
        return None

    return data.get("result", {})


def _salvar_cache(restaurante_id: str, dados: dict, cache_existente, db: Session):
    """Cria ou atualiza RestauranteCache com dados do Google Places."""
    geometry = dados.get("geometry", {})
    location = geometry.get("location", {})

    fotos    = dados.get("photos", [])
    foto_ref = fotos[0].get("photo_reference") if fotos else None
    foto_url = _montar_url_foto(foto_ref) if foto_ref else None

    horario_abertura   = None
    horario_fechamento = None
    periodos           = dados.get("opening_hours", {}).get("periods", [])
    if periodos:
        hoje = periodos[0]
        if "open"  in hoje: horario_abertura   = _str_para_time(hoje["open"].get("time", ""))
        if "close" in hoje: horario_fechamento = _str_para_time(hoje["close"].get("time", ""))

    tipos           = dados.get("types", [])
    tipos_excluidos = {"restaurant", "food", "point_of_interest", "establishment"}
    categoria       = next((t.replace("_", " ").title() for t in tipos if t not in tipos_excluidos), None)

    valores = {
        "nome":                    dados.get("name"),
        "endereco":                dados.get("formatted_address"),
        "latitude":                location.get("lat"),
        "longitude":               location.get("lng"),
        "telefone":                dados.get("formatted_phone_number"),
        "site_url":                dados.get("website"),
        "categoria_culinaria":     categoria,
        "foto_url":                foto_url,
        "horario_abertura":        horario_abertura,
        "horario_fechamento":      horario_fechamento,
        "nota_google":             dados.get("rating"),
        "total_avaliacoes_google": dados.get("user_ratings_total"),
    }

    if cache_existente:
        for campo, valor in valores.items():
            setattr(cache_existente, campo, valor)
        db.commit()
        db.refresh(cache_existente)
        return cache_existente
    else:
        novo = RestauranteCache(restaurante_id=restaurante_id, **valores)
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo


def _cache_para_dict(cache: RestauranteCache) -> dict:
    if not cache:
        return {}
    return {
        "nome":                    cache.nome,
        "endereco":                cache.endereco,
        "latitude":                float(cache.latitude) if cache.latitude else None,
        "longitude":               float(cache.longitude) if cache.longitude else None,
        "telefone":                cache.telefone,
        "site_url":                cache.site_url,
        "categoria_culinaria":     cache.categoria_culinaria,
        "foto_url":                cache.foto_url,
        "horario_abertura":        str(cache.horario_abertura) if cache.horario_abertura else None,
        "horario_fechamento":      str(cache.horario_fechamento) if cache.horario_fechamento else None,
        "nota_google":             float(cache.nota_google) if cache.nota_google else None,
        "total_avaliacoes_google": cache.total_avaliacoes_google,
        "cache_atualizado_em":     cache.atualizado_em.isoformat() if cache.atualizado_em else None,
    }


def _formatar_resultado_nearby(resultado: dict) -> dict:
    """Formata resultado do Nearby Search para retornar ao app."""
    location = resultado.get("geometry", {}).get("location", {})
    fotos    = resultado.get("photos", [])
    foto_ref = fotos[0].get("photo_reference") if fotos else None

    return {
        "google_place_id": resultado.get("place_id"),
        "nome":            resultado.get("name"),
        "endereco":        resultado.get("vicinity"),
        "latitude":        location.get("lat"),
        "longitude":       location.get("lng"),
        "nota_google":     resultado.get("rating"),
        "foto_url":        _montar_url_foto(foto_ref) if foto_ref else None,
        "aberto_agora":    resultado.get("opening_hours", {}).get("open_now"),
        "tipos":           resultado.get("types", []),
    }


def _montar_url_foto(photo_reference: str, largura: int = 800) -> str:

    return (
        f"{PLACES_BASE_URL}/photo"
        f"?maxwidth={largura}"
        f"&photo_reference={photo_reference}"
        f"&key={GOOGLE_API_KEY}"
    )


def _str_para_time(hora_str: str):
    if not hora_str or len(hora_str) != 4:
        return None
    try:
        from datetime import time
        return time(int(hora_str[:2]), int(hora_str[2:]))
    except ValueError:
        return None
