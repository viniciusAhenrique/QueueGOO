import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, db } from '@/firebaseconfig';

type Reserva = {
  id: string;
  restauranteNome: string;
  cidade: string;
  data: string;
  hora: string;
  numPessoas: number;
  status: string;
  placeId: string;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

function statusLabel(status: string) {
  if (status === 'cancelada') return 'Cancelada';
  if (status === 'confirmada') return 'Confirmada';
  if (status === 'concluida') return 'Concluida';
  return 'Solicitada';
}

export default function Reservas() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setReservas([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const reservasQuery = query(collection(db, 'reservas'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      reservasQuery,
      (snapshot) => {
        setReservas(
          snapshot.docs.map((documento) => {
            const dados = documento.data();
            return {
              id: documento.id,
              restauranteNome: String(dados.restauranteNome || 'Restaurante'),
              cidade: String(dados.cidade || ''),
              data: String(dados.data || ''),
              hora: String(dados.hora || ''),
              numPessoas: Number(dados.numPessoas || 0),
              status: String(dados.status || 'solicitada_whatsapp'),
              placeId: String(dados.placeId || ''),
            };
          }),
        );
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar reservas:', error);
        setReservas([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const reservasOrdenadas = useMemo(
    () =>
      [...reservas].sort((a, b) =>
        `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`),
      ),
    [reservas],
  );

  const cancelarReserva = (reserva: Reserva) => {
    Alert.alert('Cancelar reserva?', 'A reserva sera marcada como cancelada no app.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'reservas', reserva.id), {
              status: 'cancelada',
              atualizadoEm: serverTimestamp(),
            });
          } catch (error) {
            console.error('Erro ao cancelar reserva:', error);
            Alert.alert('Erro', 'Nao foi possivel cancelar a reserva.');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialIcons name="lock" size={34} color={BLUE_DARK} />
          <Text style={styles.emptyTitle}>Entre para ver suas reservas</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/screens/login')}>
            <Text style={styles.primaryButtonText}>Ir para login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reservas</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/screens/mapa')}>
          <MaterialIcons name="map" size={21} color={INK} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={BLUE_DARK} style={styles.loader} />
      ) : (
        <FlatList
          data={reservasOrdenadas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="event-seat" size={34} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Nenhuma reserva ainda</Text>
              <Text style={styles.emptyText}>Quando voce reservar pelo WhatsApp, o registro aparece aqui.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <MaterialIcons name="restaurant" size={20} color={BLUE_DARK} />
                </View>
                <View style={styles.cardTitleArea}>
                  <Text style={styles.cardTitle}>{item.restauranteNome}</Text>
                  <Text style={styles.cardSubtitle}>{item.cidade || 'Local nao informado'}</Text>
                </View>
                <View style={[styles.statusBadge, item.status === 'cancelada' && styles.statusBadgeDanger]}>
                  <Text style={[styles.statusText, item.status === 'cancelada' && styles.statusTextDanger]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <Info icon="event" label="Data" value={item.data || '-'} />
                <Info icon="schedule" label="Horario" value={item.hora || '-'} />
                <Info icon="group" label="Pessoas" value={String(item.numPessoas || '-')} />
              </View>

              {item.status !== 'cancelada' && (
                <TouchableOpacity style={styles.cancelButton} onPress={() => cancelarReserva(item)}>
                  <MaterialIcons name="event-busy" size={18} color="#9F1239" />
                  <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

type InfoProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
};

function Info({ icon, label, value }: InfoProps) {
  return (
    <View style={styles.infoItem}>
      <MaterialIcons name={icon} size={17} color={BLUE_DARK} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  topBar: {
    minHeight: 62,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: INK, fontSize: 23, fontWeight: '800' },
  loader: { marginTop: 60 },
  list: { padding: 18, paddingBottom: 34 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitleArea: { flex: 1 },
  cardTitle: { color: INK, fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: '#667085', fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderRadius: 8,
    backgroundColor: '#E9F9EE',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgeDanger: { backgroundColor: '#FFF1F2' },
  statusText: { color: '#2E7D32', fontSize: 12, fontWeight: '800' },
  statusTextDanger: { color: '#9F1239' },
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  infoItem: {
    flex: 1,
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: '#F8FCFF',
    borderWidth: 1,
    borderColor: '#E3F2FD',
    padding: 8,
    justifyContent: 'center',
  },
  infoLabel: { color: '#667085', fontSize: 11, marginTop: 4 },
  infoValue: { color: INK, fontSize: 13, fontWeight: '800', marginTop: 2 },
  cancelButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButtonText: { color: '#9F1239', fontWeight: '800' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  emptyTitle: { color: INK, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#667085', textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
