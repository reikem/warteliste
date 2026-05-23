import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';


interface CardContainerProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
  rightHeaderElement?: React.ReactNode;
  style?: ViewStyle;
}

export const CardContainer: React.FC<CardContainerProps> = ({ 
  title, 
  icon, 
  children, 
  rightHeaderElement, 
  style 
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <MaterialIcons name={icon} size={22} color={COLORS.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {rightHeaderElement && rightHeaderElement}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
});