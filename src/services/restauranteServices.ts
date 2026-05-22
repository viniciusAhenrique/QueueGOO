import { apiFetch } from '../hooks/useApi';
import { consultarLotacaoQmesa } from './qmesaPublicApi';

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
  distancia_metros?: number;
}

export interface RestauranteDetalhesApi extends RestauranteResumo {
  telefone?: string;
  site_url?: string;
  google_maps_url?: string;
  reservavel_google?: boolean;
  tipos?: string[];
  horarios?: string[];
  total_avaliacoes_google?: number;
  avaliacao_externa?: {
    fonte: string;
    nota?: number | null;
    total?: number | null;
    ranking?: string | null;
    url?: string | null;
    rating_image_url?: string | null;
  };
  fotos_externas?: {
    url: string;
    legenda?: string | null;
    atribuicao?: string | null;
  }[];
  geoapify_extras?: {
    descricao?: string;
    cozinha?: string | string[];
    reserva?: string | boolean;
    capacidade?: string | number;
    delivery?: string | boolean;
    takeaway?: string | boolean;
    outdoor_seating?: string | boolean;
    wheelchair?: string | boolean;
    estacionamento?: string | boolean;
    playground?: string | boolean;
    aceita_cartao?: string | boolean;
  };
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
  raio = 7000,
) {
  const params = new URLSearchParams({ q: query });

  if (latitude && longitude) {
    params.set('lat', String(latitude));
    params.set('lng', String(longitude));
    params.set('raio', String(raio));
  }

  return apiFetch<RestauranteResumo[]>(`/restaurantes/buscar?${params.toString()}`);
}

export async function buscarDetalhesRestaurante(placeId: string) {
  return apiFetch<RestauranteDetalhesApi>(`/restaurantes/google/${encodeURIComponent(placeId)}`);
}

export async function buscarLotacaoAtual(placeId: string) {
  try {
    const lotacaoQmesa = await consultarLotacaoQmesa(placeId);

    if (typeof lotacaoQmesa?.percentual_ocupacao === 'number') {
      return {
        place_id: placeId,
        lotacao: Math.round(lotacaoQmesa.percentual_ocupacao),
      };
    }
  } catch (error) {
    console.warn('Lotacao Qmesa indisponivel, usando API interna:', error);
  }

  return apiFetch<LotacaoAtual>(`/lotacao/${encodeURIComponent(placeId)}`);
}
