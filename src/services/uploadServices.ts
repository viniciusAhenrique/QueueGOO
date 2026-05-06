import { auth } from '@/firebaseconfig';

import { API_BASE_URL } from '../constants/api';

export function extensaoDaImagem(mimeType?: string | null) {
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  return 'jpg';
}

export async function uploadImagemLocal(path: string, uri: string, mimeType = 'image/jpeg') {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error('Nao foi possivel ler a imagem selecionada.');
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuario nao autenticado.');
  }

  const formData = new FormData();
  formData.append('path', path);
  formData.append('file', {
    uri,
    name: path.split('/').pop() || `imagem.${extensaoDaImagem(mimeType)}`,
    type: mimeType,
  } as unknown as Blob);

  const uploadResponse = await fetch(`${API_BASE_URL}/uploads/imagem`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await uploadResponse.text();
  const data = text ? JSON.parse(text) : null;

  if (!uploadResponse.ok) {
    const detail = data?.detail || 'Nao foi possivel enviar a imagem.';
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(', ') : detail);
  }

  return data.url as string;
}

export async function deletarImagemLocal(path: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return;

  await fetch(`${API_BASE_URL}/uploads/imagem?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
