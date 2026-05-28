import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

interface QueueItemProps {
  ticket: string;
  name: string;
  service: string;
  waitTime: number;
  borderColor?: string;
  onPressMenu?: () => void;
}

export const QueueItem: React.FC<QueueItemProps> = ({
  ticket,
  name,
  service,
  waitTime,
  borderColor = COLORS.primary,
  onPressMenu,
}) => {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={[styles.ticketBadge, { borderLeftColor: borderColor }]}>
          <Text style={styles.ticketText}>{ticket}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.detail}>
            {service} • Wait: {waitTime} min
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onPressMenu} style={styles.menuBtn} activeOpacity={0.7}>
        <MoreVertical size={20} color={COLORS.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  ticketBadge: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.surfaceContainerHigh + '66', // 40% opacity
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 4,
  },
  ticketText: {
    fontWeight: '700',
    color: COLORS.primary,
    fontSize: 18,
    fontFamily: 'HankenGrotesk',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.onBackground,
    fontFamily: 'HankenGrotesk',
  },
  detail: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
  },
  menuBtn: {
    padding: 8,
    borderRadius: 999,
  },
});