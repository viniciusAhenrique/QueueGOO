import httpx
import json
import populartimes
from datetime import datetime, timedelta, timezone
from typing import Generator
from sqlalchemy.orm import Session

from config import (
    GOOGLE_API_KEY,
    GOOGLE_PLACES_FALLBACK_ENABLED,
    GOOGLE_PLACES_REFRESH_TTL_MINUTES,
    POPULARTIMES_FALLBACK_ENABLED,
)
from models.restaurante import RestauranteCache
from services import place_catalog_service


PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place"
CACHE_TTL_HORAS = 24  
GOOGLE_REFRESH_TTL = timedelta(minutes=GOOGLE_PLACES_REFRESH_TTL_MINUTES)
_google_refresh_cache: dict[tuple, datetime] = {}

TIPOS_COMIDA_PERMITIDOS = {
    "restaurant",
    "food",
    "meal_takeaway",
    "meal_delivery",
    "cafe",
    "bakery",
    "bar",
}

TIPOS_MERCADO_PERMITIDOS = {
    "supermarket",
    "grocery_or_supermarket",
    "convenience_store",
}

TIPOS_BLOQUEADOS = {
    "car_repair",
    "car_dealer",
    "car_wash",
    "gas_station",
    "hardware_store",
    "home_goods_store",
    "furniture_store",
    "electronics_store",
    "clothing_store",
    "shoe_store",
    "store",
    "shopping_mall",
    "real_estate_agency",
    "insurance_agency",
    "bank",
    "atm",
}

PALAVRAS_CULINARIA = {
    "japanese": "japonesa sushi restaurante",
    "japonesa": "japonesa sushi restaurante",
    "sushi": "sushi restaurante",
    "brazilian": "brasileira restaurante",
    "brasileira": "brasileira restaurante",
    "pizza": "pizza pizzaria restaurante",
    "mercado": "mercado supermercado comida",
    "supermarket": "mercado supermercado comida",
}

async def get_dados_restaurante(restaurante_id: str, place_id: str, db: Session) -> dict:

    cache = db.query(RestauranteCache).filter_by(restaurante_id=restaurante_id).first()

    if _cache_valido(cache):
        return _cache_para_dict(cache)

    if not GOOGLE_PLACES_FALLBACK_ENABLED:
        return _cache_para_dict(cache) if cache else {}

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
    resultados_catalogo = await place_catalog_service.buscar_restaurantes_proximos(
        lat, lng, raio_metros, tipo_culinaria
    )
    if not _deve_chamar_google(len(resultados_catalogo), lat, lng, raio_metros, tipo_culinaria or "proximos"):
        return resultados_catalogo

    chave_refresh = _chave_refresh_google(lat, lng, raio_metros, tipo_culinaria or "proximos")
    try:
        resultados_google = await _buscar_google_restaurantes_proximos(lat, lng, raio_metros, tipo_culinaria)
    except Exception as exc:
        print(f"[google places] fallback proximos ignorado: {exc}")
        _registrar_refresh_google(chave_refresh)
        return resultados_catalogo

    place_catalog_service.salvar_resultados_google(resultados_google)
    _registrar_refresh_google(chave_refresh)

    resultados_atualizados = await place_catalog_service.buscar_restaurantes_proximos(
        lat, lng, raio_metros, tipo_culinaria
    )
    return resultados_atualizados or resultados_google


async def _buscar_google_restaurantes_proximos(lat: float, lng: float, raio_metros: int = 1500, tipo_culinaria: str = None) -> list:
    tipos_busca = ["supermarket"] if _filtro_mercado(tipo_culinaria) else ["restaurant"]
    resultados_por_place_id = {}
    keyword = _normalizar_keyword_comida(tipo_culinaria)

    async with httpx.AsyncClient() as client:
        for tipo_google in tipos_busca:
            params = {
                "location": f"{lat},{lng}",
                "radius":   raio_metros,
                "type":     tipo_google,
                "key":      GOOGLE_API_KEY,
            }

            if keyword:
                params["keyword"] = keyword

            response = await client.get(f"{PLACES_BASE_URL}/nearbysearch/json", params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                raise Exception(f"Google Places erro: {data.get('status')} â€” {data.get('error_message', '')}")

            for resultado in data.get("results", []):
                place_id = resultado.get("place_id")
                if place_id and _eh_resultado_de_comida(resultado, tipo_culinaria):
                    resultados_por_place_id[place_id] = resultado

    return [_formatar_resultado_nearby(r) for r in resultados_por_place_id.values()]


async def buscar_detalhes_por_place_id(place_id: str) -> dict | None:
    dados_catalogo = await place_catalog_service.buscar_detalhes(place_id)
    if dados_catalogo:
        if not dados_catalogo.get("foto_url") and GOOGLE_PLACES_FALLBACK_ENABLED:
            try:
                google_place_id = dados_catalogo.get("google_place_id") or place_id
                dados_google = await _buscar_place_details(google_place_id)
                if dados_google:
                    resultado_google = _formatar_resultado_details(dados_google, google_place_id)
                    place_catalog_service.salvar_resultados_google([resultado_google])
                    dados_catalogo = {
                        **dados_catalogo,
                        "foto_url": resultado_google.get("foto_url") or dados_catalogo.get("foto_url"),
                        "fotos_externas": dados_catalogo.get("fotos_externas") or [],
                    }
            except Exception as exc:
                print(f"[google places] foto fallback ignorada: {exc}")

        return dados_catalogo

    if not GOOGLE_PLACES_FALLBACK_ENABLED:
        return dados_catalogo

    dados = await _buscar_place_details(place_id)
    if not dados:
        return None

    resultado = _formatar_resultado_details(dados, place_id)
    place_catalog_service.salvar_resultados_google([resultado])
    return resultado


async def buscar_por_texto(texto: str, lat: float = None, lng: float = None, raio_metros: int = 7000) -> list:
    resultados_catalogo = await place_catalog_service.buscar_por_texto(texto, lat, lng, raio_metros)
    if lat is None or lng is None:
        return resultados_catalogo

    if not _deve_chamar_google(len(resultados_catalogo), lat, lng, raio_metros, texto):
        return resultados_catalogo

    chave_refresh = _chave_refresh_google(lat, lng, raio_metros, texto)
    try:
        resultados_google = await _buscar_google_por_texto(texto, lat, lng, raio_metros)
    except Exception as exc:
        print(f"[google places] fallback texto ignorado: {exc}")
        _registrar_refresh_google(chave_refresh)
        return resultados_catalogo

    place_catalog_service.salvar_resultados_google(resultados_google)
    _registrar_refresh_google(chave_refresh)

    resultados_atualizados = await place_catalog_service.buscar_por_texto(texto, lat, lng, raio_metros)
    return resultados_atualizados or resultados_google


async def _buscar_google_por_texto(texto: str, lat: float = None, lng: float = None, raio_metros: int = 7000) -> list:
    termo = _normalizar_keyword_comida(texto)
    params = {
        "query": termo,
        "type": "restaurant",
        "key":   GOOGLE_API_KEY,
    }

    if lat and lng:
        params["location"] = f"{lat},{lng}"
        params["radius"]   = min(max(raio_metros, 1000), 50000)

    if _filtro_mercado(texto):
        params["type"] = "supermarket"

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PLACES_BASE_URL}/textsearch/json", params=params)
        response.raise_for_status()
        data = response.json()

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise Exception(f"Google Places erro: {data.get('status')}")

    resultados = [r for r in data.get("results", []) if _eh_resultado_de_comida(r, texto)]
    return [_formatar_resultado_nearby(r) for r in resultados]


async def geocodificar_endereco(endereco: str) -> dict:
    if not GOOGLE_PLACES_FALLBACK_ENABLED:
        return {}

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
    if not POPULARTIMES_FALLBACK_ENABLED:
        return {"place_id": place_id, "lotacao": None, "fonte": "queuegoo"}

    try:
        data    = populartimes.get_id(GOOGLE_API_KEY, place_id)
        lotacao = data.get("current_popularity")  
        return {"place_id": place_id, "lotacao": lotacao, "fonte": "populartimes"}
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


def _deve_chamar_google(
    total_resultados: int,
    lat: float,
    lng: float,
    raio_metros: int,
    filtro: str | None,
) -> bool:
    if not GOOGLE_PLACES_FALLBACK_ENABLED or not GOOGLE_API_KEY:
        return False

    chave = _chave_refresh_google(lat, lng, raio_metros, filtro)
    ultima = _google_refresh_cache.get(chave)
    return not ultima or datetime.now(timezone.utc) - ultima > GOOGLE_REFRESH_TTL


def _registrar_refresh_google(chave: tuple) -> None:
    _google_refresh_cache[chave] = datetime.now(timezone.utc)


def _chave_refresh_google(lat: float, lng: float, raio_metros: int, filtro: str | None) -> tuple:
    return (
        round(lat, 3),
        round(lng, 3),
        int(raio_metros),
        str(filtro or "").strip().lower(),
    )


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


def _formatar_resultado_details(dados: dict, place_id: str | None = None) -> dict:
    fotos = dados.get("photos", [])
    foto_ref = fotos[0].get("photo_reference") if fotos else None
    location = dados.get("geometry", {}).get("location", {})

    return {
        "google_place_id": place_id or dados.get("place_id"),
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


def _normalizar_keyword_comida(texto: str | None) -> str:
    if not texto:
        return "restaurante comida"

    termo = texto.strip().lower()
    return PALAVRAS_CULINARIA.get(termo, f"{termo} restaurante comida")


def _eh_resultado_de_comida(resultado: dict, filtro: str | None = None) -> bool:
    tipos = set(resultado.get("types", []))
    nome = str(resultado.get("name", "")).lower()

    if tipos.intersection(TIPOS_BLOQUEADOS):
        return False

    if _filtro_mercado(filtro):
        return bool(tipos.intersection(TIPOS_MERCADO_PERMITIDOS)) or any(
            palavra in nome for palavra in ("mercado", "supermercado", "market")
        )

    if tipos.intersection(TIPOS_MERCADO_PERMITIDOS):
        return False

    if tipos.intersection(TIPOS_COMIDA_PERMITIDOS):
        return True

    palavras_comida = (
        "restaurante",
        "restaurant",
        "pizzaria",
        "pizza",
        "sushi",
        "lanchonete",
        "burger",
        "hamburg",
        "bar",
        "cafe",
        "cafeteria",
        "padaria",
        "bakery",
    )
    return any(palavra in nome for palavra in palavras_comida)


def _filtro_mercado(filtro: str | None) -> bool:
    termo = str(filtro or "").strip().lower()
    return termo in {"mercado", "mercados", "supermercado", "supermarket", "grocery"}


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
