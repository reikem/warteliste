import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

interface KioskInputProps {
  label: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
}

export const KioskInput: React.FC<KioskInputProps> = ({
  label,
  value,
  placeholder,
  icon,
  isFocused,
  onPress,
}) => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
        ]}
      >
        <View style={styles.iconWrap}>{icon}</View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.outline}
          value={value}
          editable={false}
          pointerEvents="none"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.onSurfaceVariant,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter',
  },
  inputRow: {
    width: '100%',
    height: 60,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  inputRowFocused: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceContainerLowest,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {},
  input: {
    flex: 1,
    fontSize: 17,
    color: COLORS.onBackground,
    fontFamily: 'Inter',
  },
});