import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Mic } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

interface CallingCardProps {
  ticketNumber: string;
  customerName: string;
  serviceType: string;
  onCallNext: () => void;
}

export const CallingCard: React.FC<CallingCardProps> = ({
  ticketNumber,
  customerName,
  serviceType,
  onCallNext,
}) => {
  return (
    <View style={styles.card}>
      {/* Left accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.label}>Currently Calling</Text>
          <View style={styles.ticketRow}>
            <Text style={styles.ticketNumber}>{ticketNumber}</Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>
          <Text style={styles.serviceType}>Service: {serviceType}</Text>
        </View>

        <TouchableOpacity
          onPress={onCallNext}
          activeOpacity={0.85}
          style={styles.callButton}
        >
          <Mic size={20} color={COLORS.onPrimary} />
          <Text style={styles.callButtonText}>Call Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accentBar: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingLeft: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter',
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  ticketNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.onBackground,
    fontFamily: 'HankenGrotesk',
    lineHeight: 56,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
  },
  serviceType: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    height: 52,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onPrimary,
    fontFamily: 'HankenGrotesk',
  },
});