import React from 'react';
import { View, Text, Animated } from 'react-native';
import { Bell, Countertop } from 'lucide-react-native';

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
    <View className="w-full bg-white border border-[#bcc9c6] rounded-xl p-8 items-center shadow-sm relative overflow-hidden">
      <View className="absolute top-0 left-0 right-0 h-1 bg-[#00685f]" />
      
      <View className="flex-row items-center gap-2 mb-2">
        <Animated.View style={{ transform: [{ scale: bellScale }] }}>
          <Bell size={24} color="#00685f" fill="#00685f" />
        </Animated.View>
        <Text className="text-sm text-[#565e74] uppercase tracking-[0.2em] font-bold font-[HankenGrotesk]">
          Now Serving
        </Text>
      </View>
      
      <Animated.View style={{ opacity: ticketOpacity }} className="mb-4">
        <Text className="text-7xl font-bold text-[#00685f] tracking-tighter text-center font-[HankenGrotesk]">
          {ticketNumber}
        </Text>
      </Animated.View>
      
      <View className="w-full items-center gap-3">
        <Text className="text-base text-[#3d4947] font-[Inter]">Please proceed to:</Text>
        <View className="bg-[#008378] px-10 py-3 rounded-xl flex-row items-center gap-4 shadow-sm">
          <Countertop size={28} color="#f4fffc" />
          <Text className="text-3xl font-bold text-[#f4fffc] font-[HankenGrotesk]">
            {deskNumber}
          </Text>
        </View>
      </View>
    </View>
  );
};