import { auth } from '@/firebaseconfig';
import { API_BASE_URL } from '../constants/api';

type RequestOptions = RequestInit & {
  authenticated?: boolean;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, headers, ...requestOptions } = options;
  const finalHeaders = new Headers(headers);

  if (!finalHeaders.has('Content-Type') && requestOptions.body) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (authenticated) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Usuario nao autenticado.');
    }
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: finalHeaders,
    });
  } catch (error) {
    throw new Error(
      `Nao foi possivel conectar com a API em ${API_BASE_URL}. ` +
        'Confirme que o backend esta rodando com --host 0.0.0.0 e que o celular/emulador consegue acessar esse endereco.',
    );
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail || 'Erro ao comunicar com a API.';
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(', ') : detail);
  }

  return data as T;
}

export function useApi() {
  return { apiFetch };
}
