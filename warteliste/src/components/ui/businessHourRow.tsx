import React from 'react';
import { StyleSheet, Text, View, TextInput, Switch } from 'react-native';
import { COLORS } from '@/constants/colors';

interface BusinessHourRowProps {
  dayLabel: string;
  isActive: boolean;
  fromTime: string;
  toTime: string;
  onToggle: (val: boolean) => void;
}

export const BusinessHourRow: React.FC<BusinessHourRowProps> = ({
  dayLabel,
  isActive,
  fromTime,
  toTime,
  onToggle,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.dayName}>{dayLabel}</Text>
        <Switch
          value={isActive}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.outlineVariant, true: COLORS.primary }}
          thumbColor={COLORS.surfaceContainerLowest}
        />
      </View>
      <View style={[styles.timeRow, !isActive && styles.disabled]}>
        <TextInput editable={isActive} style={styles.timeInput} value={fromTime} />
        <Text style={styles.toText}>to</Text>
        <TextInput editable={isActive} style={styles.timeInput} value={toTime} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
    fontFamily: 'Inter',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  timeInput: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.onSurface,
    fontFamily: 'Inter',
  },
  toText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
  },
});