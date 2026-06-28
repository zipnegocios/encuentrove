import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  watching: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export function WatchButton({ watching, onToggle, loading }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: watching ? colors.secondary : colors.card,
          borderColor: watching ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityLabel={watching ? "Dejar de vigilar" : "Vigilar este registro"}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={watching ? "notifications" : "notifications-outline"}
          size={18}
          color={watching ? colors.primary : colors.mutedForeground}
        />
      )}
      <Text
        style={[
          styles.label,
          { color: watching ? colors.primary : colors.mutedForeground },
        ]}
      >
        {watching ? "Vigilando" : "Vigilar"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
