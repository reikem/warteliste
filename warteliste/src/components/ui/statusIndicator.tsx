import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

interface StatusIndicatorProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ title, subtitle, icon }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {icon}
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant + '80',
    width: '100%',
  },
  iconWrap: {
    padding: 8,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onBackground,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
    marginTop: 2,
  },
});