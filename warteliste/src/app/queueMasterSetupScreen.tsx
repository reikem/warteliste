import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TextInput, 
  TouchableOpacity, Switch, SafeAreaView, Platform 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessHourRow } from '@/components/ui/businessHourRow';
import { CardContainer } from '@/components/ui/cardContainer';
import { ServiceSectionCard } from '@/components/ui/serviceSectionCard';
import { COLORS } from '@/constants/colors';

// Importación de Componentes Modulares


// Interfaces para tipado estricto en TS
interface BusinessHour {
  active: boolean;
  from: string;
  to: string;
}

interface BusinessHoursState {
  monday: BusinessHour;
  tueFri: BusinessHour;
  weekend: BusinessHour;
}

interface ServiceSection {
  id: string;
  title: string;
  description: string;
  avgTime: string;
  staff: string[];
}

export default function QueueMasterSetupScreen() {
  // Estados Base
  const [brandName, setBrandName] = useState<string>('QueueMaster Pro');
  const [brandColor, setBrandColor] = useState<string>('#00685F');
  const [activeDesks, setActiveDesks] = useState<number>(12);
  const [autoAllocate, setAutoAllocate] = useState<boolean>(true);
  
  // Estado de Horarios
  const [hours, setHours] = useState<BusinessHoursState>({
    monday: { active: true, from: '08:00', to: '18:00' },
    tueFri: { active: true, from: '08:00', to: '18:00' },
    weekend: { active: false, from: '10:00', to: '14:00' },
  });

  // Estado de Multimedia Publicitaria
  const [mediaType, setMediaType] = useState<'native' | 'url' | 'text'>('native');
  const [streamingUrl, setStreamingUrl] = useState<string>('');
  const [playbackMode, setPlaybackMode] = useState<string>('loop');

  // Estado del Módulo de Clima
  const [showWeather, setShowWeather] = useState<boolean>(true);
  const [weatherLocation, setWeatherLocation] = useState<string>('mexico_cdmx');
  const [weatherUnit, setWeatherUnit] = useState<'C' | 'F'>('C');

  // Estado de Secciones
  const [sections, setSections] = useState<ServiceSection[]>([
    { id: '1', title: 'Sales', description: 'General product inquiries and contract sign-ups.', avgTime: '12m', staff: ['JD', 'AM', '+1'] },
    { id: '2', title: 'Support', description: 'Technical assistance and troubleshooting services.', avgTime: '25m', staff: ['ST', 'RK', '+3'] },
    { id: '3', title: 'Payments', description: 'Billing, refunds, and financial account management.', avgTime: '5m', staff: ['MP', 'LB'] },
  ]);

  const handleSelectImage = () => {
    console.log('Abrir galería de imágenes');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* APP BAR */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="grid-view" size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>QueueMaster Pro</Text>
        </View>
        <View style={styles.avatarCircle}><Text style={styles.avatarText}>A</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>System Configuration</Text>
          <Text style={styles.subtitle}>Manage your branch presence, service desks, and brand aesthetics from a central hub.</Text>
        </View>

        {/* SECCIÓN 1: IDENTITY */}
        <CardContainer title="Brand Identity" icon="palette">
          <Text style={styles.label}>Brand Name</Text>
          <TextInput style={styles.input} value={brandName} onChangeText={setBrandName} />

          <Text style={styles.label}>Primary Brand Color</Text>
          <View style={styles.colorPickerContainer}>
            <View style={[styles.colorPreview, { backgroundColor: brandColor }]} />
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={brandColor} onChangeText={setBrandColor} />
          </View>
        </CardContainer>

        {/* SECCIÓN 2: CAPACITY */}
        <CardContainer title="Active Capacity" icon="computer">
          <View style={styles.counterContainer}>
            <TouchableOpacity style={styles.counterButton} onPress={() => setActiveDesks(p => Math.max(1, p - 1))}>
              <MaterialIcons name="remove" size={24} color={COLORS.onSurface} />
            </TouchableOpacity>
            <View style={styles.counterValueContainer}>
              <Text style={styles.counterNumber}>{activeDesks}</Text>
              <Text style={styles.counterLabel}>DESKS</Text>
            </View>
            <TouchableOpacity style={[styles.counterButton, { backgroundColor: COLORS.primary }]} onPress={() => setActiveDesks(p => p + 1)}>
              <MaterialIcons name="add" size={24} color={COLORS.onPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Auto-allocate desks</Text>
            </View>
            <Switch value={autoAllocate} onValueChange={setAutoAllocate} trackColor={{ false: '#bcc9c6', true: COLORS.primary }} />
          </View>
        </CardContainer>

        {/* SECCIÓN: MULTIMEDIA ADVERTISING */}
        <CardContainer title="Contenido Multimedia" icon="add-to-queue">
          <Text style={styles.descriptionText}>Configura videos o imágenes para proyectar en el monitor de la sala de espera.</Text>
          
          <Text style={styles.label}>Tipo de Entrada Publicitaria</Text>
          <View style={styles.tabContainer}>
            {(['native', 'url', 'text'] as const).map((type) => (
              <TouchableOpacity 
                key={type}
                style={[styles.tabButton, mediaType === type && styles.tabButtonActive]}
                onPress={() => setMediaType(type)}
              >
                <Text style={[styles.tabButtonText, mediaType === type && styles.tabButtonTextActive]}>
                  {type === 'native' ? 'Nativo' : type === 'url' ? 'Link URL' : 'Texto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mediaType === 'url' && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Enlace de Video o Stream</Text>
              <TextInput 
                style={styles.input} 
                placeholder="https://youtube.com/watch?v=..." 
                value={streamingUrl}
                onChangeText={setStreamingUrl}
              />
            </View>
          )}

          {mediaType === 'native' && (
            <TouchableOpacity style={styles.uploadDropzone} onPress={handleSelectImage}>
              <MaterialIcons name="cloud-upload" size={32} color={COLORS.outline} />
              <Text style={styles.uploadTitle}>Seleccionar Imagen / Video</Text>
              <Text style={styles.uploadSubtitle}>Formatos: MP4, JPG, PNG (Max 60MB)</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Modo de Reproducción</Text>
          <TextInput 
            style={styles.input} 
            value={playbackMode} 
            onChangeText={setPlaybackMode} 
            placeholder="Ej: Bucle Continuo (Loop)"
          />
        </CardContainer>

        {/* SECCIÓN: WEATHER MODULE */}
        <CardContainer title="Configuración del Clima" icon="wb-cloudy">
          <Text style={styles.descriptionText}>Muestra el estado del tiempo local en el monitor público.</Text>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Mostrar Clima en Pantalla</Text>
            <Switch value={showWeather} onValueChange={setShowWeather} trackColor={{ false: '#bcc9c6', true: COLORS.primary }} />
          </View>

          {showWeather && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Ciudad Sede</Text>
              <TextInput 
                style={styles.input} 
                value={weatherLocation} 
                onChangeText={setWeatherLocation} 
                placeholder="Ej: México, CDMX"
              />

              <Text style={styles.label}>Sistema de Unidades</Text>
              <View style={styles.tabContainer}>
                <TouchableOpacity 
                  style={[styles.tabButton, weatherUnit === 'C' && styles.tabButtonActive]}
                  onPress={() => setWeatherUnit('C')}
                >
                  <Text style={[styles.tabButtonText, weatherUnit === 'C' && styles.tabButtonTextActive]}>Métrico (°C)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tabButton, weatherUnit === 'F' && styles.tabButtonActive]}
                  onPress={() => setWeatherUnit('F')}
                >
                  <Text style={[styles.tabButtonText, weatherUnit === 'F' && styles.tabButtonTextActive]}>Imperial (°F)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </CardContainer>

        {/* SECCIÓN 3: HOURS */}
        <CardContainer title="Business Hours" icon="schedule">
          <BusinessHourRow 
            dayLabel="Lunes (Monday)" 
            isActive={hours.monday.active} 
            fromTime={hours.monday.from} 
            toTime={hours.monday.to}
            onToggle={(val) => setHours({ ...hours, monday: { ...hours.monday, active: val } })}
          />
          <BusinessHourRow 
            dayLabel="Martes - Viernes (Tue - Fri)" 
            isActive={hours.tueFri.active} 
            fromTime={hours.tueFri.from} 
            toTime={hours.tueFri.to}
            onToggle={(val) => setHours({ ...hours, tueFri: { ...hours.tueFri, active: val } })}
          />
        </CardContainer>

        {/* SECCIÓN 4: SECTIONS */}
        <CardContainer 
          title="Service Sections" 
          icon="account-tree"
          rightHeaderElement={
            <TouchableOpacity style={styles.addSectionBtn}>
              <MaterialIcons name="add-circle" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          }
        >
          {sections.map(item => (
            <ServiceSectionCard 
              key={item.id} 
              section={item} 
              onDelete={(id) => setSections(sections.filter(s => s.id !== id))} 
            />
          ))}
        </CardContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  header: { height: 65, backgroundColor: COLORS.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.onPrimary, fontWeight: 'bold', fontSize: 16 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  titleContainer: { marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: '600', color: COLORS.onSurface, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.onSurfaceVariant },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, marginBottom: 6, marginTop: 14, textTransform: 'uppercase' },
  descriptionText: { fontSize: 13, color: COLORS.onSurfaceVariant, marginBottom: 10 },
  input: { height: 48, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 10 },
  colorPickerContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorPreview: { width: 48, height: 48, borderRadius: 8 },
  counterContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 12 },
  counterButton: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.outlineVariant },
  counterValueContainer: { alignItems: 'center' },
  counterNumber: { fontSize: 32, fontWeight: '700', color: COLORS.primary },
  counterLabel: { fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant },
  divider: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabel: { fontSize: 15, fontWeight: '500', color: COLORS.onSurface },
  addSectionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  tabContainer: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLow, padding: 4, borderRadius: 8, marginVertical: 4 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabButtonText: { fontSize: 13, fontWeight: '500', color: COLORS.onSurfaceVariant },
  tabButtonTextActive: { color: COLORS.primary, fontWeight: '700' },
  uploadDropzone: { borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.outlineVariant, borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceContainerLow, marginTop: 8 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface, marginTop: 8 },
  uploadSubtitle: { fontSize: 11, color: COLORS.onSurfaceVariant, opacity: 0.7, marginTop: 2 }
});