import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Sun, CloudRain } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

export interface WeatherState {
  isSunny: boolean;
  desc: string;
  temp: string;
  high: string;
  low: string;
}

interface WeatherWidgetProps {
  data: WeatherState;
  onPress: () => void;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ data, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={styles.container}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          {data.isSunny
            ? <Sun size={32} color={COLORS.primary} />
            : <CloudRain size={32} color={COLORS.secondary} />
          }
        </View>
        <View>
          <Text style={styles.city}>New York</Text>
          <Text style={styles.desc}>{data.desc}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.temp}>{data.temp}</Text>
        <View style={styles.hiloRow}>
          <Text style={styles.hilo}>{data.high}</Text>
          <Text style={styles.hilo}>{data.low}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    padding: 8,
    borderRadius: 999,
  },
  city: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer,
    fontFamily: 'HankenGrotesk',
  },
  desc: {
    fontSize: 14,
    color: COLORS.onPrimaryContainer,
    opacity: 0.8,
    fontFamily: 'Inter',
  },
  right: {
    alignItems: 'flex-end',
  },
  temp: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer,
    fontFamily: 'HankenGrotesk',
  },
  hiloRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hilo: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.onPrimaryContainer,
    opacity: 0.8,
    fontFamily: 'Inter',
  },
});