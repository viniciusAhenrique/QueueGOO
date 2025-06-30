import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Linking from 'expo-linking';

interface ModalReservaProps {
  visible: boolean;
  onClose: () => void;
  placeId: string;
  nomeRestaurante: string;
  cidade: string;
  capacidadeMaxima: number;
  telefoneRestaurante: string;
}

const ModalReserva: React.FC<ModalReservaProps> = ({
  visible,
  onClose,
  placeId,
  nomeRestaurante,
  cidade,
  capacidadeMaxima,
  telefoneRestaurante,
}) => {
  const [carregando, setCarregando] = useState(false);
  const [numPessoas, setNumPessoas] = useState('');
  const [dataReserva, setDataReserva] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const buscarDadosUsuario = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;

    const docUser = await getDoc(doc(db, 'usuarios', user.uid));
    if (!docUser.exists()) return null;

    return {
      uid: user.uid,
      nome: docUser.data().nome,
      telefone: docUser.data().telefone,
    };
  };

  const registrarReserva = async () => {
    setCarregando(true);

    const usuario = await buscarDadosUsuario();
    if (!usuario) {
      setCarregando(false);
      Alert.alert('Atenção', 'Apenas usuários logados podem fazer reservas.');
      return;
    }

    if (!numPessoas.trim() || isNaN(Number(numPessoas))) {
      setCarregando(false);
      Alert.alert('Atenção', 'Informe corretamente o número de pessoas.');
      return;
    }

    if (!telefoneRestaurante) {
      setCarregando(false);
      Alert.alert('Erro', 'Telefone do restaurante indisponível.');
      return;
    }

    const dataTexto = formatarData(dataReserva);
    const horaTexto = formatarHora(dataReserva);

    const mensagem = `Olá, gostaria de fazer uma reserva no restaurante *${nomeRestaurante}* para *${numPessoas} pessoas* no dia *${dataTexto}* às *${horaTexto}*. Meu nome é *${usuario.nome}*.`;

    const numeroWhatsApp = telefoneRestaurante.replace(/\D/g, ''); // remove símbolos
    const url = `https://wa.me/55${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;

    await Linking.openURL(url);

    setCarregando(false);
    onClose();
    setNumPessoas('');
    setDataReserva(new Date());
  };

  const formatarData = (date: Date) => {
    return date.toLocaleDateString();
  };

  const formatarHora = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Confirmar Reserva</Text>
          <Text style={styles.text}>Restaurante: {nomeRestaurante}</Text>
          <Text style={styles.text}>Cidade: {cidade}</Text>

          <TextInput
            style={styles.input}
            placeholder="Número de pessoas"
            keyboardType="numeric"
            value={numPessoas}
            onChangeText={setNumPessoas}
          />

          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ fontSize: 16, color: '#000' }}>
              {formatarData(dataReserva)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={{ fontSize: 16, color: '#000' }}>
              {formatarHora(dataReserva)}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dataReserva}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  const novaData = new Date(dataReserva);
                  novaData.setFullYear(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate()
                  );
                  setDataReserva(novaData);
                }
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={dataReserva}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) {
                  const novaHora = new Date(dataReserva);
                  novaHora.setHours(
                    selectedTime.getHours(),
                    selectedTime.getMinutes()
                  );
                  setDataReserva(novaHora);
                }
              }}
            />
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={registrarReserva}
            disabled={carregando}
          >
            <Text style={styles.buttonText}>
              {carregando ? 'Enviando...' : 'Confirmar Reserva'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '85%',
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 12,
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#0D47A1',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
  },
});

export default ModalReserva;
