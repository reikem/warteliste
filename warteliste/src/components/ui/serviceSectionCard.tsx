import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface ServiceSection {
  id: string;
  title: string;
  description: string;
  avgTime: string;
  staff: string[];
}

interface ServiceSectionCardProps {
  section: ServiceSection;
  onDelete: (id: string) => void;
}

export const ServiceSectionCard: React.FC<ServiceSectionCardProps> = ({ section, onDelete }) => {
  const getIconName = (title: string): keyof typeof MaterialIcons.glyphMap => {
    switch (title.toLowerCase()) {
      case 'sales': return 'sell';
      case 'support': return 'support-agent';
      case 'payments': return 'payments';
      default: return 'business-center';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <MaterialIcons name={getIconName(section.title)} size={20} color={COLORS.primary} />
        </View>
        <TouchableOpacity onPress={() => onDelete(section.id)} activeOpacity={0.7}>
          <MaterialIcons name="delete" size={20} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionDesc}>{section.description}</Text>

      <View style={styles.footer}>
        <View style={styles.avgBadge}>
          <Text style={styles.avgText}>Avg. {section.avgTime}</Text>
        </View>

        <View style={styles.staffRow}>
          {section.staff.map((initials, idx) => (
            <View
              key={idx}
              style={[
                styles.staffAvatar,
                { marginLeft: idx === 0 ? 0 : -8 },
              ]}
            >
              <Text style={styles.staffText}>{initials}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.addStaff}>
            <MaterialIcons name="person-add" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onSurface,
    fontFamily: 'HankenGrotesk',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'Inter',
    lineHeight: 18,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avgBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  avgText: {
    fontSize: 11,
    color: COLORS.onSurface,
    fontFamily: 'Inter',
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondaryContainer,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'Inter',
  },
  addStaff: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});