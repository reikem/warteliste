/**
 * Warteliste — Onboarding / Tutorial
 * - 6 pasos con animación de slide
 * - Al completar guarda 'onboarding_done=true' en AsyncStorage
 * - No vuelve a aparecer si ya fue completado
 * - Se puede relanzar desde Configuración
 *
 * Uso en _layout.tsx:
 *   const { onboardingDone } = useOnboarding();
 *   if (!onboardingDone) return <OnboardingScreen />;
 *
 * Ubicación: app/onboarding.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { COLORS } from '@/constants/colors';
;

const { width: SW } = Dimensions.get('window');
const STORAGE_KEY = 'warteliste_onboarding_done';

// ─── Pasos del tutorial ───────────────────────────────────────────────────────

const STEPS = [
  {
    icon: '🎉',
    title: 'Bienvenido a Warteliste',
    desc: 'Sistema de gestión de turnos multi-empresa. En 5 pasos aprenderás todo lo que necesitas para empezar.',
    color: COLORS.primary,
    role: null,
  },
  {
    icon: '🛠️',
    title: 'Administrador',
    desc: 'Crea secciones de servicio, asigna empleados, configura el monitor y gestiona múltiples sucursales desde el panel de Configuración.',
    color: '#1e40af',
    role: 'admin',
  },
  {
    icon: '👤',
    title: 'Empleado',
    desc: 'Desde el Dashboard puedes llamar el siguiente turno respetando la prioridad (Urgente → VIP → Adulto mayor → Normal), marcar completado o registrar ausencias.',
    color: '#166534',
    role: 'employee',
  },
  {
    icon: '🎫',
    title: 'Kiosco',
    desc: 'Los clientes se registran solos: eligen el servicio, ingresan su nombre, seleccionan el tipo de atención y reciben su ticket con el tiempo estimado de espera.',
    color: '#78350f',
    role: 'kiosk',
  },
  {
    icon: '🖥️',
    title: 'Monitor',
    desc: 'Pantalla pública que muestra el turno actual, historial reciente, estadísticas y alertas sonoras automáticas al llamar cada número.',
    color: '#4c1d95',
    role: 'monitor',
  },
  {
    icon: '✅',
    title: '¡Todo listo!',
    desc: 'Ya conoces Warteliste. Inicia sesión con las credenciales de tu empresa o crea una nueva desde la pantalla de acceso.',
    color: COLORS.primary,
    role: null,
  },
];

// ─── Hook de estado de onboarding ────────────────────────────────────────────

export function useOnboarding() {
  const [done, setDone] = useState<boolean | null>(null); // null = cargando

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      setDone(val === 'true');
    });
  }, []);

  const markDone = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setDone(true);
  };

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setDone(false);
  };

  return { onboardingDone: done, markDone, resetOnboarding };
}

// ─── Pantalla de onboarding ───────────────────────────────────────────────────

interface Props {
  onComplete?: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const animateToStep = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      animateToStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
    router.replace('/login');
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    router.replace('/login');
  };

  const current = STEPS[step];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: current.color + '12' }]} edges={['top', 'bottom']}>

      {/* Skip */}
      {step < STEPS.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Saltar tutorial</Text>
        </TouchableOpacity>
      )}

      {/* Contenido animado */}
      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        {/* Ícono */}
        <View style={[styles.iconCircle, { backgroundColor: current.color + '20', borderColor: current.color + '40' }]}>
          <Text style={styles.icon}>{current.icon}</Text>
        </View>

        {/* Badge de rol */}
        {current.role && (
          <View style={[styles.roleBadge, { backgroundColor: current.color + '18', borderColor: current.color + '33' }]}>
            <Text style={[styles.roleBadgeText, { color: current.color }]}>
              Perfil: {current.role.charAt(0).toUpperCase() + current.role.slice(1)}
            </Text>
          </View>
        )}

        <Text style={[styles.title, { color: current.color }]}>{current.title}</Text>
        <Text style={styles.desc}>{current.desc}</Text>

        {/* Detalle extra por paso */}
        {step === 1 && (
          <View style={styles.detailBox}>
            <Text style={styles.detailItem}>• Crear y editar secciones de servicio</Text>
            <Text style={styles.detailItem}>• Asignar empleados a secciones</Text>
            <Text style={styles.detailItem}>• Configurar sonidos y alertas del monitor</Text>
            <Text style={styles.detailItem}>• Subir imágenes/videos para la pantalla pública</Text>
            <Text style={styles.detailItem}>• Ver reportes del día</Text>
          </View>
        )}
        {step === 2 && (
          <View style={styles.detailBox}>
            <Text style={styles.detailItem}>📢 Llamar siguiente — respeta prioridades automáticamente</Text>
            <Text style={styles.detailItem}>🔁 Repetir llamado — para clientes que no escucharon</Text>
            <Text style={styles.detailItem}>✅ Completar — cierra el turno actual</Text>
            <Text style={styles.detailItem}>✖ Ausente — marca no_show y pasa al siguiente</Text>
          </View>
        )}
        {step === 3 && (
          <View style={styles.detailBox}>
            <Text style={styles.detailItem}>🟢 Normal · ♿ Adulto mayor · ⭐ VIP · 🔴 Urgente</Text>
            <Text style={styles.detailItem}>El ticket muestra tiempo estimado en tiempo real</Text>
            <Text style={styles.detailItem}>Al ser llamado aparece una alerta pulsante</Text>
          </View>
        )}
        {step === 4 && (
          <View style={styles.detailBox}>
            <Text style={styles.detailItem}>🔊 Beep · 🎵 Campanilla · 🎤 Voz sintética · 🔇 Silencio</Text>
            <Text style={styles.detailItem}>Se actualiza automáticamente vía Supabase Realtime</Text>
            <Text style={styles.detailItem}>Compatible con TV y pantallas grandes</Text>
          </View>
        )}
      </Animated.View>

      {/* Dots de progreso */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => animateToStep(i)}>
            <View style={[
              styles.dot,
              i === step && { backgroundColor: current.color, width: 20 },
              i < step  && { backgroundColor: current.color + '66' },
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Botones */}
      <View style={styles.actions}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => animateToStep(step - 1)}>
            <Text style={styles.backBtnText}>← Anterior</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: current.color, flex: step === 0 ? 1 : 2 }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {step === STEPS.length - 1 ? 'Comenzar →' : 'Siguiente →'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  skipBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.06)',
  },
  skipText: { fontSize: 13, color: COLORS.onSurfaceVariant },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, marginBottom: 8,
  },
  icon:  { fontSize: 48 },
  roleBadge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  desc:  { fontSize: 15, color: COLORS.onSurfaceVariant, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  detailBox: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12, padding: 16, gap: 8,
    alignSelf: 'stretch',
  },
  detailItem: { fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.outlineVariant },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: {
    flex: 1, height: 54, borderRadius: 14,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.onSurfaceVariant },
  nextBtn: {
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});