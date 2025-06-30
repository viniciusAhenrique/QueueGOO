import { auth } from '@/firebaseconfig';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { useEffect, useState } from 'react';

const useAuth = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (userLogged: User | null) => {
      setUser(userLogged);
    });

    return () => unsubscribe();
  }, []);

  return { user, logout };
};

export default useAuth;