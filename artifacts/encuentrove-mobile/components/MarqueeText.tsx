import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  containerWidth: number;
  speed?: number;
  gap?: number;
}

// Texto que se desplaza en bucle cuando no entra completo en el ancho
// disponible — usado como placeholder "vivo" sobre un TextInput (el
// placeholder nativo no se puede animar).
export function MarqueeText({ text, style, containerWidth, speed = 26, gap = 40 }: Props) {
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useSharedValue(0);
  const needsScroll = containerWidth > 0 && textWidth > containerWidth;

  const onTextLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - textWidth) > 0.5) setTextWidth(w);
  };

  useEffect(() => {
    cancelAnimation(translateX);
    if (!needsScroll) {
      translateX.value = 0;
      return;
    }
    const distance = textWidth + gap;
    const duration = (distance / speed) * 1000;
    translateX.value = 0;
    translateX.value = withDelay(
      700,
      withRepeat(withTiming(-distance, { duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(translateX);
  }, [needsScroll, textWidth, gap, speed, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.viewport, { width: containerWidth || undefined }]}>
      <Animated.View style={[styles.row, animatedStyle]}>
        <Text numberOfLines={1} onLayout={onTextLayout} style={style}>
          {text}
        </Text>
        {needsScroll && (
          <Text numberOfLines={1} style={[style, { marginLeft: gap }]}>
            {text}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
  },
});
