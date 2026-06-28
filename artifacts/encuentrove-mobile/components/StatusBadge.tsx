import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { EstadoPersona } from "@/types";

const LABELS: Record<EstadoPersona, string> = {
  BUSCADO: "Buscado",
  LOCALIZADO_BIEN: "Localizado",
  EN_REFUGIO: "En Refugio",
  NECESITA_ASISTENCIA_MEDICA: "Asistencia Médica",
};

interface Props {
  estado: EstadoPersona;
  size?: "sm" | "md";
}

export function StatusBadge({ estado, size = "md" }: Props) {
  const colors = useColors();

  const colorMap: Record<EstadoPersona, string> = {
    BUSCADO: colors.statusBuscado,
    LOCALIZADO_BIEN: colors.statusLocalizado,
    EN_REFUGIO: colors.statusRefugio,
    NECESITA_ASISTENCIA_MEDICA: colors.statusMedica,
  };

  const bg = colorMap[estado] ?? colors.muted;

  return (
    <View style={[styles.badge, size === "sm" && styles.badgeSm, { backgroundColor: bg + "22", borderColor: bg + "55" }]}>
      <View style={[styles.dot, { backgroundColor: bg }]} />
      <Text style={[styles.label, size === "sm" && styles.labelSm, { color: bg }]}>
        {LABELS[estado]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  labelSm: {
    fontSize: 11,
  },
});
