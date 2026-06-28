import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { TipoSer, Sexo, RangoEdad } from "@/types";
import { submitReport } from "@/lib/reportApi";

type OptionSet<T extends string> = { label: string; value: T }[];

const TIPOS: OptionSet<TipoSer> = [
  { label: "Persona", value: "PERSONA" },
  { label: "Animal", value: "ANIMAL" },
];

const SEXOS: OptionSet<Sexo> = [
  { label: "Masculino", value: "Masculino" },
  { label: "Femenino", value: "Femenino" },
  { label: "Desconocido", value: "Desconocido" },
];

const RANGOS: OptionSet<RangoEdad> = [
  { label: "Niño/a", value: "NINO" },
  { label: "Adolescente", value: "ADOLESCENTE" },
  { label: "Adulto/a", value: "ADULTO" },
  { label: "Anciano/a", value: "ANCIANO" },
];

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: OptionSet<T>;
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[
            styles.segmentItem,
            value === opt.value && {
              backgroundColor: colors.card,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              { color: value === opt.value ? colors.foreground : colors.mutedForeground },
              value === opt.value && { fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{text}</Text>;
}

function FieldInput({
  placeholder,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "numeric";
}) {
  const colors = useColors();
  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          color: colors.foreground,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      keyboardType={keyboardType ?? "default"}
    />
  );
}

export default function ReportarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;

  const [tipo, setTipo] = useState<TipoSer>("PERSONA");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [cedula, setCedula] = useState("");
  const [sexo, setSexo] = useState<Sexo>("Desconocido");
  const [rangoEdad, setRangoEdad] = useState<RangoEdad>("ADULTO");
  const [raza, setRaza] = useState("");
  const [ultimaUbicacion, setUltimaUbicacion] = useState("");
  const [condicion, setCondicion] = useState("");
  const [contacto, setContacto] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el nombre.");
      return;
    }
    if (!ultimaUbicacion.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa la última ubicación conocida.");
      return;
    }

    setSubmitting(true);
    try {
      await submitReport({
        tipo,
        nombre: nombre.trim(),
        apellido: apellido.trim() || undefined,
        cedula: cedula.trim() || undefined,
        sexo: tipo === "PERSONA" ? sexo : undefined,
        rangoEdad: tipo === "PERSONA" ? rangoEdad : undefined,
        raza: tipo === "ANIMAL" ? raza.trim() || undefined : undefined,
        ultimaUbicacion: ultimaUbicacion.trim(),
        condicionMedica: condicion.trim() || undefined,
        contacto: contacto.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar el reporte";
      Alert.alert("Error al enviar", msg + "\n\nRevisa tu conexión e intenta de nuevo.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setNombre("");
    setApellido("");
    setCedula("");
    setSexo("Desconocido");
    setRangoEdad("ADULTO");
    setRaza("");
    setUltimaUbicacion("");
    setCondicion("");
    setContacto("");
    setTipo("PERSONA");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.successContainer, { paddingTop: topPadding + 40 }]}>
          <View style={[styles.successIcon, { backgroundColor: colors.primary + "22" }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Reporte enviado
          </Text>
          <Text style={[styles.successText, { color: colors.mutedForeground }]}>
            Gracias por tu reporte. El equipo de rescate revisará la información y actualizará el estado en el sistema.
          </Text>
          <Pressable
            testID="report-again-btn"
            onPress={handleReset}
            style={[styles.successBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.successBtnText}>Hacer otro reporte</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWeb && { paddingBottom: 34 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.pageHeader, { paddingTop: topPadding + 12, backgroundColor: colors.primary }]}>
          <Text style={styles.pageTitle}>Reportar persona</Text>
          <Text style={styles.pageSub}>Ingresa los datos de la persona o animal que buscas</Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.notice, { backgroundColor: colors.statusBuscado + "15", borderColor: colors.statusBuscado + "40" }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.statusBuscado} />
            <Text style={[styles.noticeText, { color: colors.statusBuscado }]}>
              Para emergencias activas llama al 911 o Protección Civil
            </Text>
          </View>

          <View style={styles.field}>
            <FieldLabel text="Tipo" />
            <SegmentControl options={TIPOS} value={tipo} onChange={setTipo} />
          </View>

          <View style={styles.field}>
            <FieldLabel text={tipo === "PERSONA" ? "Nombre *" : "Nombre del animal *"} />
            <FieldInput placeholder="Ej: María" value={nombre} onChangeText={setNombre} />
          </View>

          {tipo === "PERSONA" ? (
            <>
              <View style={styles.field}>
                <FieldLabel text="Apellido" />
                <FieldInput placeholder="Ej: González" value={apellido} onChangeText={setApellido} />
              </View>
              <View style={styles.field}>
                <FieldLabel text="Cédula" />
                <FieldInput placeholder="Ej: V-12345678" value={cedula} onChangeText={setCedula} keyboardType="default" />
              </View>
              <View style={styles.field}>
                <FieldLabel text="Sexo" />
                <SegmentControl options={SEXOS} value={sexo} onChange={setSexo} />
              </View>
              <View style={styles.field}>
                <FieldLabel text="Rango de edad" />
                <SegmentControl options={RANGOS} value={rangoEdad} onChange={setRangoEdad} />
              </View>
            </>
          ) : (
            <View style={styles.field}>
              <FieldLabel text="Raza / Descripción" />
              <FieldInput placeholder="Ej: Labrador, color dorado" value={raza} onChangeText={setRaza} />
            </View>
          )}

          <View style={styles.field}>
            <FieldLabel text="Última ubicación conocida *" />
            <FieldInput
              placeholder="Ej: Refugio Macuto, cerca de la plaza"
              value={ultimaUbicacion}
              onChangeText={setUltimaUbicacion}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel text="Condición médica" />
            <FieldInput
              placeholder="Ej: Diabético, necesita insulina"
              value={condicion}
              onChangeText={setCondicion}
              multiline
            />
          </View>

          <View style={styles.field}>
            <FieldLabel text="Contacto del reportante" />
            <FieldInput
              placeholder="Tu nombre y teléfono"
              value={contacto}
              onChangeText={setContacto}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable
            testID="submit-report-btn"
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: pressed || submitting ? 0.75 : 1 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
            <Text style={styles.submitBtnText}>
              {submitting ? "Enviando..." : "Enviar reporte"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 120,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  form: {
    padding: 20,
    gap: 20,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 11,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 20,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  successText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  successBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  successBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
});
