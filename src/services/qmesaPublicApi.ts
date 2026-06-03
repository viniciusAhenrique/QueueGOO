import { QMESA_ANON_KEY, QMESA_REST_URL } from '@/src/constants/qmesa';

type SupabaseFilterValue = string | number;

export interface QmesaRestaurante {
  id: string;
  nome: string;
  capacidade: number | null;
  link_reserva?: string | null;
  link_reservas?: string | null;
  reserva_link?: string | null;
  reserva_url?: string | null;
  url_reserva?: string | null;
  url_reservas?: string | null;
  link_qmesa?: string | null;
  url_qmesa?: string | null;
  booking_url?: string | null;
}

export interface QmesaLotacao {
  restaurante_id: string;
  restaurante_nome: string;
  restaurante_cnpj?: string | null;
  link_reserva?: string | null;
  link_reservas?: string | null;
  reserva_link?: string | null;
  reserva_url?: string | null;
  url_reserva?: string | null;
  url_reservas?: string | null;
  link_qmesa?: string | null;
  url_qmesa?: string | null;
  booking_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacidade_total: number | null;
  mesas_totais: number | null;
  mesas_ocupadas: number | null;
  mesas_livres?: number | null;
  ocupantes_atuais: number | null;
  percentual_ocupacao: number | null;
  atualizado_em: string | null;
}

export interface QmesaMetrica extends QmesaLotacao {
  restaurante_cnpj?: string | null;
  latitude: number | null;
  longitude: number | null;
  abertura_hoje?: string | null;
  fechamento_hoje?: string | null;
  periodos_hoje?: {
    inicio: string;
    fim: string;
    especial: boolean;
  }[] | null;
  aberto_agora?: boolean | null;
  mesas_livres?: number | null;
  movimento_atual?: string | null;
  horario_maior_movimento?: string | null;
  total_entradas_horario_pico?: number | null;
  recomendacao_visita?: string | null;
}

export interface QmesaFila {
  restaurante_id: string;
  total_na_fila: number | null;
  tempo_medio_minutos: number | null;
  tempo_estimado_primeiro_cliente: number | null;
  atualizado_em: string | null;
}

export interface QmesaProximoFila {
  id: string;
  restaurante_id: string;
  posicao: number;
  num_pessoas: number | null;
  tempo_estimado: number | null;
  status: string | null;
  hora_entrada: string | null;
}

export interface QmesaReserva {
  id: string;
  restaurante_id: string;
  data_hora: string;
  num_pessoas: number | null;
  status: string | null;
  mesa_id: string | null;
  tempo_ate_reserva: string | null;
}

export interface QmesaCardapioItem {
  id: string;
  restaurante_id: string;
  restaurante_slug?: string | null;
  restaurante_nome?: string | null;
  nome: string;
  descricao?: string | null;
  preco?: number | string | null;
  categoria?: string | null;
  imagem_url?: string | null;
}

export function extrairLinkReservaQmesa(item: {
  link_reserva?: string | null;
  link_reservas?: string | null;
  reserva_link?: string | null;
  reserva_url?: string | null;
  url_reserva?: string | null;
  url_reservas?: string | null;
  link_qmesa?: string | null;
  url_qmesa?: string | null;
  booking_url?: string | null;
}) {
  const link =
    item.link_reserva ||
    item.link_reservas ||
    item.reserva_link ||
    item.reserva_url ||
    item.url_reserva ||
    item.url_reservas ||
    item.link_qmesa ||
    item.url_qmesa ||
    item.booking_url ||
    null;
  if (!link) return null;

  const linkLimpo = link.trim();
  if (!linkLimpo) return null;

  if (/^https?:\/\//i.test(linkLimpo)) return linkLimpo;
  return `https://${linkLimpo}`;
}

async function qmesaFetch<T>(view: string, params: Record<string, SupabaseFilterValue>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  const url = `${QMESA_REST_URL}/${view}?${searchParams.toString()}`;
  if (__DEV__) {
    console.info(`[Qmesa API] Consultando ${view}`);
  }

  const response = await fetch(url, {
    headers: {
      apikey: QMESA_ANON_KEY,
      Authorization: `Bearer ${QMESA_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const erro = await response.text();
    if (__DEV__) {
      console.warn(`[Qmesa API] Erro em ${view}:`, {
        status: response.status,
        body: erro.slice(0, 300),
      });
    }
    throw new Error(`Erro HTTP ${response.status} ao consultar ${view}.`);
  }

  const dados = (await response.json()) as T;
  if (__DEV__) {
    console.info(`[Qmesa API] Resposta de ${view}:`, {
      total: Array.isArray(dados) ? dados.length : null,
    });
  }

  return dados;
}

export function listarRestaurantesQmesa() {
  return qmesaFetch<QmesaRestaurante[]>('api_v_restaurantes', {
    select: '*',
    order: 'nome.asc',
  });
}

export async function consultarRestauranteQmesa(restauranteId: string) {
  const dados = await qmesaFetch<QmesaRestaurante[]>('api_v_restaurantes', {
    select: '*',
    id: `eq.${restauranteId}`,
  });

  return dados[0] || null;
}

export function listarMetricasQmesa() {
  return qmesaFetch<QmesaMetrica[]>('api_v_metricas', {
    select: '*',
    order: 'restaurante_nome.asc',
  });
}

export function listarLotacoesQmesa() {
  return qmesaFetch<QmesaLotacao[]>('api_v_lotacao', {
    select: '*',
    order: 'restaurante_nome.asc',
  });
}

export async function consultarLotacaoQmesa(restauranteId: string) {
  const dados = await qmesaFetch<QmesaLotacao[]>('api_v_lotacao', {
    select: '*',
    restaurante_id: `eq.${restauranteId}`,
  });

  return dados[0] || null;
}

export async function consultarFilaQmesa(restauranteId: string) {
  const dados = await qmesaFetch<QmesaFila[]>('api_v_fila', {
    select: '*',
    restaurante_id: `eq.${restauranteId}`,
  });

  return dados[0] || null;
}

export function consultarProximosFilaQmesa(restauranteId: string) {
  return qmesaFetch<QmesaProximoFila[]>('api_v_proximos_fila', {
    select: '*',
    restaurante_id: `eq.${restauranteId}`,
    order: 'posicao.asc',
  });
}

export function consultarReservasQmesa(restauranteId: string) {
  return qmesaFetch<QmesaReserva[]>('api_v_reservas', {
    select: '*',
    restaurante_id: `eq.${restauranteId}`,
    order: 'data_hora.asc',
  });
}

export function consultarCardapioQmesa(restauranteId: string) {
  return qmesaFetch<QmesaCardapioItem[]>('api_v_cardapio', {
    select: '*',
    restaurante_id: `eq.${restauranteId}`,
    order: 'categoria.asc,nome.asc',
  });
}
