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
  // Mapeo dinámico de iconos basado en el título de la sección
  const getIconName = (title: string): keyof typeof MaterialIcons.glyphMap => {
    switch (title.toLowerCase()) {
      case 'sales': return 'sell';
      case 'support': return 'support-agent';
      case 'payments': return 'payments';
      default: return 'business-center'; // <-- Cambiado "_" por "-"
    }
  };


  return (
    <View style={styles.sectionItemCard}>
      <View style={styles.sectionItemHeader}>
        <View style={styles.sectionIconBadge}>
          <MaterialIcons name={getIconName(section.title)} size={20} color={COLORS.primary} />
        </View>
        <TouchableOpacity onPress={() => onDelete(section.id)}>
          <MaterialIcons name="delete" size={20} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionItemTitle}>{section.title}</Text>
      <Text style={styles.sectionItemDesc}>{section.description}</Text>
      
      <View style={styles.sectionFooterRow}>
        <View style={styles.avgBadge}>
          <Text style={styles.avgBadgeText}>Avg. {section.avgTime}</Text>
        </View>
        
        <View style={styles.staffContainer}>
          {section.staff.map((st, idx) => (
            <View key={idx} style={[styles.staffAvatar, { marginLeft: idx === 0 ? 0 : -8 }]}>
              <Text style={styles.staffAvatarText}>{st}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.addStaffBtn}>
            <MaterialIcons name="person-add" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionItemCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 4,
  },
  sectionItemDesc: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 12,
  },
  sectionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avgBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  avgBadgeText: {
    fontSize: 11,
    color: COLORS.onSurface,
  },
  staffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.secondaryContainer,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addStaffBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});