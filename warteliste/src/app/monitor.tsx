/**
 * QueueMaster Pro — Monitor
 * INTEGRACIÓN:
 *   + useMonitorSound: beep / campanilla / voz / silencio
 *   + Badge de prioridad visible al llamar (urgent/vip/senior)
 *   + Historial incluye calling + serving + completed (FIX previo)
 *   + Selector de tipo de sonido persistente en UI
 *
 * Ubicación: app/(tabs)/monitor.tsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Animated, Easing, Dimensions, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Volume2, VolumeX, Music, Mic } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { getQueueStats, getSystemConfig } from '../../service/queueservice';
import { getDatabase } from '../../service/database';
import { bus, EVENTS, type TicketCalledPayload } from '../../service/eventBus';
import {
  PRIORITY_LABELS, PRIORITY_ICONS, type TicketPriority,
} from '../../service/priorityQueue';
import { useAuth } from '../../store/authcontext';
import { SoundType, useMonitorSound } from '@/hooks/useMonitorSound';

const { width: SW } = Dimensions.get('window');

// ─── Colores prioridad ────────────────────────────────────────────────────────

const PRIO_COLORS: Record<TicketPriority, { bg: string; text: string }> = {
  urgent: { bg: '#fef2f2', text: '#b91c1c' },
  vip:    { bg: '#fef3c7', text: '#78350f' },
  senior: { bg: '#dbeafe', text: '#1e3a8a' },
  normal: { bg: COLORS.primaryContainer, text: COLORS.onPrimaryContainer },
};

// ─── Helpers BD ───────────────────────────────────────────────────────────────

interface HistoryRow {
  id: number;
  ticket_number: string;
  desk: string | null;
  section_title: string | null;
  status: string;
  priority: string | null;
}

function getRecentCalledFromDB(limit = 8): HistoryRow[] {
  return getDatabase().getAllSync<HistoryRow>(`
    SELECT q.id, q.ticket_number, q.desk, q.status,
           COALESCE(q.priority,'normal') as priority,
           ss.title AS section_title
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.status IN ('calling','serving','completed')
    ORDER BY COALESCE(q.called_at, q.created_at) DESC
    LIMIT ?
  `, [limit]);
}

function getLastCalledFromDB(): (TicketCalledPayload & { priority?: string }) | null {
  const row = getDatabase().getFirstSync<{
    ticket_number: string; desk: string | null;
    section_title: string | null; full_name: string | null;
    priority: string | null;
  }>(`
    SELECT q.ticket_number, q.desk,
           COALESCE(q.priority,'normal') as priority,
           ss.title AS section_title,
           u.full_name
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    LEFT JOIN users u ON u.id = q.served_by
    WHERE q.status IN ('calling','serving')
    ORDER BY q.called_at DESC
    LIMIT 1
  `);
  if (!row) return null;
  return {
    ticketNumber: row.ticket_number,
    desk:         row.desk ?? 'Estación',
    sectionTitle: row.section_title ?? 'General',
    servedBy:     row.full_name ?? 'Empleado',
    priority:     row.priority ?? 'normal',
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface CurrentCall extends TicketCalledPayload {
  priority?: string;
}

export default function MonitorScreen() {
  const { logout } = useAuth();
  const { soundType, setSoundType, playCallSound, isPlaying } = useMonitorSound('chime');

  const [current, setCurrent]  = useState<CurrentCall | null>(null);
  const [history, setHistory]  = useState<HistoryRow[]>([]);
  const [stats, setStats]      = useState({ waiting: 0, serving: 0, completed_today: 0, avg_wait_seconds: 0 });
  const [currentTime, setTime] = useState('');
  const [newCall, setNewCall]  = useState(false);

  const [showWeather]  = useState(true);
  const [weatherCity]  = useState('chile_vina');

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const flashAnim   = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(1)).current;
  const marqueeAnim = useRef(new Animated.Value(SW)).current;

  // ── Recargar estadísticas e historial ────────────────────────────────────

  const reloadData = useCallback(() => {
    setStats(getQueueStats());
    setHistory(getRecentCalledFromDB(8));
  }, []);

  // ── Al montar ─────────────────────────────────────────────────────────────

  useEffect(() => {
    reloadData();
    const lastCall = getLastCalledFromDB();
    if (lastCall) setCurrent(lastCall);
  }, [reloadData]);

  // ── Reloj ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        }).toUpperCase()
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Pulso continuo ────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // ── Marquee ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const run = () => {
      marqueeAnim.setValue(SW);
      Animated.timing(marqueeAnim, {
        toValue: -SW * 2, duration: 22000,
        easing: Easing.linear, useNativeDriver: true,
      }).start(({ finished }) => { if (finished) run(); });
    };
    run();
  }, [marqueeAnim]);

  // ── Animación al llamar ───────────────────────────────────────────────────

  const playCallAnimation = useCallback(() => {
    setNewCall(true);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
    Animated.sequence([
      Animated.timing(numberScale, { toValue: 1.18, duration: 200, useNativeDriver: true }),
      Animated.spring(numberScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    setTimeout(() => setNewCall(false), 3500);
  }, [flashAnim, numberScale]);

  // ── EventBus ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubCall = bus.on<TicketCalledPayload & { priority?: string }>(
      EVENTS.TICKET_CALLED,
      (payload) => {
        setCurrent(payload);
        // ✅ Reproducir sonido según tipo seleccionado
        playCallSound(payload.ticketNumber, payload.desk);
        playCallAnimation();
        reloadData();
      }
    );
    const unsubQueue = bus.on(EVENTS.QUEUE_UPDATED, reloadData);
    return () => { unsubCall(); unsubQueue(); };
  }, [playCallSound, playCallAnimation, reloadData]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert('Salir', '¿Cerrar sesión de monitor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/login'); },
      },
    ]);
  };

  const flashBg = flashAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [COLORS.surfaceContainerLowest, COLORS.primary + '18'],
  });

  const formatWait = (secs: number) =>
    secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m`;

  const currentPriority = (current?.priority ?? 'normal') as TicketPriority;
  const priColor = PRIO_COLORS[currentPriority] ?? PRIO_COLORS.normal;

  // ─── Opciones de sonido ────────────────────────────────────────────────────

  const SOUND_OPTIONS: { type: SoundType; label: string; Icon: any }[] = [
    { type: 'beep',   label: 'Beep',       Icon: Volume2 },
    { type: 'chime',  label: 'Campanilla', Icon: Music   },
    { type: 'voice',  label: 'Voz',        Icon: Mic     },
    { type: 'silent', label: 'Silencio',   Icon: VolumeX },
  ];

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.topTitle}>QueueMaster Pro</Text>
          <Text style={styles.topSub}>Monitor · Sala de Espera</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={styles.clock}>{currentTime}</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={18} color={COLORS.inverseOnSurface + 'aa'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── SELECTOR DE SONIDO ── */}
        <View style={styles.soundBar}>
          <Text style={styles.soundLabel}>
            {isPlaying ? '🔊 Reproduciendo...' : '🔔 Alerta sonora:'}
          </Text>
          <View style={styles.soundBtns}>
            {SOUND_OPTIONS.map(({ type, label, Icon }) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.soundBtn,
                  soundType === type && styles.soundBtnActive,
                ]}
                onPress={() => setSoundType(type)}
                activeOpacity={0.8}
              >
                <Icon
                  size={15}
                  color={soundType === type ? COLORS.primary : COLORS.onSurfaceVariant}
                />
                <Text style={[
                  styles.soundBtnText,
                  soundType === type && { color: COLORS.primary, fontWeight: '700' },
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── AHORA SIRVIENDO ── */}
        <Animated.View style={[styles.nowCard, { backgroundColor: flashBg }]}>
          {newCall && (
            <View style={styles.newCallBanner}>
              <Text style={styles.newCallText}>🔔 ¡NUEVO LLAMADO!</Text>
            </View>
          )}

          <View style={styles.nowHeader}>
            <Text style={styles.nowLabel}>🔔  AHORA SIRVIENDO</Text>
            {current && (
              <View style={[styles.deskBadge, { backgroundColor: priColor.bg }]}>
                <Text style={[styles.deskBadgeText, { color: priColor.text }]}>
                  {current.desk}
                </Text>
              </View>
            )}
          </View>

          {current ? (
            <>
              {/* Badge de prioridad si no es normal */}
              {currentPriority !== 'normal' && (
                <View style={[styles.prioBanner, { backgroundColor: priColor.bg }]}>
                  <Text style={[styles.prioBannerText, { color: priColor.text }]}>
                    {PRIORITY_ICONS[currentPriority]} Atención {PRIORITY_LABELS[currentPriority]}
                  </Text>
                </View>
              )}

              <Animated.Text style={[
                styles.bigNumber,
                { transform: [{ scale: numberScale }] },
              ]}>
                {current.ticketNumber}
              </Animated.Text>
              <Text style={styles.nowSection}>{current.sectionTitle}</Text>
              <View style={styles.deskRow}>
                <Text style={styles.deskLabel}>Dirígete a:</Text>
                <View style={[styles.deskChip, { borderColor: priColor.text + '44' }]}>
                  <Text style={styles.deskChipText}>{current.desk}</Text>
                </View>
              </View>
              <Text style={styles.servedBy}>Atendido por: {current.servedBy}</Text>
            </>
          ) : (
            <View style={styles.standby}>
              <Text style={styles.standbyIcon}>⏳</Text>
              <Text style={styles.standbyText}>En espera de llamado...</Text>
              <Text style={styles.standbySub}>
                El número aparecerá aquí cuando un empleado llame el siguiente turno
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── ESTADÍSTICAS ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Esperando',   val: stats.waiting,         icon: '👥', color: COLORS.primary },
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

        {/* ── HISTORIAL ── */}
        {history.length > 0 ? (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Turnos Recientes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyScroll}
            >
              {history.map((t, i) => {
                const p = (t.priority ?? 'normal') as TicketPriority;
                const pc = PRIO_COLORS[p] ?? PRIO_COLORS.normal;
                const isActive = t.status === 'calling' || t.status === 'serving';
                return (
                  <View
                    key={t.id}
                    style={[
                      styles.histChip,
                      { opacity: Math.max(0.4, 1 - i * 0.1) },
                      isActive && styles.histChipActive,
                      p !== 'normal' && { borderColor: pc.text + '55', backgroundColor: pc.bg },
                    ]}
                  >
                    <Text style={[styles.histNum, p !== 'normal' && { color: pc.text }]}>
                      {t.ticket_number}
                    </Text>
                    <Text style={styles.histDesk}>{t.desk ?? '—'}</Text>
                    {p !== 'normal' && (
                      <Text style={[styles.histPrio, { color: pc.text }]}>
                        {PRIORITY_ICONS[p]}
                      </Text>
                    )}
                    {isActive && <View style={styles.histActiveDot} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryIcon}>🎫</Text>
            <Text style={styles.emptyHistoryText}>Sin turnos llamados aún</Text>
            <Text style={styles.emptyHistorySub}>
              Los tickets aparecerán aquí cuando un empleado llame el siguiente turno
            </Text>
          </View>
        )}

      </ScrollView>

      {/* MARQUEE */}
      <View style={styles.marqueeBar}>
        <Animated.Text style={[styles.marqueeText, { transform: [{ translateX: marqueeAnim }] }]}>
          ⚡ Tiempo estimado: {formatWait(stats.avg_wait_seconds)}  •  {stats.waiting} personas en fila  •  Tenga su identificación lista  •  Atención preferencial para adultos mayores y personas con discapacidad
        </Animated.Text>
      </View>

    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.inverseSurface },
  topBar:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.inverseSurface,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLORS.inverseOnSurface },
  topSub:   { fontSize: 12, color: COLORS.inverseOnSurface + '80' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clock:    { fontSize: 13, fontWeight: '600', color: COLORS.inverseOnSurface },
  logoutBtn:{ padding: 6 },
  scroll:   { padding: 14, gap: 14, paddingBottom: 60 },

  // Selector de sonido
  soundBar: {
    backgroundColor: COLORS.surfaceContainerLowest + 'ee',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    gap: 8,
  },
  soundLabel:    { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  soundBtns:     { flexDirection: 'row', gap: 6 },
  soundBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  soundBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer + '55',
  },
  soundBtnText: { fontSize: 11, color: COLORS.onSurfaceVariant },

  // Ahora sirviendo
  nowCard: {
    borderRadius: 16, padding: 28, alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    overflow: 'hidden', minHeight: 280,
  },
  newCallBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: COLORS.primary, paddingVertical: 8, alignItems: 'center',
  },
  newCallText:  { fontSize: 14, fontWeight: '800', color: COLORS.onPrimary, letterSpacing: 2 },
  nowHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 },
  nowLabel:     { fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant, letterSpacing: 1.5, textTransform: 'uppercase' },
  deskBadge:    { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  deskBadgeText:{ fontSize: 13, fontWeight: '700' },

  // Badge prioridad en el número grande
  prioBanner: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999,
    marginBottom: 4,
  },
  prioBannerText: { fontSize: 13, fontWeight: '700' },

  bigNumber:  { fontSize: 100, fontWeight: '800', color: COLORS.primary, letterSpacing: -4, lineHeight: 110 },
  nowSection: { fontSize: 18, fontWeight: '600', color: COLORS.onSurfaceVariant },
  deskRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  deskLabel:  { fontSize: 15, color: COLORS.onSurfaceVariant },
  deskChip:   {
    backgroundColor: COLORS.primaryContainer, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  deskChipText: { fontSize: 22, fontWeight: '700', color: COLORS.onPrimaryContainer },
  servedBy:     { fontSize: 12, color: COLORS.outline, marginTop: 4 },
  standby:      { alignItems: 'center', gap: 10, paddingVertical: 20 },
  standbyIcon:  { fontSize: 48 },
  standbyText:  { fontSize: 18, fontWeight: '600', color: COLORS.onSurfaceVariant },
  standbySub:   { fontSize: 13, color: COLORS.outline, textAlign: 'center', maxWidth: 280, lineHeight: 18 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest + 'dd',
    borderRadius: 12, padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  statIcon:  { fontSize: 20 },
  statVal:   { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: COLORS.onSurfaceVariant, textAlign: 'center' },

  // Historial
  historyCard:  {
    backgroundColor: COLORS.surfaceContainerLowest + 'cc',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 10,
  },
  historyTitle:  { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  historyScroll: { gap: 10, paddingBottom: 2 },
  histChip: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
    minWidth: 80, borderWidth: 1, borderColor: COLORS.outlineVariant, position: 'relative',
  },
  histChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryContainer + '55' },
  histNum:        { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  histDesk:       { fontSize: 11, color: COLORS.onSurfaceVariant, marginTop: 2 },
  histPrio:       { fontSize: 14, marginTop: 2 },
  histActiveDot:  { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },

  emptyHistory:     { alignItems: 'center', padding: 28, gap: 8, backgroundColor: COLORS.surfaceContainerLowest + 'aa', borderRadius: 12, borderWidth: 1, borderColor: COLORS.outlineVariant },
  emptyHistoryIcon: { fontSize: 36 },
  emptyHistoryText: { fontSize: 16, fontWeight: '700', color: COLORS.onSurfaceVariant },
  emptyHistorySub:  { fontSize: 13, color: COLORS.outline, textAlign: 'center', lineHeight: 18 },

  // Marquee
  marqueeBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.primary, paddingVertical: 10, overflow: 'hidden' },
  marqueeText: { fontSize: 13, fontWeight: '600', color: COLORS.onPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
});