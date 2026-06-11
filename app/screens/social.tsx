import { MaterialIcons } from '@expo/vector-icons';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from '@/firebaseconfig';
import { criarNotificacaoUsuario } from '@/src/services/pushNotificationService';
import {
  buscarRestaurantesPorTexto,
  RestauranteResumo,
} from '@/src/services/restauranteServices';
import { isValidEmail, normalizeEmail, splitValidEmails } from '@/src/utils/validation';

function normalizarBuscaUsuario(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

type Comentario = {
  id: string;
  uid: string;
  nome: string;
  foto: string | null;
  texto: string;
  criadoEm: string;
};

type Amigo = {
  uid: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
};

type Evento = {
  id: string;
  titulo: string;
  local: string;
  data: string;
  hora: string;
  descricao: string;
  convidados: string[];
  convidadoUids: string[];
  participantes: string[];
  criadoPor: string;
  criadorNome: string;
  criadorFoto: string | null;
  comentarios: Comentario[];
  link: string;
  status: string;
  respostas: Record<string, string>;
  ocultoPara: string[];
};

type Aba = 'feed' | 'meus' | 'amigos';

const EVENTOS_COLLECTION = 'eventos_sociais';
const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

function normalizarEmails(valor: string) {
  return splitValidEmails(valor);
}

function ordenarEvento(a: Evento, b: Evento) {
  const dataA = new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime();
  const dataB = new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime();

  if (Number.isNaN(dataA) && Number.isNaN(dataB)) return 0;
  if (Number.isNaN(dataA)) return 1;
  if (Number.isNaN(dataB)) return -1;
  return dataA - dataB;
}

function avatarFallback(uid: string) {
  return `https://i.pravatar.cc/120?u=${uid}`;
}

function formatarDataEvento(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarHoraEvento(data: Date) {
  return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function criarDataInicial(data?: string, hora?: string) {
  if (!data) return new Date();

  const valor = new Date(`${data}T${hora || '20:00'}:00`);
  return Number.isNaN(valor.getTime()) ? new Date() : valor;
}

export default function Social() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    novoEvento?: string;
    local?: string;
    placeId?: string;
    data?: string;
    hora?: string;
    pessoas?: string;
    convidarUid?: string;
    convidarNome?: string;
    convidarEmail?: string;
    convidarFoto?: string;
  }>();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [aba, setAba] = useState<Aba>('feed');
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [amigosSelecionados, setAmigosSelecionados] = useState<string[]>([]);
  const [convidadosAppSelecionados, setConvidadosAppSelecionados] = useState<Amigo[]>([]);
  const [novoAmigoEmail, setNovoAmigoEmail] = useState('');
  const [convidadoBusca, setConvidadoBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(params.novoEvento === '1');
  const [comentariosDraft, setComentariosDraft] = useState<Record<string, string>>({});
  const [buscaLocal, setBuscaLocal] = useState(params.local || '');
  const [resultadosLocal, setResultadosLocal] = useState<RestauranteResumo[]>([]);
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState(() =>
    criarDataInicial(params.data, params.hora),
  );
  const [form, setForm] = useState({
    titulo: params.local ? `Encontro no ${params.local}` : '',
    local: params.local || '',
    placeId: params.placeId || '',
    data: params.data || '',
    hora: params.hora || '',
    descricao: params.pessoas ? `Reserva para ${params.pessoas} pessoas.` : '',
    convidados: '',
  });

  const emailUsuario = user?.email?.toLowerCase() || '';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const termo = buscaLocal.trim();
    if (termo.length < 2 || termo === form.local) {
      setResultadosLocal([]);
      setBuscandoLocal(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setBuscandoLocal(true);
      try {
        const resultados = await buscarRestaurantesPorTexto(termo);
        setResultadosLocal(resultados.slice(0, 5));
      } catch (error) {
        console.error('Erro ao buscar restaurantes para evento:', error);
        setResultadosLocal([]);
      } finally {
        setBuscandoLocal(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [buscaLocal, form.local]);

  useEffect(() => {
    if (!user) {
      setEventos([]);
      setCarregando(false);
      return undefined;
    }

    setCarregando(true);
    const unsubscribe = onSnapshot(
      collection(db, EVENTOS_COLLECTION),
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => {
          const dados = documento.data();
          return {
            id: documento.id,
            titulo: String(dados.titulo || ''),
            local: String(dados.local || ''),
            data: String(dados.data || ''),
            hora: String(dados.hora || ''),
            descricao: String(dados.descricao || ''),
            convidados: Array.isArray(dados.convidados) ? dados.convidados : [],
            convidadoUids: Array.isArray(dados.convidadoUids) ? dados.convidadoUids : [],
            participantes: Array.isArray(dados.participantes) ? dados.participantes : [],
            criadoPor: String(dados.criadoPor || ''),
            criadorNome: String(dados.criadorNome || 'Usuario'),
            criadorFoto: typeof dados.criadorFoto === 'string' ? dados.criadorFoto : null,
            comentarios: Array.isArray(dados.comentarios) ? dados.comentarios : [],
            link: String(dados.link || ''),
            status: String(dados.status || 'ativo'),
            respostas:
              dados.respostas && typeof dados.respostas === 'object'
                ? (dados.respostas as Record<string, string>)
                : {},
            ocultoPara: Array.isArray(dados.ocultoPara) ? dados.ocultoPara : [],
          };
        });

        setEventos(
          lista
            .filter((evento) => evento.status !== 'cancelado')
            .filter((evento) => !evento.ocultoPara.includes(user.uid))
            .sort(ordenarEvento),
        );
        setCarregando(false);
      },
      (error) => {
        console.error('Erro ao carregar eventos:', error);
        Alert.alert('Erro', 'Nao foi possivel carregar os eventos.');
        setCarregando(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = onSnapshot(
      collection(db, 'usuarios', user.uid, 'amigos'),
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => {
          const dados = documento.data();
          return {
            uid: documento.id,
            nome: String(dados.nome || dados.email || 'Amigo'),
            email: String(dados.email || ''),
            fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
          };
        });

        setAmigos(lista);
      },
      (error) => {
        console.error('Erro ao carregar amigos:', error);
        setAmigos([]);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const eventosFiltrados = useMemo(() => {
    if (aba === 'feed') return eventos;

    if (aba === 'amigos') {
      const friendIds = new Set(amigos.map((amigo) => amigo.uid));
      return eventos.filter((evento) => friendIds.has(evento.criadoPor));
    }

    return eventos.filter(
      (evento) =>
        evento.criadoPor === user?.uid ||
        evento.participantes.includes(user?.uid || '') ||
        evento.convidadoUids.includes(user?.uid || '') ||
        evento.convidados.includes(emailUsuario),
    );
  }, [aba, amigos, emailUsuario, eventos, user?.uid]);

  const amigosEscolhidos = useMemo(() => {
    const selecionados = amigos.filter((amigo) => amigosSelecionados.includes(amigo.uid));
    const porUid = new Map<string, Amigo>();

    [...selecionados, ...convidadosAppSelecionados].forEach((amigo) => {
      porUid.set(amigo.uid, amigo);
    });

    return Array.from(porUid.values());
  }, [amigos, amigosSelecionados, convidadosAppSelecionados]);

  useEffect(() => {
    if (!params.convidarUid) return;

    const convidado: Amigo = {
      uid: params.convidarUid,
      nome: params.convidarNome || params.convidarEmail || 'Convidado',
      email: String(params.convidarEmail || '').toLowerCase(),
      fotoUrl: params.convidarFoto || null,
    };

    setFormAberto(true);
    setAba('meus');
    setConvidadosAppSelecionados((atuais) =>
      atuais.some((item) => item.uid === convidado.uid) ? atuais : [...atuais, convidado],
    );
  }, [params.convidarEmail, params.convidarFoto, params.convidarNome, params.convidarUid]);

  const alternarAmigoSelecionado = (uid: string) => {
    setAmigosSelecionados((atuais) =>
      atuais.includes(uid) ? atuais.filter((item) => item !== uid) : [...atuais, uid],
    );
  };

  const buscarUsuarioPorNomeOuEmail = async (termoBusca: string) => {
    const termoNormalizado = normalizarBuscaUsuario(termoBusca);

    if (isValidEmail(normalizeEmail(termoBusca))) {
      const email = normalizeEmail(termoBusca);
      const buscaPorLower = await getDocs(
        query(collection(db, 'usuarios'), where('emailLower', '==', email), limit(1)),
      );
      const buscaPorEmail = buscaPorLower.empty
        ? await getDocs(query(collection(db, 'usuarios'), where('email', '==', email), limit(1)))
        : buscaPorLower;

      return buscaPorEmail.empty ? null : buscaPorEmail.docs[0];
    }

    const usuariosSnapshot = await getDocs(query(collection(db, 'usuarios'), limit(100)));
    return usuariosSnapshot.docs.find((docUsuario) => {
      const dadosUsuario = docUsuario.data();
      const nome = normalizarBuscaUsuario(String(dadosUsuario.nome || ''));
      const emailUsuarioEncontrado = normalizarBuscaUsuario(String(dadosUsuario.email || ''));

      return nome.includes(termoNormalizado) || emailUsuarioEncontrado.includes(termoNormalizado);
    }) || null;
  };

  const documentoParaAmigo = (documento: Awaited<ReturnType<typeof buscarUsuarioPorNomeOuEmail>>): Amigo | null => {
    if (!documento) return null;

    const dados = documento.data();
    return {
      uid: documento.id,
      nome: String(dados.nome || dados.email || 'Usuario'),
      email: String(dados.email || '').toLowerCase(),
      fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
    };
  };

  const adicionarAmigo = async () => {
    if (!user) return;

    const termoBusca = novoAmigoEmail.trim();
    const termoNormalizado = normalizarBuscaUsuario(termoBusca);
    const pareceEmail = termoBusca.includes('@');

    if (!termoBusca) {
      Alert.alert('Informe um usuario', 'Digite o nome ou email de alguem cadastrado no app.');
      return;
    }
    if (pareceEmail && !isValidEmail(normalizeEmail(termoBusca))) {
      Alert.alert('Email invalido', 'Digite um email valido para adicionar um amigo.');
      return;
    }

    if (
      termoNormalizado === normalizarBuscaUsuario(emailUsuario) ||
      termoNormalizado === normalizarBuscaUsuario(user.displayName || '')
    ) {
      Alert.alert('Calma ai', 'Voce ja esta no app como voce mesmo.');
      return;
    }

    try {
      let documento = null;

      if (isValidEmail(normalizeEmail(termoBusca))) {
        const email = normalizeEmail(termoBusca);
        const buscaPorLower = await getDocs(
          query(collection(db, 'usuarios'), where('emailLower', '==', email), limit(1)),
        );
        const buscaPorEmail = buscaPorLower.empty
          ? await getDocs(query(collection(db, 'usuarios'), where('email', '==', email), limit(1)))
          : buscaPorLower;

        documento = buscaPorEmail.empty ? null : buscaPorEmail.docs[0];
      } else {
        const usuariosSnapshot = await getDocs(query(collection(db, 'usuarios'), limit(100)));
        documento = usuariosSnapshot.docs.find((docUsuario) => {
          const dadosUsuario = docUsuario.data();
          const nome = normalizarBuscaUsuario(String(dadosUsuario.nome || ''));
          const emailUsuarioEncontrado = normalizarBuscaUsuario(String(dadosUsuario.email || ''));

          return nome.includes(termoNormalizado) || emailUsuarioEncontrado.includes(termoNormalizado);
        }) || null;
      }

      if (!documento) {
        Alert.alert('Nao encontrado', 'Nenhum usuario cadastrado com esse nome ou email.');
        return;
      }

      if (documento.id === user.uid) {
        Alert.alert('Calma ai', 'Voce ja esta no app como voce mesmo.');
        return;
      }

      const dados = documento.data();
      const amigo: Amigo = {
        uid: documento.id,
        nome: String(dados.nome || dados.email || 'Amigo'),
        email: String(dados.email || termoBusca).toLowerCase(),
        fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
      };

      if (amigos.some((item) => item.uid === amigo.uid)) {
        Alert.alert('Ja e amigo', 'Esse usuario ja esta na sua lista de amigos.');
        return;
      }

      const pedidoRef = await addDoc(collection(db, 'amizades'), {
        fromUid: user.uid,
        fromNome: user.displayName || user.email || 'Usuario',
        fromEmail: emailUsuario,
        fromFoto: user.photoURL || null,
        toUid: amigo.uid,
        toNome: amigo.nome,
        toEmail: amigo.email,
        toFoto: amigo.fotoUrl,
        status: 'pendente',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });

      await criarNotificacaoUsuario(amigo.uid, {
        tipo: 'amizade',
        titulo: 'Pedido de amizade',
        mensagem: `${user.displayName || user.email || 'Alguem'} quer se conectar com voce.`,
        amizadeId: pedidoRef.id,
        remetenteUid: user.uid,
      });

      setNovoAmigoEmail('');
      Alert.alert('Pedido enviado', 'A amizade so aparece quando a pessoa aceitar.');
    } catch (error) {
      console.error('Erro ao adicionar amigo:', error);
      Alert.alert('Erro', 'Nao foi possivel adicionar este amigo.');
    }
  };

  const adicionarConvidadoAoEvento = async () => {
    if (!user) return;

    const termoBusca = convidadoBusca.trim();
    if (!termoBusca) {
      Alert.alert('Quem voce quer chamar?', 'Digite nome ou email de alguem do app, ou um email externo.');
      return;
    }

    try {
      const documento = await buscarUsuarioPorNomeOuEmail(termoBusca);
      const amigo = documentoParaAmigo(documento);

      if (amigo) {
        if (amigo.uid === user.uid) {
          Alert.alert('Esse e voce', 'Voce ja entra como confirmado no evento.');
          return;
        }

        if (amigos.some((item) => item.uid === amigo.uid)) {
          setAmigosSelecionados((atuais) =>
            atuais.includes(amigo.uid) ? atuais : [...atuais, amigo.uid],
          );
        } else {
          setConvidadosAppSelecionados((atuais) =>
            atuais.some((item) => item.uid === amigo.uid) ? atuais : [...atuais, amigo],
          );
        }

        setConvidadoBusca('');
        return;
      }

      if (isValidEmail(normalizeEmail(termoBusca))) {
        const email = normalizeEmail(termoBusca);
        setForm((current) => {
          const emails = new Set(normalizarEmails(current.convidados));
          emails.add(email);
          return { ...current, convidados: Array.from(emails).join(', ') };
        });
        setConvidadoBusca('');
        return;
      }

      Alert.alert('Nao encontrado', 'Nao achei usuario com esse nome. Para convidar alguem de fora, digite o email completo.');
    } catch (error) {
      console.error('Erro ao adicionar convidado ao evento:', error);
      Alert.alert('Erro', 'Nao foi possivel adicionar esse convidado agora.');
    }
  };

  const notificarConvidados = async (
    eventId: string,
    titulo: string,
    link: string,
    convidados: Amigo[],
  ) => {
    await Promise.all(
      convidados.map((amigo) =>
        criarNotificacaoUsuario(amigo.uid, {
          tipo: 'evento',
          titulo: 'Novo convite',
          mensagem: `${user?.displayName || user?.email || 'Alguem'} chamou voce para ${titulo}.`,
          eventoId: eventId,
          link,
        }),
      ),
    );
  };

  const criarTextoConviteEvento = (
    evento: { titulo: string; local: string; data: string; hora: string; descricao?: string },
    link: string,
  ) => {
    const quando = [evento.data, evento.hora && `as ${evento.hora}`].filter(Boolean).join(' ');
    const descricao = evento.descricao?.trim();

    return [
      `Voce foi convidado para: ${evento.titulo}`,
      '',
      `Local: ${evento.local}`,
      `Quando: ${quando}`,
      descricao ? `Detalhes: ${descricao}` : null,
      '',
      'Confirme sua presenca e acompanhe a conversa pelo QueueGOO:',
      link,
    ].filter(Boolean).join('\n');
  };

  const compartilharEvento = (
    evento: { titulo: string; local: string; data: string; hora: string; descricao?: string },
    link: string,
  ) => {
    const emails = Array.from(
      new Set([...normalizarEmails(form.convidados), ...amigosEscolhidos.map((amigo) => amigo.email)]),
    ).filter(Boolean);
    const texto = criarTextoConviteEvento(evento, link);
    const assunto = `Convite: ${evento.titulo}`;

    Alert.alert('Evento criado', 'Notificacoes internas foram enviadas. Compartilhe tambem:', [
      ...(emails.length
        ? [{
            text: 'Email',
            onPress: () =>
              Linking.openURL(
                `mailto:${emails.join(',')}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`,
              ),
          }]
        : []),
      {
        text: 'WhatsApp',
        onPress: () => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`),
      },
      { text: 'Depois', style: 'cancel' },
    ]);
  };

  const criarEvento = async () => {
    if (!user) {
      Alert.alert('Login necessario', 'Entre na sua conta para criar eventos.');
      return;
    }

    if (!form.titulo.trim() || !form.local.trim() || !form.data.trim()) {
      Alert.alert('Dados incompletos', 'Informe titulo, local e data.');
      return;
    }

    const emailsDigitados = normalizarEmails(form.convidados);
    const emailInvalido = emailsDigitados.find((email) => !isValidEmail(email));
    if (emailInvalido) {
      Alert.alert('Email invalido', `Confira o email: ${emailInvalido}`);
      return;
    }

    setSalvando(true);
    try {
      const emails = Array.from(
        new Set([...emailsDigitados, ...amigosEscolhidos.map((amigo) => amigo.email)]),
      );
      const convidadoUids = amigosEscolhidos.map((amigo) => amigo.uid);

      const docRef = await addDoc(collection(db, EVENTOS_COLLECTION), {
        titulo: form.titulo.trim(),
        local: form.local.trim(),
        placeId: form.placeId || null,
        data: form.data.trim(),
        hora: form.hora.trim(),
        descricao: form.descricao.trim(),
        convidados: emails,
        convidadoUids,
        participantes: [user.uid],
        criadoPor: user.uid,
        criadorNome: user.displayName || user.email || 'Usuario',
        criadorFoto: user.photoURL || null,
        comentarios: [],
        respostas: { [user.uid]: 'aceito' },
        status: 'ativo',
        ocultoPara: [],
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });

      const link = ExpoLinking.createURL(`/screens/evento?eventId=${docRef.id}`);
      await updateDoc(docRef, { link });
      await notificarConvidados(docRef.id, form.titulo.trim(), link, amigosEscolhidos);

      compartilharEvento(
        {
          titulo: form.titulo.trim(),
          local: form.local.trim(),
          data: form.data.trim(),
          hora: form.hora.trim(),
          descricao: form.descricao.trim(),
        },
        link,
      );

      setForm({ titulo: '', local: '', placeId: '', data: '', hora: '', descricao: '', convidados: '' });
      setBuscaLocal('');
      setAmigosSelecionados([]);
      setConvidadosAppSelecionados([]);
      setConvidadoBusca('');
      setFormAberto(false);
      setAba('meus');
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      Alert.alert('Erro', 'Nao foi possivel criar o evento.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarPresenca = async (evento: Evento) => {
    if (!user) {
      Alert.alert('Login necessario', 'Entre na sua conta para participar.');
      return;
    }

    const participa = evento.participantes.includes(user.uid);
    try {
      await updateDoc(doc(db, EVENTOS_COLLECTION, evento.id), {
        participantes: participa ? arrayRemove(user.uid) : arrayUnion(user.uid),
        atualizadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao atualizar presenca:', error);
      Alert.alert('Erro', 'Nao foi possivel atualizar sua presenca.');
    }
  };

  const comentarEvento = async (evento: Evento) => {
    if (!user) return;

    const texto = comentariosDraft[evento.id]?.trim();
    if (!texto) return;

    const comentario: Comentario = {
      id: `${user.uid}-${Date.now()}`,
      uid: user.uid,
      nome: user.displayName || user.email || 'Usuario',
      foto: user.photoURL || null,
      texto,
      criadoEm: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, EVENTOS_COLLECTION, evento.id), {
        comentarios: arrayUnion(comentario),
        atualizadoEm: serverTimestamp(),
      });

      if (evento.criadoPor !== user.uid) {
        await criarNotificacaoUsuario(evento.criadoPor, {
          tipo: 'comentario',
          titulo: 'Novo comentario',
          mensagem: `${comentario.nome} comentou em ${evento.titulo}.`,
          eventoId: evento.id,
          link: evento.link,
        });
      }

      setComentariosDraft((atuais) => ({ ...atuais, [evento.id]: '' }));
    } catch (error) {
      console.error('Erro ao comentar:', error);
      Alert.alert('Erro', 'Nao foi possivel comentar.');
    }
  };

  const responderConvite = async (evento: Evento, resposta: 'aceito' | 'recusado') => {
    if (!user) return;

    try {
      await updateDoc(doc(db, EVENTOS_COLLECTION, evento.id), {
        [`respostas.${user.uid}`]: resposta,
        participantes: resposta === 'aceito' ? arrayUnion(user.uid) : arrayRemove(user.uid),
        atualizadoEm: serverTimestamp(),
      });

      if (evento.criadoPor !== user.uid) {
        await criarNotificacaoUsuario(evento.criadoPor, {
          tipo: 'evento',
          titulo: resposta === 'aceito' ? 'Convite aceito' : 'Convite recusado',
          mensagem: `${user.displayName || user.email || 'Alguem'} ${
            resposta === 'aceito' ? 'aceitou' : 'recusou'
          } o convite para ${evento.titulo}.`,
          eventoId: evento.id,
          remetenteUid: user.uid,
        });
      }
    } catch (error) {
      console.error('Erro ao responder convite:', error);
      Alert.alert('Erro', 'Nao foi possivel responder ao convite.');
    }
  };

  const selecionarLocal = (restaurante: RestauranteResumo) => {
    setBuscaLocal(restaurante.nome);
    setResultadosLocal([]);
    setForm((current) => ({
      ...current,
      local: restaurante.nome,
      placeId: restaurante.google_place_id,
      titulo: current.titulo || `Encontro no ${restaurante.nome}`,
    }));
  };

  const usarLocalDigitado = () => {
    const local = buscaLocal.trim();
    if (!local) return;

    setResultadosLocal([]);
    setForm((current) => ({
      ...current,
      local,
      placeId: '',
      titulo: current.titulo || `Encontro no ${local}`,
    }));
  };

  const removerDaMinhaLista = (evento: Evento) => {
    if (!user) return;

    Alert.alert('Remover evento?', 'Ele sai apenas da sua lista. O evento continua para as outras pessoas.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, EVENTOS_COLLECTION, evento.id), {
              ocultoPara: arrayUnion(user.uid),
              participantes: arrayRemove(user.uid),
              [`respostas.${user.uid}`]: 'removido',
              atualizadoEm: serverTimestamp(),
            });
          } catch (error) {
            console.error('Erro ao remover evento da lista:', error);
            Alert.alert('Erro', 'Nao foi possivel remover este evento da sua lista.');
          }
        },
      },
    ]);
  };

  const atualizarDataEvento = (novaData: Date) => {
    setDataSelecionada(novaData);
    setForm((current) => ({
      ...current,
      data: formatarDataEvento(novaData),
      hora: current.hora || formatarHoraEvento(novaData),
    }));
  };

  const atualizarHoraEvento = (novaHora: Date) => {
    const proximaData = new Date(dataSelecionada);
    proximaData.setHours(novaHora.getHours(), novaHora.getMinutes(), 0, 0);
    setDataSelecionada(proximaData);
    setForm((current) => ({
      ...current,
      data: current.data || formatarDataEvento(proximaData),
      hora: formatarHoraEvento(proximaData),
    }));
  };

  const renderEvento = (evento: Evento) => {
    const participa = Boolean(user && evento.participantes.includes(user.uid));
    const convidado = Boolean(
      user &&
        (evento.convidadoUids.includes(user.uid) || evento.convidados.includes(emailUsuario)),
    );
    const respostaAtual = user ? evento.respostas[user.uid] : undefined;
    const cancelado = evento.status === 'cancelado';
    const avatar = evento.criadorFoto || avatarFallback(evento.criadoPor);

    return (
      <View key={evento.id} style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <Image source={{ uri: avatar }} style={styles.eventAvatar} />
          <View style={styles.eventHeaderText}>
            <Text style={styles.creatorName}>{evento.criadorNome}</Text>
            <Text style={styles.eventMeta}>
              {evento.data} {evento.hora ? `as ${evento.hora}` : ''}
            </Text>
          </View>
          {convidado && (
            <View style={[styles.inviteBadge, respostaAtual === 'recusado' && styles.inviteBadgeMuted]}>
              <Text style={styles.inviteBadgeText}>
                {respostaAtual === 'aceito' ? 'Aceito' : respostaAtual === 'recusado' ? 'Recusado' : 'Convite'}
              </Text>
            </View>
          )}
          {cancelado && (
            <View style={styles.cancelBadge}>
              <Text style={styles.cancelBadgeText}>Cancelado</Text>
            </View>
          )}
        </View>

        <Text style={styles.eventTitle}>{evento.titulo}</Text>
        <View style={styles.eventLocationRow}>
          <MaterialIcons name="place" size={16} color={BLUE_DARK} />
          <Text style={styles.eventLocation}>{evento.local}</Text>
        </View>

        {evento.descricao ? <Text style={styles.eventDescription}>{evento.descricao}</Text> : null}

        {convidado && !respostaAtual && !cancelado && (
          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => responderConvite(evento, 'aceito')}
            >
              <MaterialIcons name="check" size={18} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Aceitar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => responderConvite(evento, 'recusado')}
            >
              <MaterialIcons name="close" size={18} color="#9F1239" />
              <Text style={styles.declineButtonText}>Recusar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.eventFooter}>
          <View style={styles.peoplePill}>
            <MaterialIcons name="group" size={16} color={INK} />
            <Text style={styles.peopleText}>{evento.participantes.length} confirmados</Text>
          </View>
          <TouchableOpacity
            style={[styles.presenceButton, participa && styles.presenceButtonActive]}
            onPress={() => alternarPresenca(evento)}
          >
            <MaterialIcons
              name={participa ? 'check-circle' : 'person-add'}
              size={18}
              color={participa ? BLUE_DARK : '#FFFFFF'}
            />
            <Text style={[styles.presenceText, participa && styles.presenceTextActive]}>
              {participa ? 'Confirmado' : 'Participar'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() =>
            router.push({
              pathname: '/screens/evento' as never,
              params: { eventId: evento.id },
            })
          }
        >
          <MaterialIcons name="forum" size={18} color={BLUE_DARK} />
          <Text style={styles.detailsButtonText}>Detalhes e conversa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.removeEventButton}
          onPress={() => removerDaMinhaLista(evento)}
        >
          <MaterialIcons name="visibility-off" size={18} color="#4B5563" />
          <Text style={styles.removeEventButtonText}>Remover da minha lista</Text>
        </TouchableOpacity>

        <View style={styles.comments}>
          {evento.comentarios.slice(-3).map((comentario) => (
            <View key={comentario.id} style={styles.commentRow}>
              <Image
                source={{ uri: comentario.foto || avatarFallback(comentario.uid) }}
                style={styles.commentAvatar}
              />
              <Text style={styles.commentText}>
                <Text style={styles.commentName}>{comentario.nome} </Text>
                {comentario.texto}
              </Text>
            </View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={comentariosDraft[evento.id] || ''}
              onChangeText={(texto) =>
                setComentariosDraft((atuais) => ({ ...atuais, [evento.id]: texto }))
              }
              placeholder="Comentar"
              placeholderTextColor="#667085"
            />
            <TouchableOpacity style={styles.commentButton} onPress={() => comentarEvento(evento)}>
              <MaterialIcons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialIcons name="lock" size={34} color={BLUE_DARK} />
          <Text style={styles.emptyTitle}>Entre para ver eventos</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/screens/login')}>
            <Text style={styles.primaryButtonText}>Ir para login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Eventos</Text>
            <Text style={styles.headerSubtitle}>Feed, amigos e convites</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setFormAberto((value) => !value)}>
            <MaterialIcons name={formAberto ? 'close' : 'add'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {(['feed', 'meus', 'amigos'] as Aba[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, aba === tab && styles.tabActive]}
              onPress={() => setAba(tab)}
            >
              <Text style={[styles.tabText, aba === tab && styles.tabTextActive]}>
                {tab === 'feed' ? 'Feed' : tab === 'meus' ? 'Meus' : 'Amigos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.friendPanel}>
            <Text style={styles.panelTitle}>Amigos no app</Text>
            <View style={styles.friendAddRow}>
              <TextInput
                style={styles.friendInput}
                value={novoAmigoEmail}
                onChangeText={setNovoAmigoEmail}
                placeholder="nome ou email do amigo"
                placeholderTextColor="#667085"
                autoCapitalize="words"
                keyboardType="default"
              />
              <TouchableOpacity style={styles.friendAddButton} onPress={adicionarAmigo}>
                <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.friendChips}>
                {amigos.map((amigo) => (
                  <View key={amigo.uid} style={styles.friendChip}>
                    <Image
                      source={{ uri: amigo.fotoUrl || avatarFallback(amigo.uid) }}
                      style={styles.friendChipAvatar}
                    />
                    <Text style={styles.friendChipText} numberOfLines={1}>{amigo.nome}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {formAberto && (
            <View style={styles.formPanel}>
              <Text style={styles.panelTitle}>Novo evento</Text>
              <TextInput
                style={styles.input}
                value={form.titulo}
                onChangeText={(titulo) => setForm((current) => ({ ...current, titulo }))}
                placeholder="Nome do evento"
                placeholderTextColor="#667085"
              />
              <View style={styles.localSearch}>
                <TextInput
                  style={styles.input}
                  value={buscaLocal}
                  onChangeText={(local) => {
                    setBuscaLocal(local);
                    setForm((current) => ({ ...current, local, placeId: '' }));
                  }}
                placeholder="Buscar restaurante ou mercado"
                  placeholderTextColor="#667085"
                />
                <Text style={styles.helperText}>
                  Busque qualquer restaurante ou use o local digitado.
                </Text>
                {buscandoLocal && <ActivityIndicator color={BLUE_DARK} style={styles.localLoader} />}
                {resultadosLocal.length > 0 && (
                  <View style={styles.localResults}>
                    {resultadosLocal.map((restaurante) => (
                      <TouchableOpacity
                        key={restaurante.google_place_id}
                        style={styles.localResultItem}
                        onPress={() => selecionarLocal(restaurante)}
                      >
                        <View style={styles.localResultIcon}>
                          <MaterialIcons name="restaurant" size={18} color={BLUE_DARK} />
                        </View>
                        <View style={styles.localResultText}>
                          <Text style={styles.localResultName} numberOfLines={1}>
                            {restaurante.nome}
                          </Text>
                          <Text style={styles.localResultAddress} numberOfLines={1}>
                            {restaurante.endereco || 'Local encontrado pelo QueueGOO'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {!!buscaLocal.trim() && buscaLocal.trim() !== form.local && (
                  <TouchableOpacity style={styles.useTypedLocalButton} onPress={usarLocalDigitado}>
                    <MaterialIcons name="add-location-alt" size={18} color={BLUE_DARK} />
                    <Text style={styles.useTypedLocalText}>
                      Usar {buscaLocal.trim()} como local
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.formRow}>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.inputHalf]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialIcons name="event" size={18} color={BLUE_DARK} />
                  <Text style={styles.pickerButtonText}>{form.data || 'Selecionar data'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.inputHalf]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <MaterialIcons name="schedule" size={18} color={BLUE_DARK} />
                  <Text style={styles.pickerButtonText}>{form.hora || 'Selecionar hora'}</Text>
                </TouchableOpacity>
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={dataSelecionada}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) atualizarDataEvento(selectedDate);
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={dataSelecionada}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, selectedTime) => {
                    setShowTimePicker(false);
                    if (selectedTime) atualizarHoraEvento(selectedTime);
                  }}
                />
              )}
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.descricao}
                onChangeText={(descricao) => setForm((current) => ({ ...current, descricao }))}
                placeholder="Descricao"
                placeholderTextColor="#667085"
                multiline
              />

              {amigos.length > 0 && (
                <View style={styles.selectFriends}>
                  <Text style={styles.smallLabel}>Selecionar amigos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.friendChips}>
                      {amigos.map((amigo) => {
                        const selected = amigosSelecionados.includes(amigo.uid);
                        return (
                          <TouchableOpacity
                            key={amigo.uid}
                            style={[styles.selectFriendChip, selected && styles.selectFriendChipActive]}
                            onPress={() => alternarAmigoSelecionado(amigo.uid)}
                          >
                            <Image
                              source={{ uri: amigo.fotoUrl || avatarFallback(amigo.uid) }}
                              style={styles.friendChipAvatar}
                            />
                            <Text
                              style={[styles.selectFriendText, selected && styles.selectFriendTextActive]}
                              numberOfLines={1}
                            >
                              {amigo.nome}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={styles.inviteSearchPanel}>
                <Text style={styles.smallLabel}>Adicionar convidados</Text>
                <View style={styles.inviteSearchRow}>
                  <TextInput
                    style={styles.inviteSearchInput}
                    value={convidadoBusca}
                    onChangeText={setConvidadoBusca}
                    placeholder="Nome, email do app ou email externo"
                    placeholderTextColor="#667085"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity style={styles.inviteAddButton} onPress={adicionarConvidadoAoEvento}>
                    <MaterialIcons name="person-add-alt" size={19} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>
                  Amigos recebem notificacao no app. Emails externos entram no convite por email/WhatsApp.
                </Text>
              </View>

              {amigosEscolhidos.length > 0 && (
                <View style={styles.selectedInvitePanel}>
                  <Text style={styles.smallLabel}>Convidados do app</Text>
                  <View style={styles.selectedInviteWrap}>
                    {amigosEscolhidos.map((amigo) => (
                      <View key={amigo.uid} style={styles.selectedInviteChip}>
                        <Image
                          source={{ uri: amigo.fotoUrl || avatarFallback(amigo.uid) }}
                          style={styles.selectedInviteAvatar}
                        />
                        <Text style={styles.selectedInviteText} numberOfLines={1}>{amigo.nome}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setAmigosSelecionados((atuais) => atuais.filter((uid) => uid !== amigo.uid));
                            setConvidadosAppSelecionados((atuais) => atuais.filter((item) => item.uid !== amigo.uid));
                          }}
                        >
                          <MaterialIcons name="close" size={16} color={BLUE_DARK} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <TextInput
                style={styles.input}
                value={form.convidados}
                onChangeText={(convidados) => setForm((current) => ({ ...current, convidados }))}
                placeholder="Emails extras, separados por virgula"
                placeholderTextColor="#667085"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                style={[styles.primaryButton, salvando && styles.disabledButton]}
                onPress={criarEvento}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Publicar evento</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {carregando ? (
            <ActivityIndicator color={BLUE_DARK} style={styles.loader} />
          ) : eventosFiltrados.length ? (
            eventosFiltrados.map(renderEvento)
          ) : (
            <View style={styles.emptyFeed}>
              <MaterialIcons name="event-busy" size={32} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Nenhum evento por aqui</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_DARK,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: INK,
    textAlign: 'center',
  },
  headerSubtitle: { fontSize: 12, color: '#3B5366', textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 18,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#BBDEFB',
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#3B5366', fontFamily: 'Urbanist_600SemiBold' },
  tabTextActive: { color: INK },
  content: { flex: 1 },
  contentInner: { padding: 18, paddingBottom: 40 },
  friendPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    marginBottom: 16,
  },
  notificationsPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    marginBottom: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: '#E3F2FD',
    paddingTop: 10,
    marginTop: 6,
  },
  notificationIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: INK,
    fontFamily: 'Urbanist_700Bold',
    fontSize: 14,
  },
  notificationMessage: {
    color: '#4B6475',
    fontSize: 13,
    marginTop: 2,
  },
  panelTitle: {
    color: INK,
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    marginBottom: 10,
  },
  friendAddRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  friendInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 12,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  friendAddButton: {
    width: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_DARK,
  },
  friendChips: { flexDirection: 'row', gap: 8 },
  friendChip: {
    maxWidth: 130,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: '#E3F2FD',
  },
  friendChipAvatar: { width: 26, height: 26, borderRadius: 13 },
  friendChipText: { color: INK, fontFamily: 'Urbanist_700Bold', maxWidth: 86 },
  formPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    marginBottom: 16,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  localSearch: {
    position: 'relative',
    zIndex: 4,
  },
  localLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  localResults: {
    marginTop: -6,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  localResultItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E3F2FD',
  },
  localResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  localResultText: {
    flex: 1,
  },
  localResultName: {
    color: INK,
    fontFamily: 'Urbanist_700Bold',
    fontSize: 14,
  },
  localResultAddress: {
    color: '#4B6475',
    fontSize: 12,
    marginTop: 2,
  },
  pickerButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerButtonText: {
    color: INK,
    fontFamily: 'Urbanist_700Bold',
    fontSize: 13,
    flexShrink: 1,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: INK,
    marginBottom: 10,
  },
  helperText: {
    color: '#4B6475',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
  useTypedLocalButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    marginBottom: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  useTypedLocalText: {
    color: BLUE_DARK,
    fontFamily: 'Urbanist_700Bold',
    flex: 1,
  },
  inputHalf: { flex: 1 },
  textArea: { minHeight: 86, paddingTop: 12, textAlignVertical: 'top' },
  selectFriends: { marginBottom: 10 },
  smallLabel: {
    color: INK,
    fontFamily: 'Urbanist_700Bold',
    fontSize: 13,
    marginBottom: 8,
  },
  selectFriendChip: {
    maxWidth: 140,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
  },
  selectFriendChipActive: { backgroundColor: BLUE_DARK, borderColor: BLUE_DARK },
  selectFriendText: { color: INK, fontFamily: 'Urbanist_700Bold', maxWidth: 92 },
  selectFriendTextActive: { color: '#FFFFFF' },
  inviteSearchPanel: { marginBottom: 10 },
  inviteSearchRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteSearchInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: INK,
  },
  inviteAddButton: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedInvitePanel: { marginBottom: 10 },
  selectedInviteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedInviteChip: {
    maxWidth: '100%',
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  selectedInviteAvatar: { width: 24, height: 24, borderRadius: 12 },
  selectedInviteText: { maxWidth: 180, color: BLUE_DARK, fontFamily: 'Urbanist_700Bold' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold', fontSize: 15 },
  disabledButton: { opacity: 0.7 },
  loader: { marginTop: 30 },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eventAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  eventHeaderText: { flex: 1 },
  creatorName: { fontFamily: 'Urbanist_700Bold', color: INK, fontSize: 15 },
  eventMeta: { color: '#3B5366', fontSize: 12, marginTop: 2 },
  inviteBadge: {
    backgroundColor: '#FFF4D6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inviteBadgeMuted: { backgroundColor: '#F1F5F9' },
  inviteBadgeText: { color: '#9A6700', fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  cancelBadge: {
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  cancelBadgeText: { color: '#9F1239', fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  eventTitle: {
    color: INK,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 8,
  },
  eventLocationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 4 },
  eventLocation: { color: BLUE_DARK, fontFamily: 'Urbanist_700Bold' },
  eventDescription: { color: '#344054', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  acceptButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold' },
  declineButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineButtonText: { color: '#9F1239', fontFamily: 'Urbanist_700Bold' },
  detailsButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#E3F2FD',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailsButtonText: { color: BLUE_DARK, fontFamily: 'Urbanist_700Bold' },
  removeEventButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  removeEventButtonText: { color: '#4B5563', fontFamily: 'Urbanist_700Bold' },
  peoplePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    minHeight: 38,
  },
  peopleText: { color: INK, fontSize: 13 },
  presenceButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  presenceButtonActive: { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: BLUE_DARK },
  presenceText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold', fontSize: 13 },
  presenceTextActive: { color: BLUE_DARK },
  comments: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#E3F2FD', paddingTop: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  commentAvatar: { width: 24, height: 24, borderRadius: 12 },
  commentText: { flex: 1, color: '#344054', fontSize: 13 },
  commentName: { color: INK, fontFamily: 'Urbanist_700Bold' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 10,
    color: INK,
  },
  commentButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_DARK,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyFeed: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, gap: 10 },
  emptyTitle: {
    fontSize: 17,
    color: INK,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
});
