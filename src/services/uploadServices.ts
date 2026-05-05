import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from '@/firebaseconfig';

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

  const blob = await response.blob();
  const arquivoRef = ref(storage, path);

  await uploadBytes(arquivoRef, blob, { contentType: mimeType });
  return getDownloadURL(arquivoRef);
}
