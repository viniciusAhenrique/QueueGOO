import React = require("react");
import { Image, StyleSheet, View } from "react-native";

const Logo = require("../assets/images/logo-splash.png");

export default function Splashscreen() {
  return (
    <View style={styles.container}>
      <View>
        <Image source={Logo} style={styles.image} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#4FC3F7",
  },
  image: {
    width: 100,
    height: 100,
    resizeMode: "cover",
  }
})