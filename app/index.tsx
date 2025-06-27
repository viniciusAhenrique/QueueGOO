import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import Splashscreen from "./splash";
import Welcome from "./welcome";
import { useEffect, useState } from "react";
import React from "react";

export default function App() {
    const [isShowSplash, setIsShowSplash] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setIsShowSplash(false);
        }, 2000);
    }, []);
  return <>{isShowSplash ? <Splashscreen /> : <Welcome />}</>;
}
