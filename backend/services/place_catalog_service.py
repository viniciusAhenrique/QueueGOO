import math
import unicodedata
from datetime import datetime, timedelta
from typing import Any

from config import (
    GEOAPIFY_ON_DEMAND_ENABLED,
    GEOAPIFY_REFRESH_LIMIT,
    TRIPADVISOR_ENRICHMENT_ENABLED,
)
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

TIPOS_MERCADO = (
    "mercado",
    "mercados",
    "supermercado",
    "supermarket",
    "grocery",
    "grocery_or_supermarket",
    "commercial.supermarket",
    "commercial.food_and_drink",
)

GEOAPIFY_REFRESH_TTL = timedelta(minutes=30)
_geoapify_refresh_cache: dict[tuple, datetime] = {}


async def buscar_restaurantes_proximos(
    lat: float,
    lng: float,
    raio_metros: int = 1500,
    tipo_culinaria: str | None = None,
) -> list[dict]:
    candidatos = _buscar_candidatos_proximos(lat, lng, raio_metros, tipo_culinaria)
    resultados = _formatar_proximos(candidatos, lat, lng, raio_metros, tipo_culinaria)

    chave_refresh = _chave_refresh(lat, lng, raio_metros, tipo_culinaria or "proximos")
    if _deve_atualizar_geoapify(len(resultados), chave_refresh):
        await _atualizar_geoapify_proximos(
            lat,
            lng,
            raio_metros,
            tipo_culinaria,
            limit=GEOAPIFY_REFRESH_LIMIT,
            chave_refresh=chave_refresh,
        )
        candidatos = _buscar_candidatos_proximos(lat, lng, raio_metros, tipo_culinaria)
        resultados = _formatar_proximos(candidatos, lat, lng, raio_metros, tipo_culinaria)

    return sorted(resultados, key=lambda r: r.get("distancia_metros", 0))


def _formatar_proximos(
    candidatos: list[dict],
    lat: float,
    lng: float,
    raio_metros: int,
    tipo_culinaria: str | None,
) -> list[dict]:
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

    return resultados


async def buscar_por_texto(
    texto: str,
    lat: float | None = None,
    lng: float | None = None,
    raio_metros: int = 7000,
) -> list[dict]:
    termo = _normalizar_texto(texto)
    if not termo:
        return []

    raio = max(1000, min(raio_metros, 50000))
    resultados = _buscar_candidatos_por_texto(termo, lat, lng, raio)
    tokens = _tokens_busca(termo)
    filtro_api = "mercado" if _filtro_mercado(termo) else None
    formatados = _formatar_por_texto(resultados, tokens, filtro_api)
    if lat is None or lng is None:
        return formatados

    filtrados_por_raio = _filtrar_formatados_por_raio(formatados, lat, lng, raio)
    chave_refresh = _chave_refresh(lat, lng, raio, termo)
    if _deve_atualizar_geoapify(len(filtrados_por_raio), chave_refresh):
        await _atualizar_geoapify_proximos(
            lat,
            lng,
            raio,
            filtro_api,
            limit=GEOAPIFY_REFRESH_LIMIT,
            chave_refresh=chave_refresh,
        )
        resultados = _buscar_candidatos_por_texto(termo, lat, lng, raio)
        formatados = _formatar_por_texto(resultados, tokens, filtro_api)
        filtrados_por_raio = _filtrar_formatados_por_raio(formatados, lat, lng, raio)

    return sorted(filtrados_por_raio, key=lambda r: r.get("distancia_metros") or 999_999_999)


async def buscar_detalhes(place_id: str) -> dict | None:
    item = _buscar_catalogo_por_id(place_id) or _buscar_cache_por_id(place_id)
    if not item:
        return None

    detalhes = _formatar_detalhes(item)
    await _enriquecer_com_geoapify(item, detalhes)

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


def salvar_resultados_google(resultados: list[dict]) -> None:
    rows = []
    for item in resultados:
        external_id = item.get("google_place_id")
        if not external_id or not item.get("nome"):
            continue

        rows.append(
            {
                "provider": "google",
                "external_id": external_id,
                "nome": item.get("nome"),
                "endereco": item.get("endereco"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "categoria": _categoria_google(item.get("tipos") or []),
                "tipos": item.get("tipos") or [],
                "foto_url": item.get("foto_url"),
                "horario_texto": item.get("horarios") or [],
                "aberto_agora": item.get("aberto_agora"),
                "nota": item.get("nota_google"),
                "total_avaliacoes": item.get("total_avaliacoes_google"),
                "telefone": item.get("telefone"),
                "site_url": item.get("site_url"),
                "maps_url": item.get("google_maps_url"),
                "ativo": True,
            }
        )

    if not rows:
        return

    try:
        resposta = (
            get_supabase()
            .table("place_catalogo")
            .upsert(rows, on_conflict="provider,external_id")
            .execute()
        )
        total = len(resposta.data or rows)
        exemplos = ", ".join(row.get("nome", "sem nome") for row in rows[:5])
        print(f"[place_catalog] google salvou {total} restaurantes: {exemplos}")
    except Exception as exc:
        print(f"[place_catalog] upsert google ignorado: {exc}")


async def _enriquecer_com_geoapify(item: dict, detalhes: dict) -> None:
    if item.get("provider") != "geoapify" or not item.get("external_id"):
        return

    campos_faltantes = (
        not detalhes.get("telefone")
        or not detalhes.get("site_url")
        or not detalhes.get("foto_url")
        or not detalhes.get("horarios")
    )
    if not campos_faltantes:
        return

    try:
        enriquecimento = await geoapify_service.buscar_detalhes(str(item.get("external_id")))
    except Exception as exc:
        print(f"[geoapify] detalhes ignorados: {exc}")
        return

    if not enriquecimento:
        return

    updates = {}
    for campo in ("telefone", "site_url", "foto_url"):
        if not detalhes.get(campo) and enriquecimento.get(campo):
            detalhes[campo] = enriquecimento[campo]
            updates[campo] = enriquecimento[campo]

    horario_texto = enriquecimento.get("horario_texto") or []
    if not detalhes.get("horarios") and horario_texto:
        detalhes["horarios"] = horario_texto
        updates["horario_texto"] = horario_texto

    extras = enriquecimento.get("geoapify_extras") or {}
    if extras:
        detalhes["geoapify_extras"] = extras

    if updates and item.get("id"):
        try:
            get_supabase().table("place_catalogo").update(updates).eq("id", item["id"]).execute()
        except Exception as exc:
            print(f"[geoapify] cache de detalhes ignorado: {exc}")


def _buscar_candidatos_proximos(
    lat: float,
    lng: float,
    raio_metros: int,
    tipo_culinaria: str | None,
) -> list[dict]:
    return _deduplicar_itens(
        [
            *_buscar_catalogo_por_caixa(lat, lng, raio_metros, tipo_culinaria),
            *_buscar_cache_por_caixa(lat, lng, raio_metros, tipo_culinaria),
        ]
    )


async def _atualizar_geoapify_proximos(
    lat: float,
    lng: float,
    raio_metros: int,
    tipo_culinaria: str | None,
    limit: int,
    chave_refresh: tuple,
) -> None:
    try:
        await geoapify_service.buscar_e_salvar_proximos(
            lat,
            lng,
            raio_metros,
            tipo_culinaria,
            limit=limit,
        )
    except Exception as exc:
        print(f"[geoapify] atualizacao sob demanda ignorada: {exc}")
    finally:
        _registrar_refresh_geoapify(chave_refresh)


def _buscar_candidatos_por_texto(
    texto: str,
    lat: float | None,
    lng: float | None,
    raio_metros: int,
) -> list[dict]:
    return _deduplicar_itens(
        [
            *_buscar_catalogo_por_texto(texto, lat, lng, raio_metros),
            *_buscar_cache_por_texto(texto, lat, lng, raio_metros),
        ]
    )


def _formatar_por_texto(resultados: list[dict], tokens: list[str], filtro: str | None = None) -> list[dict]:
    return [
        _formatar_restaurante(item)
        for item in resultados
        if _parece_comida(item, filtro) and _combina_busca(item, tokens)
    ]


def _filtrar_formatados_por_raio(
    formatados: list[dict],
    lat: float,
    lng: float,
    raio_metros: int,
) -> list[dict]:
    filtrados_por_raio = []
    for item in formatados:
        latitude = _float_ou_none(item.get("latitude"))
        longitude = _float_ou_none(item.get("longitude"))
        if latitude is None or longitude is None:
            continue

        distancia = round(_distancia_metros(lat, lng, latitude, longitude))
        if distancia <= raio_metros:
            item["distancia_metros"] = distancia
            filtrados_por_raio.append(item)

    return filtrados_por_raio


def _deve_atualizar_geoapify(total_resultados: int, chave_refresh: tuple) -> bool:
    if not GEOAPIFY_ON_DEMAND_ENABLED:
        return False

    ultima = _geoapify_refresh_cache.get(chave_refresh)
    return not ultima or datetime.now() - ultima > GEOAPIFY_REFRESH_TTL


def _filtro_mercado(filtro: str | None) -> bool:
    return _normalizar_texto(filtro) in TIPOS_MERCADO


def _registrar_refresh_geoapify(chave_refresh: tuple) -> None:
    _geoapify_refresh_cache[chave_refresh] = datetime.now()


def _chave_refresh(lat: float, lng: float, raio_metros: int, filtro: str | None) -> tuple:
    return (round(lat, 3), round(lng, 3), int(raio_metros), _normalizar_texto(filtro))


def _deduplicar_itens(itens: list[dict]) -> list[dict]:
    vistos = set()
    unicos = []
    for item in itens:
        chave = (
            item.get("external_id")
            or item.get("google_place_id")
            or _nested(item, "restaurante", "google_place_id")
            or item.get("id")
            or (
                _normalizar_texto(str(item.get("nome") or "")),
                round(_float_ou_none(item.get("latitude")) or 0, 5),
                round(_float_ou_none(item.get("longitude")) or 0, 5),
            )
        )
        if chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(item)
    return unicos


def _categoria_google(tipos: list[str]) -> str | None:
    excluidos = {"restaurant", "food", "point_of_interest", "establishment"}
    for tipo in tipos:
        if tipo not in excluidos:
            return tipo
    return tipos[0] if tipos else None


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

    if tipo_culinaria and not _filtro_mercado(tipo_culinaria):
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

    if tipo_culinaria and not _filtro_mercado(tipo_culinaria):
        query = query.ilike("categoria_culinaria", f"%{tipo_culinaria}%")

    return [item for item in _executar(query) if _nested(item, "restaurante", "ativo") is not False]


def _buscar_catalogo_por_texto(
    texto: str,
    lat: float | None,
    lng: float | None,
    raio_metros: int,
) -> list[dict]:
    query = (
        get_supabase()
        .table("place_catalogo")
        .select("*")
        .eq("ativo", True)
        .limit(160)
    )

    if lat is not None and lng is not None:
        lat_min, lat_max, lng_min, lng_max = _bounding_box(lat, lng, raio_metros)
        query = (
            query.gte("latitude", lat_min)
            .lte("latitude", lat_max)
            .gte("longitude", lng_min)
            .lte("longitude", lng_max)
        )
    else:
        query = query.ilike("busca_texto", f"%{texto}%")

    return _executar(query)


def _buscar_cache_por_texto(
    texto: str,
    lat: float | None,
    lng: float | None,
    raio_metros: int,
) -> list[dict]:
    query = (
        get_supabase()
        .table("restaurante_cache")
        .select("*, restaurante!inner(id, google_place_id, aceita_reservas, status_validacao, ativo)")
        .limit(120)
    )

    if lat is not None and lng is not None:
        lat_min, lat_max, lng_min, lng_max = _bounding_box(lat, lng, raio_metros)
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

    filtro_normalizado = _normalizar_texto(filtro)
    if _filtro_mercado(filtro_normalizado):
        return any(palavra in texto for palavra in TIPOS_MERCADO)

    if any(palavra in texto for palavra in TIPOS_MERCADO):
        return False

    if filtro_normalizado and filtro_normalizado not in texto:
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
    ignorados = {
        "restaurante",
        "restaurantes",
        "restaurant",
        "comida",
        "food",
        "todos",
        "mercado",
        "mercados",
    }
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
