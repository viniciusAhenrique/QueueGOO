import React, { useEffect, useState } from "react";
import Splashscreen from "./splash";
import Welcome from "./welcome";

export default function App() {
    const [isShowSplash, setIsShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsShowSplash(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);
  return <>{isShowSplash ? <Splashscreen /> : <Welcome />}</>;
}
