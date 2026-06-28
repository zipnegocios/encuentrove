import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Estadisticas } from "@/types";

interface Props {
  stats: Estadisticas;
}

export function StatsBar({ stats }: Props) {
  const colors = useColors();

  const items = [
    { label: "Total", value: stats.total, color: colors.primary },
    { label: "Buscados", value: stats.porEstado.BUSCADO, color: colors.statusBuscado },
    { label: "Localizados", value: stats.porEstado.LOCALIZADO_BIEN, color: colors.statusLocalizado },
    { label: "Refugio", value: stats.porEstado.EN_REFUGIO, color: colors.statusRefugio },
    { label: "Médico", value: stats.porEstado.NECESITA_ASISTENCIA_MEDICA, color: colors.statusMedica },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {items.map((item, idx) => (
        <React.Fragment key={item.label}>
          {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          <View style={styles.item}>
            <Text style={[styles.value, { color: item.color }]}>{item.value}</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  divider: {
    width: 1,
    marginVertical: 4,
  },
});
