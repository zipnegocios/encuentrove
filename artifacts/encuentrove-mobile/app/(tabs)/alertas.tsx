import React, { useEffect } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useNotifHistory } from "@/context/NotificationHistoryContext";
import { NotifRecord } from "@/lib/watchStorage";

const ESTADO_LABELS: Record<string, string> = {
  BUSCADO: "Buscado/a",
  LOCALIZADO_BIEN: "Localizado/a — Bien",
  EN_REFUGIO: "En refugio",
  NECESITA_ASISTENCIA_MEDICA: "Necesita asistencia médica",
};

const ESTADO_COLORS: Record<string, string> = {
  BUSCADO: "#dc2626",
  LOCALIZADO_BIEN: "#16a34a",
  EN_REFUGIO: "#2563eb",
  NECESITA_ASISTENCIA_MEDICA: "#ea580c",
};

function AlertItem({ item }: { item: NotifRecord }) {
  const colors = useColors();
  const router = useRouter();
  const newColor = ESTADO_COLORS[item.newEstado] ?? colors.primary;
  const fecha = new Date(item.timestamp).toLocaleString("es-VE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      onPress={() => router.push(`/detail/${item.serId}`)}
      style={({ pressed }) => [
        styles.alertCard,
        {
          backgroundColor: colors.card,
          borderColor: item.read ? colors.border : colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
      <View style={[styles.iconWrap, { backgroundColor: `${newColor}18` }]}>
        <Ionicons name="notifications" size={20} color={newColor} />
      </View>
      <View style={styles.alertBody}>
        <Text style={[styles.alertName, { color: colors.foreground }]} numberOfLines={1}>
          {item.serNombre}
        </Text>
        <View style={styles.estadoRow}>
          <Text style={[styles.estadoOld, { color: colors.mutedForeground }]} numberOfLines={1}>
            {ESTADO_LABELS[item.oldEstado] ?? item.oldEstado}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={newColor} />
          <Text style={[styles.estadoNew, { color: newColor }]} numberOfLines={1}>
            {ESTADO_LABELS[item.newEstado] ?? item.newEstado}
          </Text>
        </View>
        <Text style={[styles.alertDate, { color: colors.mutedForeground }]}>{fecha}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function AlertasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { history, unreadCount, refresh, markRead, clearAll } = useNotifHistory();

  useEffect(() => {
    if (unreadCount > 0) markRead();
  }, [unreadCount, markRead]);

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 12, backgroundColor: colors.primary },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Alertas</Text>
            <Text style={styles.headerSub}>Cambios de estado en personas vigiladas</Text>
          </View>
          {history.length > 0 && (
            <Pressable onPress={clearAll} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlertItem item={item} />}
        onRefresh={refresh}
        refreshing={false}
        contentContainerStyle={[
          styles.list,
          isWeb && { paddingBottom: 34 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="notifications-off-outline"
              size={52}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Sin alertas aún
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Vigila personas desde su pantalla de detalle y recibirás una
              alerta cuando su estado cambie.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  clearBtn: {
    padding: 8,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  alertBody: {
    flex: 1,
    gap: 3,
  },
  alertName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  estadoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  estadoOld: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  estadoNew: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  alertDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
});
