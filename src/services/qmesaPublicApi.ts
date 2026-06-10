import { QMESA_PUBLIC_API_URL } from '@/src/constants/qmesa';

type QmesaRecurso = 'restaurantes' | 'lotacao' | 'metricas' | 'fila' | 'proximos_fila' | 'reservas' | 'cardapio';

type NumeroApi = number | string | null;

export interface QmesaLinkavel {
  links?: {
    fila?: string | null;
    reserva?: string | null;
  } | null;
  link_fila?: string | null;
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

export interface QmesaRestaurante extends QmesaLinkavel {
  id: string;
  slug?: string | null;
  nome: string;
  cnpj?: string | null;
  capacidade: number | null;
  latitude?: number | null;
  longitude?: number | null;
  abertura_hoje?: string | null;
  fechamento_hoje?: string | null;
  periodos_hoje?: {
    inicio: string;
    fim: string;
    especial: boolean;
  }[] | null;
  aberto_agora?: boolean | null;
}

export interface QmesaLotacao extends QmesaLinkavel {
  restaurante_id: string;
  restaurante_slug?: string | null;
  restaurante_nome: string;
  restaurante_cnpj?: string | null;
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
  abertura_hoje?: string | null;
  fechamento_hoje?: string | null;
  periodos_hoje?: {
    inicio: string;
    fim: string;
    especial: boolean;
  }[] | null;
  aberto_agora?: boolean | null;
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

type QmesaRawRestaurante = Omit<QmesaRestaurante, 'capacidade' | 'latitude' | 'longitude'> & {
  capacidade: NumeroApi;
  latitude?: NumeroApi;
  longitude?: NumeroApi;
};

type QmesaRawLotacao = Omit<
  QmesaLotacao,
  | 'latitude'
  | 'longitude'
  | 'capacidade_total'
  | 'mesas_totais'
  | 'mesas_ocupadas'
  | 'mesas_livres'
  | 'ocupantes_atuais'
  | 'percentual_ocupacao'
> & {
  latitude?: NumeroApi;
  longitude?: NumeroApi;
  capacidade_total: NumeroApi;
  mesas_totais: NumeroApi;
  mesas_ocupadas: NumeroApi;
  mesas_livres?: NumeroApi;
  ocupantes_atuais: NumeroApi;
  percentual_ocupacao: NumeroApi;
};

type QmesaRawMetrica = QmesaRawLotacao & Omit<QmesaMetrica, keyof QmesaLotacao>;

type QmesaEnvelope<T> = {
  dados?: T;
};

function numeroApi(valor: NumeroApi) {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  return typeof numero === 'number' && Number.isFinite(numero) ? numero : null;
}

function normalizarRestaurante(item: QmesaRawRestaurante): QmesaRestaurante {
  return {
    ...item,
    capacidade: numeroApi(item.capacidade),
    latitude: numeroApi(item.latitude ?? null),
    longitude: numeroApi(item.longitude ?? null),
  };
}

function normalizarLotacao<T extends QmesaRawLotacao>(item: T): T & QmesaLotacao {
  return {
    ...item,
    latitude: numeroApi(item.latitude ?? null),
    longitude: numeroApi(item.longitude ?? null),
    capacidade_total: numeroApi(item.capacidade_total),
    mesas_totais: numeroApi(item.mesas_totais),
    mesas_ocupadas: numeroApi(item.mesas_ocupadas),
    mesas_livres: numeroApi(item.mesas_livres ?? null),
    ocupantes_atuais: numeroApi(item.ocupantes_atuais),
    percentual_ocupacao: numeroApi(item.percentual_ocupacao),
  };
}

function pareceUuid(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

function mesclarRestauranteComLotacao<T extends QmesaLotacao>(
  restaurante: QmesaRestaurante,
  lotacao: T | null,
) {
  return {
    ...(lotacao || {}),
    links: lotacao?.links || restaurante.links,
    link_fila: lotacao?.link_fila || restaurante.link_fila,
    link_reserva: lotacao?.link_reserva || restaurante.link_reserva,
    link_reservas: lotacao?.link_reservas || restaurante.link_reservas,
    reserva_link: lotacao?.reserva_link || restaurante.reserva_link,
    reserva_url: lotacao?.reserva_url || restaurante.reserva_url,
    url_reserva: lotacao?.url_reserva || restaurante.url_reserva,
    url_reservas: lotacao?.url_reservas || restaurante.url_reservas,
    link_qmesa: lotacao?.link_qmesa || restaurante.link_qmesa,
    url_qmesa: lotacao?.url_qmesa || restaurante.url_qmesa,
    booking_url: lotacao?.booking_url || restaurante.booking_url,
    restaurante_id: lotacao?.restaurante_id || restaurante.id,
    restaurante_slug: lotacao?.restaurante_slug || restaurante.slug,
    restaurante_nome: lotacao?.restaurante_nome || restaurante.nome,
    restaurante_cnpj: lotacao?.restaurante_cnpj || restaurante.cnpj,
    latitude: lotacao?.latitude ?? restaurante.latitude ?? null,
    longitude: lotacao?.longitude ?? restaurante.longitude ?? null,
    capacidade_total: lotacao?.capacidade_total ?? restaurante.capacidade ?? null,
    mesas_totais: lotacao?.mesas_totais ?? null,
    mesas_ocupadas: lotacao?.mesas_ocupadas ?? null,
    mesas_livres: lotacao?.mesas_livres ?? null,
    ocupantes_atuais: lotacao?.ocupantes_atuais ?? null,
    percentual_ocupacao: lotacao?.percentual_ocupacao ?? null,
    atualizado_em: lotacao?.atualizado_em ?? null,
  };
}

export function extrairLinkReservaQmesa(item: QmesaLinkavel) {
  const link =
    item.links?.reserva ||
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

async function qmesaFetch<T>(recurso: QmesaRecurso, params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams({ recurso });

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, value);
  }

  const url = `${QMESA_PUBLIC_API_URL}?${searchParams.toString()}`;
  if (__DEV__) {
    console.info(`[Qmesa API] Consultando recurso=${recurso}`);
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const erro = await response.text();
    if (__DEV__) {
      console.warn(`[Qmesa API] Erro em recurso=${recurso}:`, {
        status: response.status,
        body: erro.slice(0, 300),
      });
    }
    throw new Error(`Erro HTTP ${response.status} ao consultar Qmesa ${recurso}.`);
  }

  const envelope = (await response.json()) as QmesaEnvelope<T> | T;
  const dados = envelope && typeof envelope === 'object' && 'dados' in envelope
    ? envelope.dados
    : envelope;

  if (__DEV__) {
    console.info(`[Qmesa API] Resposta de recurso=${recurso}:`, {
      total: Array.isArray(dados) ? dados.length : null,
    });
  }

  return dados as T;
}

function filtroRestaurante(restauranteId: string): Record<string, string> {
  return pareceUuid(restauranteId)
    ? { restaurante_id: restauranteId }
    : { slug: restauranteId };
}

export async function listarRestaurantesQmesa() {
  const dados = await qmesaFetch<QmesaRawRestaurante[]>('restaurantes');
  return dados.map(normalizarRestaurante);
}

export async function consultarRestauranteQmesa(restauranteId: string) {
  const dados = await listarRestaurantesQmesa();
  return dados.find((item) => item.id === restauranteId || item.slug === restauranteId) || null;
}

export async function listarMetricasQmesa() {
  try {
    const dados = await qmesaFetch<QmesaRawMetrica[]>('metricas');
    return dados.map((item) => normalizarLotacao(item) as QmesaMetrica);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Qmesa API] Listagem de metricas exige restaurante; montando por restaurantes:', error);
    }

    const restaurantes = await listarRestaurantesQmesa();
    const metricas = await Promise.all(
      restaurantes.map(async (restaurante) => {
        const dados = await qmesaFetch<QmesaRawMetrica[]>('metricas', filtroRestaurante(restaurante.id)).catch(() => []);
        const metrica = dados.map((item) => normalizarLotacao(item) as QmesaMetrica)[0] || null;
        return mesclarRestauranteComLotacao(restaurante, metrica) as QmesaMetrica;
      }),
    );

    return metricas;
  }
}

export async function listarLotacoesQmesa() {
  try {
    const dados = await qmesaFetch<QmesaRawLotacao[]>('lotacao');
    return dados.map(normalizarLotacao);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Qmesa API] Listagem de lotacao exige restaurante; montando por restaurantes:', error);
    }

    const restaurantes = await listarRestaurantesQmesa();
    const lotacoes = await Promise.all(
      restaurantes.map(async (restaurante) => {
        const lotacao = await consultarLotacaoQmesa(restaurante.id).catch(() => null);
        return mesclarRestauranteComLotacao(restaurante, lotacao);
      }),
    );

    return lotacoes;
  }
}

export async function consultarLotacaoQmesa(restauranteId: string) {
  const dados = await qmesaFetch<QmesaRawLotacao[]>('lotacao', filtroRestaurante(restauranteId));
  return dados.map(normalizarLotacao)[0] || null;
}

export async function consultarFilaQmesa(restauranteId: string) {
  const dados = await qmesaFetch<QmesaFila[]>('fila', filtroRestaurante(restauranteId));
  return dados[0] || null;
}

export function consultarProximosFilaQmesa(restauranteId: string) {
  return qmesaFetch<QmesaProximoFila[]>('proximos_fila', filtroRestaurante(restauranteId));
}

export function consultarReservasQmesa(restauranteId: string) {
  return qmesaFetch<QmesaReserva[]>('reservas', filtroRestaurante(restauranteId));
}

export function consultarCardapioQmesa(restauranteId: string) {
  return qmesaFetch<QmesaCardapioItem[]>('cardapio', filtroRestaurante(restauranteId));
}
