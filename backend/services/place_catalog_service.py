import math
import unicodedata
from datetime import datetime
from typing import Any

from config import GEOAPIFY_ON_DEMAND_ENABLED, TRIPADVISOR_ENRICHMENT_ENABLED
from database import get_supabase
from services import geoapify_service, tripadvisor_service


TIPOS_COMIDA = (
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
    "mercado",
    "supermercado",
    "supermarket",
    "food",
)


async def buscar_restaurantes_proximos(
    lat: float,
    lng: float,
    raio_metros: int = 1500,
    tipo_culinaria: str | None = None,
) -> list[dict]:
    candidatos = _buscar_catalogo_por_caixa(lat, lng, raio_metros, tipo_culinaria)
    if not candidatos:
        candidatos = _buscar_cache_por_caixa(lat, lng, raio_metros, tipo_culinaria)

    if not candidatos and GEOAPIFY_ON_DEMAND_ENABLED:
        await geoapify_service.buscar_e_salvar_proximos(
            lat, lng, raio_metros, tipo_culinaria, limit=80
        )
        candidatos = _buscar_catalogo_por_caixa(lat, lng, raio_metros, tipo_culinaria)

    resultados = []
    for item in candidatos:
        latitude = _float_ou_none(item.get("latitude"))
        longitude = _float_ou_none(item.get("longitude"))
        if latitude is None or longitude is None:
            continue

        distancia = _distancia_metros(lat, lng, latitude, longitude)
        if distancia <= raio_metros and _parece_comida(item, tipo_culinaria):
            formatado = _formatar_restaurante(item)
            formatado["distancia_metros"] = round(distancia)
            resultados.append(formatado)

    return sorted(resultados, key=lambda r: r.get("distancia_metros", 0))


async def buscar_por_texto(texto: str, lat: float | None = None, lng: float | None = None) -> list[dict]:
    termo = _normalizar_texto(texto)
    if not termo:
        return []

    resultados = _buscar_catalogo_por_texto(termo, lat, lng)
    if not resultados:
        resultados = _buscar_cache_por_texto(termo, lat, lng)

    tokens = _tokens_busca(termo)
    formatados = [
        _formatar_restaurante(item)
        for item in resultados
        if _parece_comida(item) and _combina_busca(item, tokens)
    ]
    if lat is None or lng is None:
        return formatados

    filtrados_por_raio = []
    for item in formatados:
        latitude = _float_ou_none(item.get("latitude"))
        longitude = _float_ou_none(item.get("longitude"))
        if latitude is None or longitude is None:
            continue

        distancia = round(_distancia_metros(lat, lng, latitude, longitude))
        if distancia <= 7000:
            item["distancia_metros"] = distancia
            filtrados_por_raio.append(item)

    return sorted(filtrados_por_raio, key=lambda r: r.get("distancia_metros") or 999_999_999)


async def buscar_detalhes(place_id: str) -> dict | None:
    item = _buscar_catalogo_por_id(place_id) or _buscar_cache_por_id(place_id)
    if not item:
        return None

    detalhes = _formatar_detalhes(item)
    if TRIPADVISOR_ENRICHMENT_ENABLED:
        try:
            enriquecimento = await tripadvisor_service.enriquecer_restaurante(item)
            if enriquecimento:
                detalhes["enriquecimento"] = enriquecimento
                detalhes["avaliacao_externa"] = {
                    "fonte": "Tripadvisor",
                    "nota": enriquecimento.get("rating"),
                    "total": enriquecimento.get("num_reviews"),
                    "ranking": enriquecimento.get("ranking"),
                    "url": enriquecimento.get("web_url"),
                    "rating_image_url": enriquecimento.get("rating_image_url"),
                }
                fotos = enriquecimento.get("fotos") or []
                detalhes["fotos_externas"] = fotos
                if not detalhes.get("foto_url") and fotos:
                    detalhes["foto_url"] = fotos[0].get("url")
        except Exception as exc:
            print(f"[tripadvisor] enriquecimento ignorado: {exc}")

    return detalhes


def _buscar_catalogo_por_caixa(
    lat: float,
    lng: float,
    raio_metros: int,
    tipo_culinaria: str | None,
) -> list[dict]:
    lat_min, lat_max, lng_min, lng_max = _bounding_box(lat, lng, raio_metros)
    query = (
        get_supabase()
        .table("place_catalogo")
        .select("*")
        .gte("latitude", lat_min)
        .lte("latitude", lat_max)
        .gte("longitude", lng_min)
        .lte("longitude", lng_max)
        .eq("ativo", True)
        .limit(120)
    )

    if tipo_culinaria:
        query = query.ilike("busca_texto", f"%{tipo_culinaria}%")

    return _executar(query)


def _buscar_cache_por_caixa(
    lat: float,
    lng: float,
    raio_metros: int,
    tipo_culinaria: str | None,
) -> list[dict]:
    lat_min, lat_max, lng_min, lng_max = _bounding_box(lat, lng, raio_metros)
    query = (
        get_supabase()
        .table("restaurante_cache")
        .select("*, restaurante!inner(id, google_place_id, aceita_reservas, status_validacao, ativo)")
        .gte("latitude", lat_min)
        .lte("latitude", lat_max)
        .gte("longitude", lng_min)
        .lte("longitude", lng_max)
        .limit(120)
    )

    if tipo_culinaria:
        query = query.ilike("categoria_culinaria", f"%{tipo_culinaria}%")

    return [item for item in _executar(query) if _nested(item, "restaurante", "ativo") is not False]


def _buscar_catalogo_por_texto(texto: str, lat: float | None, lng: float | None) -> list[dict]:
    query = (
        get_supabase()
        .table("place_catalogo")
        .select("*")
        .eq("ativo", True)
        .limit(160)
    )

    if lat is not None and lng is not None:
        lat_min, lat_max, lng_min, lng_max = _bounding_box(lat, lng, 7000)
        query = (
            query.gte("latitude", lat_min)
            .lte("latitude", lat_max)
            .gte("longitude", lng_min)
            .lte("longitude", lng_max)
        )
    else:
        query = query.ilike("busca_texto", f"%{texto}%")

    return _executar(query)


def _buscar_cache_por_texto(texto: str, lat: float | None, lng: float | None) -> list[dict]:
    query = (
        get_supabase()
        .table("restaurante_cache")
        .select("*, restaurante!inner(id, google_place_id, aceita_reservas, status_validacao, ativo)")
        .limit(120)
    )

    if lat is not None and lng is not None:
        lat_min, lat_max, lng_min, lng_max = _bounding_box(lat, lng, 7000)
        query = (
            query.gte("latitude", lat_min)
            .lte("latitude", lat_max)
            .gte("longitude", lng_min)
            .lte("longitude", lng_max)
        )
    else:
        query = query.ilike("nome", f"%{texto}%")

    return _executar(query)


def _buscar_catalogo_por_id(place_id: str) -> dict | None:
    for coluna in ("id", "external_id", "google_place_id"):
        resultado = _executar(
            get_supabase()
            .table("place_catalogo")
            .select("*")
            .eq(coluna, place_id)
            .limit(1)
        )
        if resultado:
            return resultado[0]
    return None


def _buscar_cache_por_id(place_id: str) -> dict | None:
    resultado = _executar(
        get_supabase()
        .table("restaurante_cache")
        .select("*, restaurante!inner(id, google_place_id, aceita_reservas, status_validacao, ativo)")
        .eq("restaurante.google_place_id", place_id)
        .limit(1)
    )
    return resultado[0] if resultado else None


def _executar(query) -> list[dict]:
    try:
        resposta = query.execute()
        return resposta.data or []
    except Exception as exc:
        print(f"[place_catalog] consulta ignorada: {exc}")
        return []


def _formatar_restaurante(item: dict) -> dict:
    restaurante = item.get("restaurante") or {}
    external_id = (
        item.get("external_id")
        or item.get("google_place_id")
        or restaurante.get("google_place_id")
        or item.get("id")
        or item.get("restaurante_id")
    )
    tipos = item.get("tipos") or item.get("types") or []
    categoria = item.get("categoria") or item.get("categoria_culinaria")
    if categoria and categoria not in tipos:
        tipos = [*tipos, categoria]

    return {
        "google_place_id": str(external_id) if external_id else None,
        "nome": item.get("nome"),
        "endereco": item.get("endereco") or item.get("vicinity"),
        "latitude": _float_ou_none(item.get("latitude")),
        "longitude": _float_ou_none(item.get("longitude")),
        "nota_google": _float_ou_none(item.get("nota_google") or item.get("nota")),
        "foto_url": item.get("foto_url"),
        "aberto_agora": _aberto_agora(item),
        "tipos": tipos,
    }


def _formatar_detalhes(item: dict) -> dict:
    base = _formatar_restaurante(item)
    return {
        **base,
        "telefone": item.get("telefone"),
        "site_url": item.get("site_url"),
        "google_maps_url": item.get("google_maps_url") or item.get("maps_url"),
        "reservavel_google": item.get("reservavel_google"),
        "horarios": item.get("horarios") or item.get("horario_texto") or [],
        "total_avaliacoes_google": item.get("total_avaliacoes_google"),
    }


def _parece_comida(item: dict, filtro: str | None = None) -> bool:
    texto = " ".join(
        str(valor or "").lower()
        for valor in (
            item.get("nome"),
            item.get("categoria"),
            item.get("categoria_culinaria"),
            item.get("busca_texto"),
            " ".join(item.get("tipos") or item.get("types") or []),
        )
    )

    if filtro and filtro.strip().lower() not in texto:
        return any(palavra in texto for palavra in TIPOS_COMIDA)

    return any(palavra in texto for palavra in TIPOS_COMIDA)


def _combina_busca(item: dict, tokens: list[str]) -> bool:
    if not tokens:
        return True

    texto = _normalizar_texto(
        " ".join(
            str(valor or "")
            for valor in (
                item.get("nome"),
                item.get("endereco"),
                item.get("categoria"),
                item.get("categoria_culinaria"),
                item.get("busca_texto"),
                " ".join(item.get("tipos") or item.get("types") or []),
            )
        )
    )

    return all(token in texto for token in tokens)


def _tokens_busca(texto: str) -> list[str]:
    ignorados = {"restaurante", "restaurantes", "restaurant", "comida", "food", "todos"}
    return [token for token in texto.split() if len(token) > 2 and token not in ignorados]


def _normalizar_texto(texto: str | None) -> str:
    if not texto:
        return ""

    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(char for char in sem_acento if not unicodedata.combining(char))
    return " ".join(sem_acento.lower().strip().split())


def _aberto_agora(item: dict) -> bool | None:
    if "aberto_agora" in item:
        return item.get("aberto_agora")

    abre = item.get("horario_abertura")
    fecha = item.get("horario_fechamento")
    if not abre or not fecha:
        return None

    agora = datetime.now().time()
    try:
        hora_abre = datetime.strptime(str(abre)[:5], "%H:%M").time()
        hora_fecha = datetime.strptime(str(fecha)[:5], "%H:%M").time()
    except ValueError:
        return None

    if hora_abre <= hora_fecha:
        return hora_abre <= agora <= hora_fecha
    return agora >= hora_abre or agora <= hora_fecha


def _bounding_box(lat: float, lng: float, raio_metros: int) -> tuple[float, float, float, float]:
    lat_delta = raio_metros / 111_320
    lng_delta = raio_metros / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    return lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta


def _distancia_metros(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    raio_terra = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return raio_terra * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _float_ou_none(valor: Any) -> float | None:
    if valor is None:
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _nested(item: dict, *chaves: str):
    atual = item
    for chave in chaves:
        if not isinstance(atual, dict):
            return None
        atual = atual.get(chave)
    return atual
