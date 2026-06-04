/**
 * QueueMaster Pro — Dashboard (Empleado)
 * INTEGRACIÓN:
 *   + callNextByPriority: respeta urgent > vip > senior > normal
 *   + Badge de prioridad visible en ticket activo y en la fila
 *   + Indicador visual de prioridad en cada ítem de la cola
 *
 * Ubicación: app/(tabs)/dashboard.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Grid, RotateCcw, CheckCircle2, UserX, LogOut } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import {
  getQueueStats,
  completeTicket,
  markNoShow,
  repeatCall,
  getActiveTicketForEmployee,
} from '../../service/queueservice';
import {
  getWaitingQueueByPriority,
  callNextByPriority,
  PRIORITY_LABELS,
  PRIORITY_ICONS,
  type TicketPriority,
} from '../../service/priorityQueue';
import { bus, EVENTS } from '../../service/eventBus';
import type { Queue } from '../../service/database';
import { useAuth } from '../../store/authcontext';

// ─── Colores por prioridad ────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<TicketPriority, { bg: string; text: string }> = {
  urgent: { bg: '#fef2f2', text: '#b91c1c' },
  vip:    { bg: '#fef3c7', text: '#78350f' },
  senior: { bg: '#dbeafe', text: '#1e3a8a' },
  normal: { bg: COLORS.surfaceContainerLow, text: COLORS.onSurfaceVariant },
};

function PriorityBadge({ priority }: { priority?: string }) {
  const p = (priority ?? 'normal') as TicketPriority;
  if (p === 'normal') return null;
  const c = PRIORITY_COLORS[p];
  return (
    <View style={[priBadge.wrap, { backgroundColor: c.bg }]}>
      <Text style={[priBadge.text, { color: c.text }]}>
        {PRIORITY_ICONS[p]} {PRIORITY_LABELS[p]}
      </Text>
    </View>
  );
}

const priBadge = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();

  const [queue, setQueue]         = useState<Queue[]>([]);
  const [stats, setStats]         = useState({ waiting: 0, serving: 0, completed_today: 0, avg_wait_seconds: 0 });
  const [activeTicket, setActive] = useState<Queue | null>(null);
  const [shiftSeconds, setShift]  = useState(0);
  const [loading, setLoading]     = useState(false);

  const desk = user?.station ?? 'Desk 1';

  // ── Recargar datos ────────────────────────────────────────────────────────

  const reload = useCallback(() => {
    // FIX: usa getWaitingQueueByPriority para que la lista
    // ya venga ordenada urgent → vip → senior → normal
    setQueue(getWaitingQueueByPriority());
    setStats(getQueueStats());
    if (user) setActive(getActiveTicketForEmployee(user.id));
  }, [user]);

  useEffect(() => {
    reload();
    const unsub = bus.on(EVENTS.QUEUE_UPDATED, reload);
    return unsub;
  }, [reload]);

  // ── Cronómetro de turno ───────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => setShift(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s: number) => {
    const h   = Math.floor(s / 3600).toString().padStart(2, '0');
    const m   = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  // ── Llamar siguiente (por prioridad) ─────────────────────────────────────

  const handleCallNext = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // callNextByPriority respeta urgent > vip > senior > normal
      const next = callNextByPriority(user.id, desk);
      if (!next) {
        Alert.alert('Fila vacía', 'No hay más personas esperando.');
        return;
      }
      setActive(next);
      reload();
    } finally {
      setLoading(false);
    }
  };

  // ── Repetir llamado ───────────────────────────────────────────────────────

  const handleRepeat = () => {
    if (!user || !activeTicket) return;
    repeatCall(activeTicket.id, user.id);
    Alert.alert('📢 Re-anunciado', `Ticket ${activeTicket.ticket_number} vuelto a llamar.`);
  };

  // ── Completar ─────────────────────────────────────────────────────────────

  const handleComplete = () => {
    if (!user || !activeTicket) return;
    Alert.alert(
      'Completar',
      `¿Marcar ${activeTicket.ticket_number} como atendido?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: () => {
            completeTicket(activeTicket.id, user.id);
            setActive(null);
            reload();
          },
        },
      ],
    );
  };

  // ── No show ───────────────────────────────────────────────────────────────

  const handleNoShow = () => {
    if (!user || !activeTicket) return;
    Alert.alert(
      'No se presentó',
      `¿Marcar ${activeTicket.ticket_number} como ausente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar ausente',
          style: 'destructive',
          onPress: () => {
            markNoShow(activeTicket.id, user.id);
            setActive(null);
            reload();
          },
        },
      ],
    );
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => { await logout(); router.replace('/login'); },
      },
    ]);
  };

  const waiting = queue.filter(q => q.status === 'waiting');

  // ── Prioridad del siguiente en fila ───────────────────────────────────────
  const nextPriority = (waiting[0] as any)?.priority as TicketPriority | undefined;
  const showPriorityWarning = nextPriority && nextPriority !== 'normal';

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Grid size={22} color={COLORS.primary} />
          <View>
            <Text style={styles.headerTitle}>QueueMaster Pro</Text>
            <Text style={styles.headerSub}>{user?.full_name} · {desk}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.shiftBadge}>
            <Text style={styles.shiftLabel}>Turno</Text>
            <Text style={styles.shiftTime}>{formatTime(shiftSeconds)}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={20} color={COLORS.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* STATS */}
        <View style={styles.statsRow}>
          {[
            { label: 'Esperando',  value: stats.waiting,         color: COLORS.primary },
            { label: 'Atendiendo', value: stats.serving,         color: COLORS.secondary },
            { label: 'Hoy',        value: stats.completed_today, color: COLORS.primaryContainer },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ALERTA PRIORIDAD — aparece si el siguiente es urgente/vip/senior */}
        {showPriorityWarning && !activeTicket && (
          <View style={[
            styles.priorityAlert,
            { backgroundColor: PRIORITY_COLORS[nextPriority!].bg,
              borderColor: PRIORITY_COLORS[nextPriority!].text + '44' },
          ]}>
            <Text style={[styles.priorityAlertText, { color: PRIORITY_COLORS[nextPriority!].text }]}>
              {PRIORITY_ICONS[nextPriority!]} El siguiente turno es{' '}
              <Text style={{ fontWeight: '700' }}>{PRIORITY_LABELS[nextPriority!]}</Text>
              {' '}— tiene preferencia de atención.
            </Text>
          </View>
        )}

        {/* TICKET ACTIVO */}
        <View style={styles.activeCard}>
          <View style={[
            styles.activeAccent,
            {
              backgroundColor: activeTicket
                ? (PRIORITY_COLORS[(activeTicket as any).priority as TicketPriority]?.text ?? COLORS.primary)
                : COLORS.primary,
            },
          ]} />
          <View style={styles.activeBody}>
            <Text style={styles.activeLabel}>
              {activeTicket ? 'Atendiendo ahora' : 'Sin ticket activo'}
            </Text>
            {activeTicket ? (
              <>
                <View style={styles.activeTicketRow}>
                  <Text style={styles.activeTicketNum}>{activeTicket.ticket_number}</Text>
                  <View style={[
                    styles.sectionBadge,
                    { backgroundColor: activeTicket.section_color ?? COLORS.primaryContainer },
                  ]}>
                    <Text style={styles.sectionBadgeText}>
                      {activeTicket.section_title ?? 'General'}
                    </Text>
                  </View>
                </View>
                {/* Badge de prioridad del ticket activo */}
                <PriorityBadge priority={(activeTicket as any).priority} />
                <Text style={styles.activeDesk}>📍 {desk}</Text>
              </>
            ) : (
              <Text style={styles.activeEmpty}>
                Presiona "Llamar Siguiente" para comenzar
              </Text>
            )}
          </View>
        </View>

        {/* ACCIONES */}
        <View style={styles.actionsGrid}>

          {/* CALL NEXT */}
          <TouchableOpacity
            style={[styles.callBtn, loading && { opacity: 0.6 }]}
            onPress={handleCallNext}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <Text style={styles.callBtnIcon}>📢</Text>
                <Text style={styles.callBtnText}>Llamar Siguiente</Text>
                {stats.waiting > 0 && (
                  <View style={styles.callBadge}>
                    <Text style={styles.callBadgeText}>{stats.waiting}</Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>

          {/* Acciones secundarias */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, !activeTicket && styles.btnDisabled]}
              onPress={handleRepeat}
              disabled={!activeTicket}
              activeOpacity={0.85}
            >
              <RotateCcw size={20} color={activeTicket ? COLORS.secondary : COLORS.outline} />
              <Text style={[styles.secondaryBtnText, !activeTicket && { color: COLORS.outline }]}>
                Repetir
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, !activeTicket && styles.btnDisabled]}
              onPress={handleComplete}
              disabled={!activeTicket}
              activeOpacity={0.85}
            >
              <CheckCircle2 size={20} color={activeTicket ? COLORS.primary : COLORS.outline} />
              <Text style={[styles.secondaryBtnText, !activeTicket && { color: COLORS.outline }]}>
                Completar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, !activeTicket && styles.btnDisabled]}
              onPress={handleNoShow}
              disabled={!activeTicket}
              activeOpacity={0.85}
            >
              <UserX size={20} color={activeTicket ? COLORS.error : COLORS.outline} />
              <Text style={[styles.secondaryBtnText, !activeTicket && { color: COLORS.outline }]}>
                Ausente
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FILA DE ESPERA — ordenada por prioridad */}
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Fila de espera</Text>
            <View style={styles.queueBadge}>
              <Text style={styles.queueBadgeText}>{waiting.length} personas</Text>
            </View>
          </View>

          {waiting.length === 0 ? (
            <View style={styles.emptyQueue}>
              <Text style={styles.emptyQueueText}>🎉 ¡Fila vacía!</Text>
            </View>
          ) : (
            waiting.slice(0, 10).map((item, idx) => {
              const p = ((item as any).priority ?? 'normal') as TicketPriority;
              const isHighPrio = p !== 'normal';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.queueRow,
                    idx < waiting.length - 1 && styles.queueRowBorder,
                    isHighPrio && { backgroundColor: PRIORITY_COLORS[p].bg + '88' },
                  ]}
                >
                  <View style={[
                    styles.queueBadgeLeft,
                    { borderLeftColor: item.section_color ?? COLORS.primary },
                  ]}>
                    <Text style={styles.queueTicket}>{item.ticket_number}</Text>
                  </View>
                  <View style={styles.queueInfo}>
                    <Text style={styles.queueName}>{item.customer_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={styles.queueSub}>{item.section_title ?? 'General'}</Text>
                      {isHighPrio && (
                        <Text style={[styles.queuePrioBadge, { color: PRIORITY_COLORS[p].text }]}>
                          {PRIORITY_ICONS[p]} {PRIORITY_LABELS[p]}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.queuePos}>#{idx + 1}</Text>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  headerSub:   { fontSize: 12, color: COLORS.onSurfaceVariant },
  shiftBadge: {
    alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  shiftLabel: { fontSize: 10, color: COLORS.onSurfaceVariant, textTransform: 'uppercase' },
  shiftTime:  { fontSize: 14, fontWeight: '700', color: COLORS.onBackground },
  logoutBtn:  { padding: 8 },
  scroll:     { padding: 16, gap: 14, paddingBottom: 80 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  statNum:   { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 11, color: COLORS.onSurfaceVariant, marginTop: 2 },

  // Alerta de prioridad
  priorityAlert: {
    borderRadius: 10, padding: 12,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center',
  },
  priorityAlertText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // Ticket activo
  activeCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.outlineVariant,
    flexDirection: 'row', overflow: 'hidden',
  },
  activeAccent:    { width: 5 },
  activeBody:      { flex: 1, padding: 16, gap: 6 },
  activeLabel:     { fontSize: 12, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  activeTicketRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeTicketNum: { fontSize: 44, fontWeight: '700', color: COLORS.onBackground },
  sectionBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sectionBadgeText:{ fontSize: 12, fontWeight: '600', color: COLORS.onPrimaryContainer },
  activeDesk:      { fontSize: 13, color: COLORS.onSurfaceVariant },
  activeEmpty:     { fontSize: 14, color: COLORS.outline, fontStyle: 'italic', marginTop: 4 },

  // Acciones
  actionsGrid: { gap: 10 },
  callBtn: {
    height: 64, backgroundColor: COLORS.primary, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  callBtnIcon: { fontSize: 22 },
  callBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.onPrimary },
  callBadge: {
    backgroundColor: COLORS.onPrimary, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 4,
  },
  callBadgeText:  { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  secondaryRow:   { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1, height: 52, backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.outlineVariant,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  btnDisabled:      { opacity: 0.45 },

  // Cola
  queueCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.outlineVariant, overflow: 'hidden',
  },
  queueHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  queueTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.onBackground },
  queueBadge:     { backgroundColor: COLORS.primaryContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  queueBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.onPrimaryContainer },
  queueRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  queueRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  queueBadgeLeft: {
    width: 54, height: 54, borderRadius: 10, borderLeftWidth: 4,
    backgroundColor: COLORS.surfaceContainerLow, alignItems: 'center', justifyContent: 'center',
  },
  queueTicket:    { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  queueInfo:      { flex: 1 },
  queueName:      { fontSize: 14, fontWeight: '600', color: COLORS.onBackground },
  queueSub:       { fontSize: 12, color: COLORS.onSurfaceVariant },
  queuePrioBadge: { fontSize: 11, fontWeight: '700' },
  queuePos:       { fontSize: 13, fontWeight: '700', color: COLORS.outline },
  emptyQueue:     { padding: 32, alignItems: 'center' },
  emptyQueueText: { fontSize: 16, color: COLORS.onSurfaceVariant },
});