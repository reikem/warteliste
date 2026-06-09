/**
 * Warteliste — Print Preview v3
 * QR REAL: usa react-native-qrcode-svg (depende solo de react-native-svg,
 * que ya viene con Expo). La URL del QR abre el monitor web con el número
 * del ticket y la empresa para que el cliente pueda ver su turno.
 *
 * Instalar (si no está):
 *   pnpm add react-native-qrcode-svg
 *   (react-native-svg ya viene con expo — no necesita instalación extra)
 *
 * Ruta del monitor público:
 *   https://vmgvnxzcfqhmjexfkthk.supabase.co/functions/v1/monitor
 *   ?empresa=SLUG&ticket=A-001
 *
 * Ubicación: app/(tabs)/printPreview.tsx
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, Clock, Home, Bell, ExternalLink } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { lastCreatedTicket } from './kiosk';
import {
  PRIORITY_LABELS, PRIORITY_ICONS, type TicketPriority,
} from '../../service/priorityQueue';
import { useQueueTimer } from '@/hooks/useQueueTimer';

// ─── URL del monitor público ──────────────────────────────────────────────────
// Esta URL se encodea en el QR. El cliente la escanea y ve el monitor
// en tiempo real con su número resaltado.

const MONITOR_BASE = 'https://vmgvnxzcfqhmjexfkthk.supabase.co/functions/v1/monitor';

function buildMonitorUrl(companySlug: string, ticketNumber: string): string {
  const slug   = encodeURIComponent(companySlug);
  const ticket = encodeURIComponent(ticketNumber);
  return `${MONITOR_BASE}?empresa=${slug}&ticket=${ticket}`;
}

// ─── Colores de prioridad ─────────────────────────────────────────────────────

const PRIO: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  urgent: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
  vip:    { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' },
  senior: { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  normal: { bg: COLORS.primaryContainer + '33', text: COLORS.primary, border: COLORS.primary + '33' },
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function PrintPreviewScreen() {
  const ticket   = lastCreatedTicket;
  const priority = (ticket?.priority ?? 'normal') as TicketPriority;
  const pc       = PRIO[priority];

  const { ahead, estimatedWaitMinutes, elapsedFormatted, isNext, isCalled } =
    useQueueTimer(ticket?.ticketId ?? null, ticket?.avgTime ?? 10);

  // URL que va en el QR
  const monitorUrl = ticket
    ? buildMonitorUrl(ticket.companySlug ?? 'warteliste', ticket.ticketNumber)
    : MONITOR_BASE;

  // Animación de pulso
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isNext && !isCalled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isNext, isCalled, pulse]);

  const handleNewTicket  = () => router.replace('/kiosk');
  const handleOpenMonitor = () => Linking.openURL(monitorUrl).catch(() => {});

  // ── Sin ticket ────────────────────────────────────────────────────────────

  if (!ticket) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.noTicket}>
          <Text style={{ fontSize: 48 }}>🎫</Text>
          <Text style={s.noTicketText}>No hay ticket activo.</Text>
          <TouchableOpacity style={s.homeBtn} onPress={handleNewTicket}>
            <Text style={s.homeBtnText}>Ir al Kiosco</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Alerta: es tu turno */}
        {isCalled && (
          <Animated.View style={[s.calledAlert, { transform: [{ scale: pulse }] }]}>
            <Bell size={22} color={COLORS.onPrimary} />
            <Text style={s.calledAlertText}>¡Es tu turno! Pasa a {ticket.sectionTitle}</Text>
          </Animated.View>
        )}

        {!isCalled && isNext && (
          <Animated.View style={[s.nextAlert, { transform: [{ scale: pulse }] }]}>
            <Bell size={18} color="#78350f" />
            <Text style={s.nextAlertText}>¡Prepárate! Eres el siguiente</Text>
          </Animated.View>
        )}

        {/* ── TICKET ── */}
        <View style={s.ticketCard}>
          <View style={s.holeL} />
          <View style={s.holeR} />

          {/* Cabecera */}
          <View style={s.head}>
            <View style={s.headIcon}><Ticket size={24} color={COLORS.onPrimaryContainer} /></View>
            <Text style={s.headBrand}>WARTELISTE</Text>
            <Text style={s.headBranch}>{ticket.companyName ?? 'Sucursal Central'}</Text>
          </View>

          {/* Badge prioridad */}
          {priority !== 'normal' && (
            <View style={[s.prioBadge, { backgroundColor: pc.bg, borderColor: pc.border }]}>
              <Text style={[s.prioBadgeText, { color: pc.text }]}>
                {PRIORITY_ICONS[priority]} Atención {PRIORITY_LABELS[priority]}
              </Text>
            </View>
          )}

          <View style={s.dashed} />

          {/* Sección */}
          <View style={s.secRow}>
            <Text style={s.secLabel}>SERVICIO</Text>
            <Text style={s.secVal}>{ticket.sectionTitle}</Text>
          </View>

          {/* Número */}
          <View style={s.numSection}>
            <Text style={s.numLabel}>Tu turno es</Text>
            <Animated.Text style={[
              s.num,
              (isNext || isCalled) && { transform: [{ scale: pulse }] },
              isCalled && { color: COLORS.primary },
            ]}>
              {ticket.ticketNumber}
            </Animated.Text>
          </View>

          <View style={s.dashed} />

          {/* Espera en tiempo real */}
          <View style={s.waitRow}>
            <View style={s.waitItem}>
              <Clock size={15} color={COLORS.primary} />
              <Text style={s.waitLbl}>Espera est.</Text>
              <Text style={s.waitVal}>{isCalled ? '¡Ahora!' : `~${estimatedWaitMinutes}m`}</Text>
            </View>
            <View style={s.waitDiv} />
            <View style={s.waitItem}>
              <Text style={s.waitLbl}>Adelante</Text>
              <Text style={[s.waitVal, ahead === 0 && { color: COLORS.primary }]}>
                {isCalled ? '0' : ahead}
              </Text>
            </View>
            <View style={s.waitDiv} />
            <View style={s.waitItem}>
              <Text style={s.waitLbl}>Tiempo aquí</Text>
              <Text style={s.waitVal}>{elapsedFormatted}</Text>
            </View>
          </View>

          <View style={s.dashed} />

          {/* ── QR REAL ── */}
          <View style={s.qrSection}>
            <Text style={s.qrLabel}>
              Escanea para ver tu turno en pantalla
            </Text>

            {/* QRCode de react-native-qrcode-svg */}
            <TouchableOpacity
              style={s.qrContainer}
              onPress={handleOpenMonitor}
              activeOpacity={0.8}
            >
              <QRCode
                value={monitorUrl}
                size={120}
                color="#1a2e2b"
                backgroundColor="#ffffff"
                ecl="M"
              />
            </TouchableOpacity>

            {/* URL visible + botón abrir */}
            <TouchableOpacity style={s.qrUrlRow} onPress={handleOpenMonitor}>
              <ExternalLink size={12} color={COLORS.primary} />
              <Text style={s.qrUrlText} numberOfLines={1} ellipsizeMode="middle">
                {monitorUrl}
              </Text>
            </TouchableOpacity>
            <Text style={s.qrHint}>
              Toca el QR o la URL para abrir el monitor en tu navegador
            </Text>
          </View>

          <View style={s.dashed} />

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerMsg}>
              Permanece atento a la pantalla.{'\n'}Te llamaremos cuando sea tu turno.
            </Text>
            <Text style={s.timestamp}>{ticket.timestamp}</Text>
          </View>
        </View>

        {/* Confirmación */}
        <View style={[s.confirmBox, { borderColor: pc.border, backgroundColor: pc.bg }]}>
          <Text style={[s.confirmText, { color: pc.text }]}>
            ¡Hola <Text style={{ fontWeight: '700' }}>{ticket.customerName}</Text>!{' '}
            Tu ticket ha sido registrado correctamente.
          </Text>
        </View>

        {/* Botones */}
        <View style={s.actions}>
          <TouchableOpacity style={s.monitorBtn} onPress={handleOpenMonitor} activeOpacity={0.85}>
            <ExternalLink size={18} color={COLORS.primary} />
            <Text style={s.monitorBtnText}>Ver monitor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.newTicketBtn} onPress={handleNewTicket} activeOpacity={0.85}>
            <Home size={18} color={COLORS.onPrimary} />
            <Text style={s.newTicketBtnText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.background },
  scroll:   { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center', gap: 14 },
  noTicket: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  noTicketText: { fontSize: 16, color: COLORS.onSurfaceVariant },
  homeBtn:  { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: 10 },
  homeBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },

  calledAlert: { width: '100%', maxWidth: 340, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  calledAlertText: { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },
  nextAlert: { width: '100%', maxWidth: 340, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fcd34d' },
  nextAlertText: { fontSize: 14, fontWeight: '700', color: '#78350f' },

  ticketCard: { width: '100%', maxWidth: 340, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: COLORS.outlineVariant, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6, position: 'relative' },
  holeL: { position: 'absolute', left: -10, top: '50%', width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.outlineVariant },
  holeR: { position: 'absolute', right: -10, top: '50%', width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.outlineVariant },

  head:      { alignItems: 'center', gap: 5 },
  headIcon:  { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  headBrand: { fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant, letterSpacing: 2 },
  headBranch:{ fontSize: 11, color: COLORS.outline },

  prioBadge:     { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  prioBadgeText: { fontSize: 13, fontWeight: '700' },

  dashed:  { width: '100%', borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, borderStyle: 'dashed' },
  secRow:  { alignItems: 'center', gap: 2 },
  secLabel:{ fontSize: 10, letterSpacing: 1.5, color: COLORS.outline },
  secVal:  { fontSize: 17, fontWeight: '600', color: COLORS.onBackground },

  numSection: { alignItems: 'center', gap: 4 },
  numLabel:   { fontSize: 12, color: COLORS.onSurfaceVariant },
  num:        { fontSize: 76, fontWeight: '800', color: COLORS.onBackground, letterSpacing: -3, lineHeight: 82 },

  waitRow: { flexDirection: 'row', width: '100%', gap: 8 },
  waitItem:{ flex: 1, alignItems: 'center', gap: 3 },
  waitDiv: { width: 1, backgroundColor: COLORS.outlineVariant },
  waitLbl: { fontSize: 9, color: COLORS.outline, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  waitVal: { fontSize: 17, fontWeight: '700', color: COLORS.onBackground, textAlign: 'center' },

  // QR
  qrSection:   { alignItems: 'center', gap: 8, width: '100%' },
  qrLabel:     { fontSize: 11, color: COLORS.onSurfaceVariant, textAlign: 'center' },
  qrContainer: { padding: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.outlineVariant, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  qrUrlRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.primaryContainer + '33' },
  qrUrlText:   { fontSize: 9, color: COLORS.primary, maxWidth: 220 },
  qrHint:      { fontSize: 10, color: COLORS.outline, textAlign: 'center' },

  footer:    { alignItems: 'center', gap: 6, width: '100%' },
  footerMsg: { fontSize: 11, color: COLORS.onSurfaceVariant, textAlign: 'center', lineHeight: 17, fontStyle: 'italic' },
  timestamp: { fontSize: 9, color: COLORS.outline, letterSpacing: 0.5 },

  confirmBox: { width: '100%', maxWidth: 340, borderRadius: 12, padding: 14, borderWidth: 1 },
  confirmText:{ flex: 1, fontSize: 14, lineHeight: 20 },

  actions:      { width: '100%', maxWidth: 340, flexDirection: 'row', gap: 10 },
  monitorBtn:   { flex: 1, height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primaryContainer + '33' },
  monitorBtnText:{ fontSize: 14, fontWeight: '700', color: COLORS.primary },
  newTicketBtn: { flex: 2, height: 50, borderRadius: 12, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  newTicketBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.onPrimary },
});