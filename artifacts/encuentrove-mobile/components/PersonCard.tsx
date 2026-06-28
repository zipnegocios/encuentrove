import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import { SerVivienteConEstado } from "@/types";

interface Props {
  item: SerVivienteConEstado;
  onPress: () => void;
}

const EDAD_LABELS: Record<string, string> = {
  NINO: "Niño/a",
  ADOLESCENTE: "Adolescente",
  ADULTO: "Adulto/a",
  ANCIANO: "Anciano/a",
};

export function PersonCard({ item, onPress }: Props) {
  const colors = useColors();

  const displayName =
    item.tipo_ser === "PERSONA"
      ? [item.nombre, item.apellido].filter(Boolean).join(" ") || "Sin nombre"
      : item.nombre || "Animal sin nombre";

  const subtitle =
    item.tipo_ser === "PERSONA"
      ? [EDAD_LABELS[item.rango_edad], item.sexo, item.cedula].filter(Boolean).join(" · ")
      : [item.raza, item.color].filter(Boolean).join(" · ");

  const fechaFormateada = new Date(item.ultimoMovimiento.fecha_registro).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      testID="person-card"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.avatarContainer}>
        {item.ultimoMovimiento.fotoUrl ? (
          <Image source={{ uri: item.ultimoMovimiento.fotoUrl }} style={[styles.avatar, { backgroundColor: colors.muted }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons
              name={item.tipo_ser === "ANIMAL" ? "paw" : "person"}
              size={22}
              color={colors.primary}
            />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </View>

        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        <View style={styles.bottomRow}>
          <StatusBadge estado={item.estadoActual} size="sm" />
          <Text style={[styles.location, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.ubicacionActual.nombre_lugar}
          </Text>
        </View>

        <Text style={[styles.date, { color: colors.mutedForeground }]}>{fechaFormateada}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    flexShrink: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  location: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  date: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
