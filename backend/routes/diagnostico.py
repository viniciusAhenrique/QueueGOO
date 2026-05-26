from datetime import datetime, timezone
from time import perf_counter

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, status

from config import (
    DEBUG,
    DIAGNOSTIC_TOKEN,
    GEOAPIFY_ON_DEMAND_ENABLED,
    GOOGLE_PLACES_FALLBACK_ENABLED,
    POPULARTIMES_FALLBACK_ENABLED,
    QMESA_PUBLIC_ANON_KEY,
    QMESA_PUBLIC_SUPABASE_URL,
    TRIPADVISOR_ENRICHMENT_ENABLED,
)
from services import google_service

router = APIRouter()


def _proteger(token: str | None) -> None:
    if not DEBUG:
        raise HTTPException(status_code=404, detail="Nao encontrado.")

    if not DIAGNOSTIC_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="DIAGNOSTIC_TOKEN nao configurado.",
        )

    if token != DIAGNOSTIC_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token de diagnostico invalido.")


async def _medir(nome: str, fn):
    inicio = perf_counter()
    try:
        dados = await fn()
        return {
            "nome": nome,
            "status": "ok",
            "duracao_ms": round((perf_counter() - inicio) * 1000),
            **dados,
        }
    except Exception as exc:
        return {
            "nome": nome,
            "status": "erro",
            "duracao_ms": round((perf_counter() - inicio) * 1000),
            "erro": str(exc),
        }


def _resumo_lista(dados: list[dict], campos: tuple[str, ...]) -> list[dict]:
    resumo = []
    for item in dados[:5]:
        resumo.append({campo: item.get(campo) for campo in campos if campo in item})
    return resumo


async def _qmesa_view(view: str, params: dict[str, str] | None = None):
    if not QMESA_PUBLIC_SUPABASE_URL or not QMESA_PUBLIC_ANON_KEY:
        return {
            "status": "nao_configurado",
            "resumo": "Defina QMESA_PUBLIC_SUPABASE_URL e QMESA_PUBLIC_ANON_KEY no .env local.",
        }

    base_url = QMESA_PUBLIC_SUPABASE_URL.rstrip("/")
    query = {"select": "*", **(params or {})}
    headers = {
        "apikey": QMESA_PUBLIC_ANON_KEY,
        "Authorization": f"Bearer {QMESA_PUBLIC_ANON_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(f"{base_url}/rest/v1/{view}", params=query, headers=headers)

    if response.status_code >= 400:
        return {
            "status": "erro",
            "http_status": response.status_code,
            "resumo": response.text[:500],
        }

    dados = response.json()
    if not isinstance(dados, list):
        dados = [dados]

    return {
        "status": "ok",
        "total": len(dados),
        "amostra": _resumo_lista(
            dados,
            (
                "id",
                "restaurante_id",
                "restaurante_nome",
                "nome",
                "percentual_ocupacao",
                "mesas_livres",
                "categoria",
                "preco",
            ),
        ),
    }


@router.get("")
async def diagnostico(
    x_diagnostic_token: str | None = Header(default=None),
    lat: float = Query(-25.4284),
    lng: float = Query(-49.2733),
    raio: int = Query(3000),
):
    _proteger(x_diagnostic_token)

    testes = []
    testes.append(
        {
            "nome": "configuracao",
            "status": "ok",
            "resumo": {
                "debug": DEBUG,
                "google_places_fallback": GOOGLE_PLACES_FALLBACK_ENABLED,
                "geoapify_on_demand": GEOAPIFY_ON_DEMAND_ENABLED,
                "populartimes_fallback": POPULARTIMES_FALLBACK_ENABLED,
                "tripadvisor_enrichment": TRIPADVISOR_ENRICHMENT_ENABLED,
                "qmesa_configurado": bool(QMESA_PUBLIC_SUPABASE_URL and QMESA_PUBLIC_ANON_KEY),
                "diagnostic_token_configurado": bool(DIAGNOSTIC_TOKEN),
            },
        }
    )

    for view in ("api_v_restaurantes", "api_v_metricas", "api_v_lotacao"):
        testes.append(await _medir(f"qmesa.{view}", lambda view=view: _qmesa_view(view)))

    qmesa_lotacao = next(
        (
            teste
            for teste in testes
            if teste["nome"] == "qmesa.api_v_lotacao"
            and teste.get("status") == "ok"
            and teste.get("total", 0) > 0
        ),
        None,
    )
    restaurante_id = None
    if qmesa_lotacao:
        restaurante_id = qmesa_lotacao["amostra"][0].get("restaurante_id")

    if restaurante_id:
        testes.append(
            await _medir(
                "qmesa.api_v_cardapio",
                lambda: _qmesa_view("api_v_cardapio", {"restaurante_id": f"eq.{restaurante_id}"}),
            )
        )
        testes.append(
            await _medir(
                "qmesa.api_v_fila",
                lambda: _qmesa_view("api_v_fila", {"restaurante_id": f"eq.{restaurante_id}"}),
            )
        )

    async def testar_backend_proximos():
        resultados = await google_service.buscar_restaurantes_proximos(lat, lng, raio)
        return {
            "total": len(resultados),
            "amostra": _resumo_lista(
                resultados,
                ("google_place_id", "nome", "distancia_metros", "nota_google", "aberto_agora"),
            ),
        }

    testes.append(await _medir("backend.restaurantes_proximos", testar_backend_proximos))

    place_id = None
    backend_teste = testes[-1]
    if backend_teste.get("status") == "ok" and backend_teste.get("amostra"):
        place_id = backend_teste["amostra"][0].get("google_place_id")

    if place_id:
        async def testar_lotacao():
            resultado = google_service.get_lotacao_atual(place_id)
            return {
                "place_id": place_id,
                "lotacao": resultado.get("lotacao"),
                "fonte": resultado.get("fonte"),
                "populartimes_ativo": POPULARTIMES_FALLBACK_ENABLED,
            }

        testes.append(await _medir("backend.lotacao_populartimes", testar_lotacao))

    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "ambiente": "debug",
        "observacao": "Endpoint disponivel apenas com DEBUG=true. Nao exponha em producao.",
        "testes": testes,
    }
