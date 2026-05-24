import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Sun, CloudRain } from 'lucide-react-native';

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
      activeOpacity={0.9}
      className="w-full bg-[#e5eeff] border border-[#bcc9c6] rounded-lg p-4 flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-4">
        <View className="bg-white/40 p-2 rounded-full">
          {data.isSunny ? (
            <Sun size={32} color="#00685f" />
          ) : (
            <CloudRain size={32} color="#565e74" />
          )}
        </View>
        <View>
          <Text className="text-lg font-bold text-[#0b1c30] font-[HankenGrotesk]">New York</Text>
          <Text className="text-sm text-[#3d4947] font-[Inter]">{data.desc}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="text-3xl font-bold text-[#00685f] font-[HankenGrotesk]">{data.temp}</Text>
        <View className="flex-row gap-2">
          <Text className="text-[13px] font-medium text-[#3d4947] font-[Inter]">{data.high}</Text>
          <Text className="text-[13px] font-medium text-[#3d4947] font-[Inter]">{data.low}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};