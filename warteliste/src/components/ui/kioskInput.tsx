import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

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
    <View className="flex-col gap-2 w-full">
      <Text className="text-[13px] font-medium text-[#3d4947] px-1 uppercase tracking-wider font-[Inter]">
        {label}
      </Text>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        className={`relative w-full h-16 bg-[#eff4ff] border rounded-lg flex-row items-center px-4 transition-all ${
          isFocused ? 'border-[#00685f] border-2 shadow-sm' : 'border-[#bcc9c6]'
        }`}
      >
        <View className="mr-3">{icon}</View>
        <TextInput
          className="flex-1 text-lg text-[#0b1c30] font-[Inter]"
          placeholder={placeholder}
          placeholderTextColor="#6d7a77"
          value={value}
          editable={false} // Se controla mediante el teclado virtual de la pantalla
          pointerEvents="none"
        />
      </TouchableOpacity>
    </View>
  );
};