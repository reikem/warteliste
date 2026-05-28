import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ticket, Clock, QrCode } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

interface ThermalTicketProps {
  category: string;
  ticketNumber: string;
  estimatedWait: string;
  footerMessage: string;
  timestamp: string;
}

export const ThermalTicket: React.FC<ThermalTicketProps> = ({
  category,
  ticketNumber,
  estimatedWait,
  footerMessage,
  timestamp,
}) => {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ticket size={24} color={COLORS.onPrimaryContainer} />
        </View>
        <Text style={styles.brand}>QueueMaster Pro</Text>
      </View>

      <View style={styles.dashed} />

      {/* Main ticket info */}
      <View style={styles.mainSection}>
        <Text style={styles.category}>{category}</Text>
        <Text style={styles.ticketNumber}>{ticketNumber}</Text>
        <Text style={styles.registered}>Su turno ha sido registrado</Text>
      </View>

      <View style={styles.dashed} />

      {/* Wait time */}
      <View style={styles.waitSection}>
        <Clock size={20} color={COLORS.primary} />
        <Text style={styles.waitLabel}>Tiempo estimado:</Text>
        <Text style={styles.waitTime}>{estimatedWait}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerMsg}>{footerMessage}</Text>
        <View style={styles.qrWrap}>
          <View style={styles.qrBox}>
            <QrCode size={56} color={COLORS.onSurfaceVariant} />
          </View>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 310,
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant + '66',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: 'Inter',
  },
  dashed: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  mainSection: {
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    gap: 4,
  },
  category: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    fontFamily: 'HankenGrotesk',
  },
  ticketNumber: {
    fontSize: 64,
    fontWeight: '700',
    color: COLORS.onBackground,
    letterSpacing: -2,
    fontFamily: 'HankenGrotesk',
    lineHeight: 72,
    marginVertical: 4,
  },
  registered: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
    marginTop: 8,
  },
  waitSection: {
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  waitLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
    marginTop: 4,
  },
  waitTime: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'HankenGrotesk',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  footerMsg: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  qrWrap: {
    alignItems: 'center',
    opacity: 0.7,
  },
  qrBox: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'Inter',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
  },
});