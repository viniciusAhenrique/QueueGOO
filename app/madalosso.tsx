import { Text, View, Image, ScrollView, Button, Alert, StyleSheet} from "react-native";
import { Link,useRouter } from 'expo-router';
import React = require("react");
import Favoritos from "./Favoritos";

export default function produto() {
    const router=useRouter();
    const favoritos=()=>{
        router.push("./Favoritos")
    };
  return (
    <ScrollView
    style={{
        backgroundColor: "#4FC3F7",
    }}>
        <View
        style={{
            justifyContent: "center",
            alignItems: "center",
        }}
        >
            <Image source={{uri: "https://muralzinhodeideias.com.br/wp-content/uploads/2022/10/madalosso-divulgacao3.jpg"}} style={{ width: "100%", height: "100%" }}></Image>
            <Text>Restaurante Madalosso</Text>
            <Text>★ 4.8</Text>
            <Text>Culinária</Text>
            <Text>Pessoas na fila: 10</Text>
            <Text>Pessoas na fila: 10</Text>
            <Button
                title="Cardápio"
                onPress={() => Alert.alert('Cardápio')}
            />
                        <Button
                title="Reservar"
                onPress={() => Alert.alert('Reserva')}
            />
            <Button
                title="Reservar"
                onPress={Favoritos}
            />
        </View>
    </ScrollView>
  )
}

export const styles = StyleSheet.create({
    button: {
        backgroundColor: 'blue',
        color: 'white',
        padding: 4,
        paddingLeft: 15, 
        paddingRight: 15, 
        margin: 5,
        borderStyle: 'solid',
        borderWidth: 1,
        borderRadius: 4,
        borderColor: 'blue',
        elevation: 2,
    }
})