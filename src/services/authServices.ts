import { apiFetch } from '@/src/hooks/useApi';
import { auth } from '@/firebaseconfig';

export interface PerfilUsuario {
  id: string;
  firebase_uid: string;
  nome: string;
  email: string;
  telefone?: string | null;
  foto_url?: string | null;
  tipo_comida_favorito?: string | null;
  conformidade_lgpd: boolean;
  criado_em?: string | null;
}

export async function sincronizarPrimeiroAcesso() {
  await auth.currentUser?.getIdToken(true);

  return apiFetch<PerfilUsuario>('/auth/primeiro-acesso', {
    method: 'POST',
  });
}
