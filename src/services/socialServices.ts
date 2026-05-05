export type AmigoResumo = {
  uid: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
};

export function avatarFallback(uid?: string) {
  return `https://i.pravatar.cc/240?u=${uid || 'usuario'}`;
}

export function chatIdEntre(uidA: string, uidB: string) {
  return [uidA, uidB].sort().join('_');
}

export function formatarDataCurta(valor: unknown) {
  if (typeof (valor as { toDate?: unknown })?.toDate === 'function') {
    return (valor as { toDate: () => Date }).toDate().toLocaleDateString('pt-BR');
  }

  return 'agora';
}
