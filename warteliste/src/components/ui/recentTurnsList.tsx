import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { History } from 'lucide-react-native';

export interface Ticket {
  id: string;
  number: string;
  desk: string;
}

interface RecentTurnsListProps {
  turns: Ticket[];
}

export const RecentTurnsList: React.FC<RecentTurnsListProps> = ({ turns }) => {
  const opacities = ['opacity-100', 'opacity-75', 'opacity-50', 'opacity-30'];

  return (
    <View className="w-full bg-white border border-[#bcc9c6] rounded-lg p-4 shadow-sm">
      <View className="flex-row items-center gap-2 mb-3">
        <History size={18} color="#3d4947" />
        <Text className="text-[13px] font-bold text-[#3d4947] uppercase tracking-widest font-[Inter]">
          Recent Turns
        </Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
        {turns.map((turn, index) => (
          <View 
            key={turn.id} 
            className={`bg-[#eff4ff] px-6 py-3 rounded-lg border border-[#bcc9c6] items-center min-w-[110px] ${opacities[index] || 'opacity-25'}`}
          >
            <Text className="font-bold text-[#00685f] text-lg font-[HankenGrotesk]">{turn.number}</Text>
            <Text className="text-xs font-medium text-[#3d4947] font-[Inter]">{turn.desk}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};