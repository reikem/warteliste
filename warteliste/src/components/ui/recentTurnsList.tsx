import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { History } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

export interface Ticket {
  id: string;
  number: string;
  desk: string;
}

interface RecentTurnsListProps {
  turns: Ticket[];
}

export const RecentTurnsList: React.FC<RecentTurnsListProps> = ({ turns }) => {
  const opacities = [1, 0.75, 0.5, 0.3];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <History size={18} color={COLORS.onSurfaceVariant} />
        <Text style={styles.title}>Recent Turns</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {turns.map((turn, index) => (
          <View
            key={turn.id}
            style={[
              styles.turnCard,
              { opacity: opacities[index] ?? 0.2 },
            ]}
          >
            <Text style={styles.turnNumber}>{turn.number}</Text>
            <Text style={styles.turnDesk}>{turn.desk}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: 'Inter',
  },
  scroll: {
    gap: 12,
    paddingRight: 8,
  },
  turnCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    minWidth: 100,
  },
  turnNumber: {
    fontWeight: '700',
    color: COLORS.primary,
    fontSize: 17,
    fontFamily: 'HankenGrotesk',
  },
  turnDesk: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
    marginTop: 2,
  },
});