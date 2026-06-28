import React, { useCallback, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSerById } from "@/hooks/useSeres";
import { useWatchesContext } from "@/context/WatchesContext";
import { StatusBadge } from "@/components/StatusBadge";
import { WatchButton } from "@/components/WatchButton";
import { MovimientoConUbicacion } from "@/types";

const EDAD_LABELS: Record<string, string> = {
  NINO: "Niño/a",
  ADOLESCENTE: "Adolescente",
  ADULTO: "Adulto/a",
  ANCIANO: "Anciano/a",
};

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon as "person"} size={16} color={colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

function TimelineItem({ mov, isLast }: { mov: MovimientoConUbicacion; isLast: boolean }) {
  const colors = useColors();
  const fecha = new Date(mov.fecha_registro).toLocaleString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const stateColors: Record<string, string> = {
    BUSCADO: colors.statusBuscado,
    LOCALIZADO_BIEN: colors.statusLocalizado,
    EN_REFUGIO: colors.statusRefugio,
    NECESITA_ASISTENCIA_MEDICA: colors.statusMedica,
  };

  const dotColor = stateColors[mov.estado_persona] ?? colors.primary;

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
      </View>
      <View style={[styles.timelineContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.timelineTop}>
          <StatusBadge estado={mov.estado_persona} size="sm" />
          <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{fecha}</Text>
        </View>
        <Text style={[styles.timelineLocation, { color: colors.foreground }]}>
          {mov.ubicacion.nombre_lugar}
        </Text>
        {mov.condicion_medica ? (
          <Text style={[styles.timelineCondicion, { color: colors.mutedForeground }]}>
            {mov.condicion_medica}
          </Text>
        ) : null}
        {mov.con_familiar ? (
          <View style={styles.familiarRow}>
            <Ionicons name="people" size={14} color={colors.primary} />
            <Text style={[styles.familiarText, { color: colors.primary }]}>Con familiar</Text>
          </View>
        ) : null}
        {mov.id_persona_dueno_telefono ? (
          <Text style={[styles.contacto, { color: colors.mutedForeground }]}>
            Reportado por: {mov.id_persona_dueno_telefono}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { data: ser, isLoading } = useSerById(id ?? "");
  const { isWatching, toggleWatch } = useWatchesContext();
  const [toggling, setToggling] = useState(false);

  const handleToggleWatch = useCallback(async () => {
    if (!ser) return;
    setToggling(true);
    if (Platform.OS !== "web") Haptics.selectionAsync();
    await toggleWatch(ser);
    setToggling(false);
  }, [ser, toggleWatch]);

  if (isLoading || !ser) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        {isLoading ? (
          <Ionicons name="refresh" size={32} color={colors.primary} />
        ) : (
          <>
            <Ionicons name="person-remove-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
              Registro no encontrado
            </Text>
          </>
        )}
      </View>
    );
  }

  const displayName =
    ser.tipo_ser === "PERSONA"
      ? [ser.nombre, ser.apellido].filter(Boolean).join(" ") || "Sin nombre"
      : ser.nombre || "Animal sin nombre";

  const fotoUrl = ser.ultimoMovimiento.fotoUrl;
  const watching = isWatching(ser.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: isWeb ? 34 : insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          {fotoUrl ? (
            <Image source={{ uri: fotoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <Ionicons
                name={ser.tipo_ser === "ANIMAL" ? "paw" : "person"}
                size={56}
                color="rgba(255,255,255,0.6)"
              />
            </View>
          )}
          <Text style={styles.heroName}>{displayName}</Text>
          <StatusBadge estado={ser.estadoActual} />
        </View>

        <View style={styles.watchSection}>
          <WatchButton
            watching={watching}
            onToggle={handleToggleWatch}
            loading={toggling}
          />
          {watching && (
            <Text style={[styles.watchHint, { color: colors.mutedForeground }]}>
              Recibirás una alerta si su estado cambia
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Información</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {ser.tipo_ser === "PERSONA" ? (
              <>
                {ser.cedula ? <InfoRow icon="card" label="Cédula" value={ser.cedula} /> : null}
                {ser.sexo ? <InfoRow icon="male-female" label="Sexo" value={ser.sexo} /> : null}
                <InfoRow icon="person" label="Edad" value={EDAD_LABELS[ser.rango_edad] ?? ser.rango_edad} />
              </>
            ) : (
              <>
                {ser.raza ? <InfoRow icon="paw" label="Raza" value={ser.raza} /> : null}
                {ser.color ? <InfoRow icon="color-palette" label="Color" value={ser.color} /> : null}
              </>
            )}
            <InfoRow icon="location" label="Última ubicación" value={ser.ubicacionActual.nombre_lugar} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Historial ({ser.movimientos.length})
          </Text>
          <View style={styles.timeline}>
            {ser.movimientos.map((mov, idx) => (
              <TimelineItem
                key={mov.id}
                mov={mov}
                isLast={idx === ser.movimientos.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  watchSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "flex-start",
    gap: 8,
  },
  watchHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingLeft: 2,
  },
  section: {
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    paddingLeft: 4,
  },
  timelineLeft: {
    alignItems: "center",
    width: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 14,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  timelineTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  timelineDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  timelineLocation: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  timelineCondicion: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  familiarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  familiarText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  contacto: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
