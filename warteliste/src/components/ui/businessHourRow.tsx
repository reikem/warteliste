import { COLORS } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View, TextInput, Switch } from 'react-native';

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
    <View style={styles.dayItem}>
      <View style={styles.dayHeaderRow}>
        <Text style={styles.dayName}>{dayLabel}</Text>
        <Switch 
          value={isActive} 
          onValueChange={onToggle}
          trackColor={{ false: '#bcc9c6', true: COLORS.primary }}
          thumbColor="#ffffff"
        />
      </View>
      <View style={[styles.timeInputsRow, !isActive && { opacity: 0.4 }]}>
        <TextInput editable={isActive} style={styles.timeInput} value={fromTime} />
        <Text style={styles.timeToText}>to</Text>
        <TextInput editable={isActive} style={styles.timeInput} value={toTime} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dayItem: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: 12,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.onSurface,
  },
  timeToText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
  },
});