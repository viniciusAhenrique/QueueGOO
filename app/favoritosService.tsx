import { db } from '@/firebaseconfig'; 
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';

export const adicionarFavorito = async (
  userId: string,
  restaurante: {
    id: string;
    placeId: string;
    nome: string;
    tipo: string;
    lotacao: number;
    foto: string | null;
  }
) => {
  const docRef = doc(db, 'usuarios', userId, 'favoritos', restaurante.id);
  await setDoc(docRef, restaurante);
};

export const removerFavorito = async (userId: string, restauranteId: string) => {
  const docRef = doc(db, 'usuarios', userId, 'favoritos', restauranteId);
  await deleteDoc(docRef);
};

export const verificarFavorito = async (
  userId: string,
  restauranteId: string
): Promise<boolean> => {
  const docRef = doc(db, 'usuarios', userId, 'favoritos', restauranteId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
};
