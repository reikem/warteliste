import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

interface NowServingCardProps {
  ticketNumber: string;
  deskNumber: string;
  bellScale: Animated.Value;
  ticketOpacity: Animated.Value;
}

export const NowServingCard: React.FC<NowServingCardProps> = ({
  ticketNumber,
  deskNumber,
  bellScale,
  ticketOpacity,
}) => {
  return (
    <View style={styles.card}>
      {/* Top accent bar */}
      <View style={styles.topBar} />

      <View style={styles.headerRow}>
        <Animated.View style={{ transform: [{ scale: bellScale }] }}>
          <Bell size={24} color={COLORS.primary} fill={COLORS.primary} />
        </Animated.View>
        <Text style={styles.label}>Now Serving</Text>
      </View>

      <Animated.View style={[styles.ticketContainer, { opacity: ticketOpacity }]}>
        <Text style={styles.ticketNumber}>{ticketNumber}</Text>
      </Animated.View>

      <View style={styles.deskSection}>
        <Text style={styles.proceedText}>Please proceed to:</Text>
        <View style={styles.deskBadge}>
          <Text style={styles.deskText}>{deskNumber}</Text>
        </View>
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
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    // Pulse border effect approximated via border color
    borderTopColor: COLORS.primary,
    borderTopWidth: 2,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontFamily: 'HankenGrotesk',
  },
  ticketContainer: {
    marginVertical: 16,
  },
  ticketNumber: {
    fontSize: 80,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -2,
    textAlign: 'center',
    fontFamily: 'HankenGrotesk',
    lineHeight: 88,
  },
  deskSection: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  proceedText: {
    fontSize: 15,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
  },
  deskBadge: {
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deskText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer,
    fontFamily: 'HankenGrotesk',
  },
});