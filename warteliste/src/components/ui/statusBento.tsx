import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants/colors';

interface BentoSectionProps {
  title: string;
  count: string;
  progress: number;
  color: string;
  bgColor: string;
  isErrorContainer?: boolean;
}

export const BentoSection: React.FC<BentoSectionProps> = ({
  title,
  count,
  progress,
  color,
  bgColor,
  isErrorContainer = false,
}) => {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        backgroundColor: isErrorContainer ? '#ffdad630' : COLORS.surfaceContainerLow,
        borderColor: isErrorContainer ? '#ba1a1a33' : COLORS.outlineVariant,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            color: isErrorContainer ? COLORS.onErrorContainer : COLORS.onSurfaceVariant,
            fontFamily: 'Inter',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: color,
            fontFamily: 'HankenGrotesk',
          }}
        >
          {count}
        </Text>
      </View>

      {/* Progress track */}
      <View
        style={{
          width: '100%',
          height: 8,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: isErrorContainer ? COLORS.errorContainer : COLORS.surfaceContainerHigh,
        }}
      >
        <View
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
};