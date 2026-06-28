import React, { useState, useCallback } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useFilteredSeres, useEstadisticas, useAllSeres } from "@/hooks/useSeres";
import { PersonCard } from "@/components/PersonCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { StatsBar } from "@/components/StatsBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SerVivienteConEstado, TipoSer, EstadoPersona } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFeedCache } from "@/lib/api";

const TIPOS: { label: string; value: TipoSer | "" }[] = [
  { label: "Todos", value: "" },
  { label: "Personas", value: "PERSONA" },
  { label: "Animales", value: "ANIMAL" },
];

const ESTADOS: { label: string; value: EstadoPersona | "" }[] = [
  { label: "Todos", value: "" },
  { label: "Buscados", value: "BUSCADO" },
  { label: "Localizados", value: "LOCALIZADO_BIEN" },
  { label: "En Refugio", value: "EN_REFUGIO" },
  { label: "Asistencia Médica", value: "NECESITA_ASISTENCIA_MEDICA" },
];

export default function BuscarScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<TipoSer | "">("");
  const [estado, setEstado] = useState<EstadoPersona | "">("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: items = [], isLoading, isError, refetch: refetchItems } = useFilteredSeres({ query, tipo, estado });
  const { data: stats } = useEstadisticas();
  const { refetch } = useAllSeres();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateFeedCache();
    await queryClient.invalidateQueries({ queryKey: ["seres"] });
    await refetch();
    setRefreshing(false);
  }, [queryClient, refetch]);

  const onPressCard = useCallback((item: SerVivienteConEstado) => {
    Haptics.selectionAsync();
    router.push(`/detail/${item.id}`);
  }, [router]);

  const topPadding = isWeb ? 67 : insets.top;

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.primary }]}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>EncuentroVE</Text>
            <Text style={styles.heroSub}>Búsqueda de personas y animales</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)" }]}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
          <TextInput
            testID="search-input"
            style={[styles.searchInput, { color: "#ffffff" }]}
            placeholder="Nombre, apellido o cédula..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TIPOS}
          keyExtractor={(t) => t.value || "all-tipo"}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: t }) => (
            <Pressable
              onPress={() => setTipo(t.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: tipo === t.value ? colors.primary : colors.card,
                  borderColor: tipo === t.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: tipo === t.value ? "#fff" : colors.foreground }]}>
                {t.label}
              </Text>
            </Pressable>
          )}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ESTADOS}
          keyExtractor={(e) => e.value || "all-estado"}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: e }) => (
            <Pressable
              onPress={() => setEstado(e.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: estado === e.value ? colors.primary : colors.card,
                  borderColor: estado === e.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: estado === e.value ? "#fff" : colors.foreground }]}>
                {e.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {stats && (
        <StatsBar stats={stats} />
      )}

      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: colors.mutedForeground }]}>
          {isLoading ? "Cargando..." : `${items.length} resultado${items.length !== 1 ? "s" : ""}`}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View>
          {[1, 2, 3, 4, 5].map((k) => <SkeletonCard key={k} />)}
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin conexión</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No se pudo cargar la información. Verifica tu conexión e intenta de nuevo.
          </Text>
          <Pressable
            onPress={() => { invalidateFeedCache(); refetchItems(); }}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin resultados</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Intenta con otro nombre, cédula o cambia los filtros
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={isLoading ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PersonCard item={item} onPress={() => onPressCard(item)} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[styles.list, isWeb && { paddingBottom: 34 }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterSection: {
    gap: 0,
    paddingVertical: 10,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  resultsCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  list: {
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
});
