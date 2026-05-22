import { QMESA_ANON_KEY, QMESA_REST_URL } from '@/src/constants/qmesa';

type SupabaseFilterValue = string | number;

export interface QmesaRestaurante {
  id: string;
  nome: string;
  capacidade: number | null;
}

export interface QmesaLotacao {
  restaurante_id: string;
  restaurante_nome: string;
  capacidade_total: number | null;
  mesas_totais: number | null;
  mesas_ocupadas: number | null;
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

async function qmesaFetch<T>(view: string, params: Record<string, SupabaseFilterValue>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  const response = await fetch(`${QMESA_REST_URL}/${view}?${searchParams.toString()}`, {
    headers: {
      apikey: QMESA_ANON_KEY,
      Authorization: `Bearer ${QMESA_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status} ao consultar ${view}.`);
  }

  return response.json() as Promise<T>;
}

export function listarRestaurantesQmesa() {
  return qmesaFetch<QmesaRestaurante[]>('api_v_restaurantes', {
    select: '*',
    order: 'nome.asc',
  });
}

export function listarMetricasQmesa() {
  return qmesaFetch<QmesaMetrica[]>('api_v_metricas', {
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
