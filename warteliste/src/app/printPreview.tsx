/**
 * QueueMaster Pro — Print Preview (Kiosco)
 * Muestra el ticket recién creado y permite volver al kiosco.
 * Lee los datos del ticket desde kiosk.tsx (lastCreatedTicket).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, Clock, QrCode, Home, CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { lastCreatedTicket } from './kiosk';
import { getQueueStats } from '../../service/queueservice';

export default function PrintPreviewScreen() {
  const [ticket, setTicket] = useState(lastCreatedTicket);
  const [waitingAhead, setWaitingAhead] = useState(0);

  useEffect(() => {
    if (lastCreatedTicket) {
      setTicket(lastCreatedTicket);
      const stats = getQueueStats();
      setWaitingAhead(Math.max(0, stats.waiting - 1));
    }
  }, []);

  const handleNewTicket = () => {
    router.replace('/kiosk');
  };

  if (!ticket) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.noTicket}>
          <Text style={styles.noTicketText}>No hay ticket activo.</Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/kiosk')}>
            <Text style={styles.homeBtnText}>Ir al Kiosco</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>

        {/* TICKET FÍSICO */}
        <View style={styles.ticketCard}>
          {/* Perforaciones laterales decorativas */}
          <View style={styles.holeLeft} />
          <View style={styles.holeRight} />

          {/* Encabezado */}
          <View style={styles.ticketHeader}>
            <View style={styles.iconWrap}>
              <Ticket size={26} color={COLORS.onPrimaryContainer} />
            </View>
            <Text style={styles.brand}>QueueMaster Pro</Text>
            <Text style={styles.branchName}>Sucursal Central</Text>
          </View>

          <View style={styles.dashed} />

          {/* Sección */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Servicio</Text>
            <Text style={styles.sectionValue}>{ticket.sectionTitle}</Text>
          </View>

          {/* Número de ticket — elemento más destacado */}
          <View style={styles.numberSection}>
            <Text style={styles.yourTicket}>Tu turno es</Text>
            <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
          </View>

          <View style={styles.dashed} />

          {/* Info de espera */}
          <View style={styles.waitRow}>
            <View style={styles.waitItem}>
              <Clock size={18} color={COLORS.primary} />
              <Text style={styles.waitLabel}>Tiempo estimado</Text>
              <Text style={styles.waitValue}>{ticket.estimatedWait}</Text>
            </View>
            <View style={styles.waitDivider} />
            <View style={styles.waitItem}>
              <Text style={styles.waitLabel}>Personas antes</Text>
              <Text style={styles.waitValue}>{waitingAhead}</Text>
            </View>
          </View>

          <View style={styles.dashed} />

          {/* QR + timestamp */}
          <View style={styles.footer}>
            <Text style={styles.footerMsg}>
              Permanece atento a la pantalla.{'\n'}Te llamaremos cuando sea tu turno.
            </Text>
            <View style={styles.qrBox}>
              <QrCode size={54} color={COLORS.onSurfaceVariant} />
            </View>
            <Text style={styles.timestamp}>{ticket.timestamp}</Text>
          </View>
        </View>

        {/* Mensaje de confirmación */}
        <View style={styles.confirmBox}>
          <CheckCircle size={20} color={COLORS.primary} />
          <Text style={styles.confirmText}>
            ¡Registro exitoso! Hola <Text style={{ fontWeight: '700' }}>{ticket.customerName}</Text>.
          </Text>
        </View>

        {/* Botón volver al kiosco */}
        <TouchableOpacity style={styles.newTicketBtn} onPress={handleNewTicket} activeOpacity={0.85}>
          <Home size={20} color={COLORS.onPrimary} />
          <Text style={styles.newTicketBtnText}>Volver al Inicio</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  inner: {
    flex: 1, paddingHorizontal: 20, paddingVertical: 24,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  noTicket: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  noTicketText: { fontSize: 16, color: COLORS.onSurfaceVariant },
  homeBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: COLORS.primary, borderRadius: 10,
  },
  homeBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },

  ticketCard: {
    width: '100%', maxWidth: 340,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
    position: 'relative',
  },
  holeLeft: {
    position: 'absolute', left: -10, top: '48%',
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  holeRight: {
    position: 'absolute', right: -10, top: '48%',
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  ticketHeader: { alignItems: 'center', gap: 6 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 14, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1.5 },
  branchName: { fontSize: 12, color: COLORS.outline },
  dashed: { width: '100%', borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, borderStyle: 'dashed' },
  sectionRow: { alignItems: 'center', gap: 2 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.outline },
  sectionValue: { fontSize: 18, fontWeight: '600', color: COLORS.onBackground },
  numberSection: { alignItems: 'center', gap: 4 },
  yourTicket: { fontSize: 13, color: COLORS.onSurfaceVariant },
  ticketNumber: { fontSize: 72, fontWeight: '800', color: COLORS.primary, letterSpacing: -2, lineHeight: 76 },
  waitRow: { flexDirection: 'row', width: '100%', gap: 8 },
  waitItem: { flex: 1, alignItems: 'center', gap: 4 },
  waitDivider: { width: 1, backgroundColor: COLORS.outlineVariant },
  waitLabel: { fontSize: 11, color: COLORS.outline, textTransform: 'uppercase', letterSpacing: 0.5 },
  waitValue: { fontSize: 20, fontWeight: '700', color: COLORS.onBackground },
  footer: { alignItems: 'center', gap: 10, width: '100%' },
  footerMsg: { fontSize: 12, color: COLORS.onSurfaceVariant, textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },
  qrBox: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.7,
  },
  timestamp: { fontSize: 10, color: COLORS.outline, letterSpacing: 0.5 },

  confirmBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primaryFixed + '33',
    borderRadius: 12, padding: 14, width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: COLORS.primary + '33',
  },
  confirmText: { flex: 1, fontSize: 14, color: COLORS.onBackground, lineHeight: 20 },

  newTicketBtn: {
    width: '100%', maxWidth: 340, height: 56, borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  newTicketBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.onPrimary },
});