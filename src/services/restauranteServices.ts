import { apiFetch } from '../hooks/useApi';

export interface RestauranteResumo {
  google_place_id: string;
  nome: string;
  endereco?: string;
  latitude: number;
  longitude: number;
  nota_google?: number;
  foto_url?: string | null;
  aberto_agora?: boolean;
  tipos?: string[];
}

export interface RestauranteDetalhesApi extends RestauranteResumo {
  telefone?: string;
  site_url?: string;
  google_maps_url?: string;
  reservavel_google?: boolean;
  tipos?: string[];
  horarios?: string[];
  total_avaliacoes_google?: number;
}

export interface LotacaoAtual {
  place_id: string;
  lotacao: number | null;
}

export async function buscarRestaurantesProximos(
  latitude: number,
  longitude: number,
  raio = 1500,
  tipoCulinaria?: string,
) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    raio: String(raio),
  });

  if (tipoCulinaria) {
    params.set('tipo_culinaria', tipoCulinaria);
  }

  return apiFetch<RestauranteResumo[]>(`/restaurantes/proximos?${params.toString()}`);
}

export async function buscarRestaurantesPorTexto(
  query: string,
  latitude?: number,
  longitude?: number,
) {
  const params = new URLSearchParams({ q: query });

  if (latitude && longitude) {
    params.set('lat', String(latitude));
    params.set('lng', String(longitude));
  }

  return apiFetch<RestauranteResumo[]>(`/restaurantes/buscar?${params.toString()}`);
}

export async function buscarDetalhesRestaurante(placeId: string) {
  return apiFetch<RestauranteDetalhesApi>(`/restaurantes/google/${encodeURIComponent(placeId)}`);
}

export async function buscarLotacaoAtual(placeId: string) {
  return apiFetch<LotacaoAtual>(`/lotacao/${encodeURIComponent(placeId)}`);
}
