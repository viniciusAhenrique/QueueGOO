import argparse
import asyncio
import sys
from pathlib import Path

import httpx

sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import NOMINATIM_USER_AGENT  # noqa: E402
from database import get_supabase  # noqa: E402
from services.geoapify_service import DEFAULT_CATEGORIES, buscar_proximos  # noqa: E402


NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"


def main():
    args = _parse_args()
    lat, lng = _resolver_centro(args)
    rows = asyncio.run(
        buscar_proximos(
            lat=lat,
            lng=lng,
            raio_metros=args.raio,
            tipo_culinaria=None,
            limit=args.limit,
            categories=args.categories,
        )
    )
    rows = [row for row in rows if row["external_id"] and row["nome"]]

    if args.dry_run:
        print(f"Encontrados {len(rows)} lugares. Amostra:")
        for row in rows[: args.sample]:
            print(f"- {row['nome']} | {row.get('categoria')} | {row.get('endereco')}")
        return

    if not rows:
        print("Nenhum lugar valido retornado para salvar.")
        return

    resposta = (
        get_supabase()
        .table("place_catalogo")
        .upsert(rows, on_conflict="provider,external_id")
        .execute()
    )
    print(f"Upsert concluido: {len(resposta.data or rows)} registros em place_catalogo.")


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Popula place_catalogo com POIs do Geoapify, usando Nominatim apenas para geocodificar cidade/endereco."
    )
    parser.add_argument("--query", help='Cidade/endereco. Ex: "Curitiba, PR, Brasil"')
    parser.add_argument("--lat", type=float, help="Latitude do centro da busca.")
    parser.add_argument("--lng", type=float, help="Longitude do centro da busca.")
    parser.add_argument("--raio", type=int, default=1500, help="Raio em metros. Padrao: 1500.")
    parser.add_argument("--limit", type=int, default=20, help="Quantidade por chamada. Use 20 para economizar creditos.")
    parser.add_argument("--categories", default=DEFAULT_CATEGORIES, help="Categorias Geoapify separadas por virgula.")
    parser.add_argument("--dry-run", action="store_true", help="Mostra resultados sem salvar no Supabase.")
    parser.add_argument("--sample", type=int, default=10, help="Quantidade de linhas exibidas no dry-run.")
    return parser.parse_args()


def _resolver_centro(args) -> tuple[float, float]:
    if args.lat is not None and args.lng is not None:
        return args.lat, args.lng

    if not args.query:
        raise SystemExit("Informe --query ou --lat e --lng.")

    with httpx.Client(timeout=20, headers={"User-Agent": NOMINATIM_USER_AGENT}) as client:
        response = client.get(
            NOMINATIM_SEARCH_URL,
            params={
                "q": args.query,
                "format": "jsonv2",
                "limit": 1,
                "countrycodes": "br",
            },
        )
        response.raise_for_status()
        data = response.json()

    if not data:
        raise SystemExit(f"Nominatim nao encontrou coordenadas para: {args.query}")

    return float(data[0]["lat"]), float(data[0]["lon"])


if __name__ == "__main__":
    main()
