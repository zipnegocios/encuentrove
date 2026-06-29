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
import { FilterSheet } from "@/components/FilterSheet";
import { MarqueeText } from "@/components/MarqueeText";
import { SerVivienteConEstado, TipoSer, EstadoPersona } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFeedCache } from "@/lib/api";

const SEARCH_PLACEHOLDER = "Busca por nombre, apellido o cédula...";

// Sin opcion "Todos" — el listado por defecto es solo de personas; las
// mascotas/animales solo aparecen si se elige "Animales" explicitamente.
const TIPOS: { label: string; value: TipoSer }[] = [
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
  const [tipo, setTipo] = useState<TipoSer>("PERSONA");
  const [estado, setEstado] = useState<EstadoPersona | "">("");
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);
  const hasActiveFilters = tipo !== "PERSONA" || estado !== "";

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
      <View style={[styles.header, { paddingTop: topPadding + 10, backgroundColor: colors.primary }]}>
        <Text style={styles.heroTitle}>EncuentroVE</Text>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)" }]}>
            <Ionicons name="search" size={17} color="rgba(255,255,255,0.7)" />
            <View
              style={styles.inputWrap}
              onLayout={(e) => setInputWidth(e.nativeEvent.layout.width)}
            >
              <TextInput
                testID="search-input"
                style={[styles.searchInput, { color: "#ffffff" }]}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query.length === 0 && (
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  <MarqueeText
                    text={SEARCH_PLACEHOLDER}
                    containerWidth={inputWidth}
                    style={[styles.searchInput, styles.marqueeText]}
                  />
                </View>
              )}
            </View>
            {query.length > 0 && Platform.OS !== "ios" && (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </Pressable>
            )}
          </View>

          <Pressable
            testID="filter-button"
            onPress={() => setFiltersOpen(true)}
            style={[styles.filterBtn, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)" }]}
          >
            <Ionicons name="filter-outline" size={19} color="#ffffff" />
            {hasActiveFilters && <View style={[styles.filterDot, { backgroundColor: colors.accent }]} />}
          </Pressable>
        </View>
      </View>

      {stats && (
        <StatsBar stats={stats} />
      )}

      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: colors.mutedForeground }]}>
          {isLoading ? "Cargando..." : `${items.length} resultado${items.length !== 1 ? "s" : ""}`}
        </Text>
        {hasActiveFilters && (
          <Pressable onPress={() => { setTipo("PERSONA"); setEstado(""); }} hitSlop={6}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Limpiar filtros</Text>
          </Pressable>
        )}
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

      <FilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrar resultados">
        <Text style={[styles.filterGroupLabel, { color: colors.mutedForeground }]}>Tipo</Text>
        <View style={styles.chipWrap}>
          {TIPOS.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setTipo(t.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: tipo === t.value ? colors.primary : colors.muted,
                  borderColor: tipo === t.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: tipo === t.value ? "#fff" : colors.foreground }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.filterGroupLabel, { color: colors.mutedForeground, marginTop: 18 }]}>Estado</Text>
        <View style={styles.chipWrap}>
          {ESTADOS.map((e) => (
            <Pressable
              key={e.value || "all-estado"}
              onPress={() => setEstado(e.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: estado === e.value ? colors.primary : colors.muted,
                  borderColor: estado === e.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: estado === e.value ? "#fff" : colors.foreground }]}>
                {e.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setFiltersOpen(false)}
          style={[styles.applyBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.applyBtnText}>
            Ver {isLoading ? "resultados" : `${items.length} resultado${items.length !== 1 ? "s" : ""}`}
          </Text>
        </Pressable>
      </FilterSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputWrap: {
    flex: 1,
  },
  searchInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  marqueeText: {
    color: "rgba(255,255,255,0.55)",
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  filterGroupLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  applyBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  applyBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 10,
  },
  resultsCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
