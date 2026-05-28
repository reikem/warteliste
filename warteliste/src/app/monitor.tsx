/**
 * QueueMaster Pro — Monitor (Usuario monitor)
 * - Escucha eventos del eventBus en tiempo real
 * - Cuando un empleado presiona "Llamar Siguiente", el monitor actualiza
 * - Animación de entrada al recibir nuevo ticket
 * - Marquee con información
 * - Historial de turnos recientes
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  Easing, Dimensions, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Wifi, WifiOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../service/authContext';
import { COLORS } from '../constants/colors';
import { getRecentCompleted, getQueueStats, getWaitingQueue } from '../../service/queueservice';
import { bus, EVENTS, TicketCalledPayload, TicketCreatedPayload } from '../../service/eventBus';
import type { Queue } from '../../service/database';

const { width: SW } = Dimensions.get('window');

interface CurrentCall {
  ticketNumber: string;
  desk: string;
  sectionTitle: string;
  servedBy: string;
}

export default function MonitorScreen() {
  const { logout } = useAuth();

  const [current, setCurrent]       = useState<CurrentCall | null>(null);
  const [history, setHistory]       = useState<Queue[]>([]);
  const [stats, setStats]           = useState({ waiting: 0, serving: 0, completed_today: 0, avg_wait_seconds: 0 });
  const [currentTime, setTime]      = useState('');
  const [isLive, setIsLive]         = useState(true);
  const [newCall, setNewCall]       = useState(false); // flash de nueva llamada

  // Animaciones
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const flashAnim   = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(1)).current;
  const marqueeAnim = useRef(new Animated.Value(SW)).current;

  // ─── Cargar datos iniciales ───────────────────────────────────────────────

  const reloadStats = useCallback(() => {
    setStats(getQueueStats());
    setHistory(getRecentCompleted(6));
  }, []);

  useEffect(() => {
    reloadStats();
  }, [reloadStats]);

  // ─── Reloj en tiempo real ─────────────────────────────────────────────────

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Animación de pulso continuo ─────────────────────────────────────────

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // ─── Animación marquee ───────────────────────────────────────────────────

  useEffect(() => {
    const runMarquee = () => {
      marqueeAnim.setValue(SW);
      Animated.timing(marqueeAnim, {
        toValue: -SW * 2,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) runMarquee(); });
    };
    runMarquee();
  }, [marqueeAnim]);

  // ─── Flash de nueva llamada ───────────────────────────────────────────────

  const playCallAnimation = useCallback(() => {
    setNewCall(true);
    // Flash de fondo
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
    // Escala del número
    Animated.sequence([
      Animated.timing(numberScale, { toValue: 1.15, duration: 200, useNativeDriver: true }),
      Animated.spring(numberScale,  { toValue: 1,    useNativeDriver: true, friction: 4 }),
    ]).start();
    setTimeout(() => setNewCall(false), 3000);
  }, [flashAnim, numberScale]);

  // ─── EventBus: escuchar llamadas del dashboard ────────────────────────────

  useEffect(() => {
    const unsubCall = bus.on<TicketCalledPayload>(EVENTS.TICKET_CALLED, (payload) => {
      setCurrent({
        ticketNumber: payload.ticketNumber,
        desk:         payload.desk,
        sectionTitle: payload.sectionTitle,
        servedBy:     payload.servedBy,
      });
      playCallAnimation();
      reloadStats();
    });

    const unsubQueue = bus.on(EVENTS.QUEUE_UPDATED, () => {
      reloadStats();
      setHistory(getRecentCompleted(6));
    });

    const unsubCreated = bus.on<TicketCreatedPayload>(EVENTS.TICKET_CREATED, () => {
      reloadStats();
    });

    return () => {
      unsubCall();
      unsubQueue();
      unsubCreated();
    };
  }, [playCallAnimation, reloadStats]);

  // ─── Color de flash ───────────────────────────────────────────────────────

  const flashBg = flashAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [COLORS.surfaceContainerLowest, COLORS.primary + '18'],
  });

  const handleLogout = () => {
    Alert.alert('Salir', '¿Cerrar sesión de monitor?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const formatWait = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.round(secs / 60)}m`;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={[styles.liveDot, { backgroundColor: isLive ? '#4ade80' : COLORS.error }]} />
          <Text style={styles.topTitle}>QueueMaster Pro</Text>
          <Text style={styles.topSub}>Lobby · Floor 1</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={styles.clock}>{currentTime}</Text>
          {isLive ? <Wifi size={16} color="#4ade80" /> : <WifiOff size={16} color={COLORS.error} />}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={18} color={COLORS.inverseOnSurface + 'aa'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* AHORA SIRVIENDO — bloque principal */}
        <Animated.View style={[styles.nowCard, { backgroundColor: flashBg }]}>
          {newCall && (
            <View style={styles.newCallBanner}>
              <Text style={styles.newCallText}>🔔 ¡NUEVO LLAMADO!</Text>
            </View>
          )}

          <View style={styles.nowHeader}>
            <Text style={styles.nowLabel}>🔔  AHORA SIRVIENDO</Text>
            {current && (
              <View style={styles.deskBadge}>
                <Text style={styles.deskBadgeText}>{current.desk}</Text>
              </View>
            )}
          </View>

          {current ? (
            <>
              <Animated.Text style={[styles.bigNumber, { transform: [{ scale: numberScale }] }]}>
                {current.ticketNumber}
              </Animated.Text>
              <Text style={styles.nowSection}>{current.sectionTitle}</Text>
              <View style={styles.deskRow}>
                <Text style={styles.deskLabel}>Dirígete a:</Text>
                <View style={styles.deskChip}>
                  <Text style={styles.deskChipText}>{current.desk}</Text>
                </View>
              </View>
              <Text style={styles.servedBy}>Atendido por: {current.servedBy}</Text>
            </>
          ) : (
            <View style={styles.standby}>
              <Text style={styles.standbyIcon}>⏳</Text>
              <Text style={styles.standbyText}>En espera de llamado...</Text>
              <Text style={styles.standbySub}>El número aparecerá aquí cuando un empleado llame el siguiente turno</Text>
            </View>
          )}
        </Animated.View>

        {/* ESTADÍSTICAS */}
        <View style={styles.statsRow}>
          {[
            { label: 'Esperando',  val: stats.waiting,         icon: '👥', color: COLORS.primary },
            { label: 'Completados', val: stats.completed_today, icon: '✅', color: COLORS.primaryContainer },
            { label: 'Espera prom', val: formatWait(stats.avg_wait_seconds), icon: '⏱', color: COLORS.secondary },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* HISTORIAL RECIENTE */}
        {history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Turnos Recientes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
              {history.map((t, i) => (
                <View key={t.id} style={[styles.histChip, { opacity: 1 - i * 0.13 }]}>
                  <Text style={styles.histNum}>{t.ticket_number}</Text>
                  <Text style={styles.histDesk}>{t.desk ?? '—'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* MARQUEE INFERIOR */}
      <View style={styles.marqueeBar}>
        <Animated.Text style={[styles.marqueeText, { transform: [{ translateX: marqueeAnim }] }]}>
          ⚡ Tiempo estimado de espera: {formatWait(stats.avg_wait_seconds)}  •  {stats.waiting} personas en fila  •  Tenga su identificación lista para un servicio más rápido  •  Únase a nuestro programa de fidelidad para prioridad de atención
        </Animated.Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.inverseSurface },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.inverseSurface,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLORS.inverseOnSurface },
  topSub: { fontSize: 12, color: COLORS.inverseOnSurface + '80' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clock: { fontSize: 14, fontWeight: '600', color: COLORS.inverseOnSurface },
  logoutBtn: { padding: 6 },

  scroll: { padding: 14, gap: 14, paddingBottom: 60 },

  nowCard: {
    borderRadius: 16, padding: 28, alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    overflow: 'hidden', minHeight: 280,
  },
  newCallBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: COLORS.primary, paddingVertical: 8, alignItems: 'center',
  },
  newCallText: { fontSize: 14, fontWeight: '800', color: COLORS.onPrimary, letterSpacing: 2 },
  nowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 },
  nowLabel: { fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant, letterSpacing: 1.5, textTransform: 'uppercase' },
  deskBadge: { backgroundColor: COLORS.primaryContainer, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  deskBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.onPrimaryContainer },
  bigNumber: { fontSize: 100, fontWeight: '800', color: COLORS.primary, letterSpacing: -4, lineHeight: 110 },
  nowSection: { fontSize: 18, fontWeight: '600', color: COLORS.onSurfaceVariant },
  deskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  deskLabel: { fontSize: 15, color: COLORS.onSurfaceVariant },
  deskChip: {
    backgroundColor: COLORS.primaryContainer, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 12,
  },
  deskChipText: { fontSize: 22, fontWeight: '700', color: COLORS.onPrimaryContainer },
  servedBy: { fontSize: 12, color: COLORS.outline, marginTop: 4 },
  standby: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  standbyIcon: { fontSize: 48 },
  standbyText: { fontSize: 18, fontWeight: '600', color: COLORS.onSurfaceVariant },
  standbySub: { fontSize: 13, color: COLORS.outline, textAlign: 'center', maxWidth: 280, lineHeight: 18 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest + 'dd',
    borderRadius: 12, padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  statIcon: { fontSize: 20 },
  statVal: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: COLORS.onSurfaceVariant, textAlign: 'center' },

  historyCard: {
    backgroundColor: COLORS.surfaceContainerLowest + 'cc',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    gap: 10,
  },
  historyTitle: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  historyScroll: { gap: 10 },
  histChip: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', minWidth: 80,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  histNum: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  histDesk: { fontSize: 11, color: COLORS.onSurfaceVariant, marginTop: 2 },

  marqueeBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.primary, paddingVertical: 10, overflow: 'hidden',
  },
  marqueeText: {
    fontSize: 13, fontWeight: '600', color: COLORS.onPrimary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
});