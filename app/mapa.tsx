import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Link, useRouter } from 'expo-router';
import ModalRestaurante from './components/modalRestaurante';

export default function Mapa() {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  const restaurante = () => {
      router.push('./madalosso');
  };

  return (
    <View style={styles.container}>
      <MapView 
      style={styles.map}
      initialRegion={{
        latitude: -25.42,
        longitude: -49.26,
        latitudeDelta: 100,
        longitudeDelta: 100
      }}
      showsUserLocation
    >
        <Marker
        pinColor='blue'
          coordinate={{
            latitude: -25.441954450902056,
            longitude: -49.16176739594576
          }}
          title={'Pizzaria das Familias'}
          description={'Buffet de pizzas e sushis'}
          onPress={() => setModalVisible(true)}
        />
        <Marker
          coordinate={{
            latitude: -25.435092308750086,
            longitude: -49.165174646543065
          }}
          title={'Restaurante Sabor Mineiro'}
          description={'Restaurante de comidas diversas localizado no interior do Carrefour'}
          onPress={() => setModalVisible(true)}
        />
        <Marker
          coordinate={{
            latitude: -25.43171984788169,
            longitude: -49.19352643194929
          }}
          title={'Churrascão Gaúcho'}
          description={'Rodízio com 20 tipos de carne, além de buffet com saladas e pratos quentes, em casa com amplo salão e varanda.'}
          onPress={() => setModalVisible(true)}
        />
        <Marker
          coordinate={{
            latitude: -25.432737101491274,
            longitude: -49.193889537986685
          }}
          title={'Pizza Americana'}
          description={'Buffet de pizzas e outras comidas'}
          onPress={() => setModalVisible(true)}
        />
        <Marker
          coordinate={{
            latitude: -25.405365215362806,
            longitude: -49.32834824053337
          }}
          title={'Restaurante Madalosso'}
          description={'Restaurante tradicional que serve pratos da cozinha italiana em vários ambientes e salões de festa.'}
          onPress={() => setModalVisible(true)}
        />
        <Marker
          coordinate={{
            latitude: -25.432277547507812,
            longitude: -49.27507684761119
          }}
          title={'San Domingos Restaurante'}
          description={'Restaurante e café colonial.'}
          onPress={() => setModalVisible(true)}
        />
        <Marker
          coordinate={{
            latitude: -25.44053701514395,
            longitude: -49.29497405881046
          }}
          title={'Tribo das Frutas'}
          description={'Restaurante moderno e rústico com saladas, sucos, hambúrgueres, comida grelhada e smoothies.'}
          onPress={() => setModalVisible(true)}
        />
      </MapView>
      <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}>
            <ModalRestaurante
              fecharModal={ () => setModalVisible(false) }
              menuRestaurante={restaurante}
            />
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  buttonClose: {
    backgroundColor: '#2196F3',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
});
