/**
 * Warteliste — Setup Screen (Administrador)
 * + Sección Multimedia: subir fotos/videos para el monitor
 * + Sección Clima: toggle + ciudad para mostrar en monitor
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Switch, StyleSheet, Alert, Modal, ActivityIndicator,
  Image, FlatList, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import {
  getServiceSections, createSection, updateSection, deleteSection,
  getSectionAssignments, assignEmployeeToSection, removeEmployeeFromSection,
  getEmployees, getSystemConfig, setSystemConfig,
} from '../../service/queueservice';
import type { ServiceSection, SectionAssignment } from '../../service/database';
import { useAuth } from '../../store/authcontext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Employee { id: number; full_name: string; email: string; station: string | null; }

export interface MediaItem {
  uri: string;
  type: 'image' | 'video';
  name: string;
}

const SECTION_COLORS = [
  '#00685f','#008378','#565e74','#ba1a1a',
  '#0055cc','#7c3aed','#d97706','#059669',
];

const WEATHER_CITIES: { label: string; value: string; lat: number; lon: number }[] = [
  { label: 'México, CDMX',            value: 'mexico_cdmx',       lat: 19.4326,  lon: -99.1332  },
  { label: 'España, Madrid',          value: 'spain_madrid',       lat: 40.4168,  lon: -3.7038   },
  { label: 'Argentina, Buenos Aires', value: 'argentina_ba',       lat: -34.6037, lon: -58.3816  },
  { label: 'Colombia, Bogotá',        value: 'colombia_bogota',    lat: 4.7110,   lon: -74.0721  },
  { label: 'Chile, Santiago',         value: 'chile_santiago',     lat: -33.4489, lon: -70.6693  },
  { label: 'Chile, Viña del Mar',     value: 'chile_vina',         lat: -33.0245, lon: -71.5518  },
  { label: 'Perú, Lima',              value: 'peru_lima',          lat: -12.0464, lon: -77.0428  },
  { label: 'USA, New York',           value: 'usa_ny',             lat: 40.7128,  lon: -74.0060  },
  { label: 'USA, Miami',              value: 'usa_miami',          lat: 25.7617,  lon: -80.1918  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const { user, logout } = useAuth();

  const [sections, setSections]       = useState<ServiceSection[]>([]);
  const [assignments, setAssignments] = useState<SectionAssignment[]>([]);
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [activeTab, setTab]           = useState<'sections' | 'staff' | 'config'>('sections');

  // Config general
  const [brandName, setBrandName]       = useState('Warteliste');
  const [brandColor, setBrandColor]     = useState('#00685F');
  const [activeDesks, setDesks]         = useState('12');
  const [autoAllocate, setAutoAllocate] = useState(true);

  // Horarios
  const [hoursMon, setHoursMon]         = useState({ active: true,  start: '08:00', end: '18:00' });
  const [hoursTueFri, setHoursTueFri]   = useState({ active: true,  start: '08:00', end: '18:00' });
  const [hoursWeekend, setHoursWeekend] = useState({ active: false, start: '10:00', end: '14:00' });

  // Ticket
  const [ticketShowLogo, setTicketShowLogo]               = useState(true);
  const [ticketShowWaitTime, setTicketShowWaitTime]       = useState(true);
  const [ticketShowSectionName, setTicketShowSectionName] = useState(false);
  const [ticketPrintQr, setTicketPrintQr]                 = useState(true);
  const [ticketMessage, setTicketMessage]                 = useState('Gracias por su visita');
  const [ticketFontSize, setTicketFontSize]               = useState('medium');

  // ── CLIMA ──────────────────────────────────────────────────────────────────
  const [showWeather, setShowWeather]     = useState(true);
  const [weatherCity, setWeatherCity]     = useState('chile_vina');
  const [showCityPicker, setShowCityPicker] = useState(false);

  // ── MULTIMEDIA ─────────────────────────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // Modal sección
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection]     = useState<ServiceSection | null>(null);
  const [sForm, setSForm] = useState<{ title: string; description: string; avgTime: string; prefix: string; color: string }>({
    title: '',
    description: '',
    avgTime: '10',
    prefix: 'D',
    color: COLORS.primary,
  });
  const [sError, setSError]   = useState('');
  const [saving, setSaving]   = useState(false);

  // Modal asignación
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSection, setAssignSection]     = useState<ServiceSection | null>(null);

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  const reload = useCallback(() => {
    setSections(getServiceSections());
    setAssignments(getSectionAssignments());
    setEmployees(getEmployees());

    setBrandName(getSystemConfig('brand_name') ?? 'Warteliste');
    setBrandColor(getSystemConfig('brand_color') ?? '#00685F');
    setDesks(getSystemConfig('active_desks') ?? '12');
    setAutoAllocate(getSystemConfig('auto_allocate') !== 'false');
    setTicketShowLogo(getSystemConfig('ticket_show_logo') !== 'false');
    setTicketShowWaitTime(getSystemConfig('ticket_show_wait_time') !== 'false');
    setTicketShowSectionName(getSystemConfig('ticket_show_section_name') === 'true');
    setTicketPrintQr(getSystemConfig('ticket_print_qr') !== 'false');
    setTicketMessage(getSystemConfig('ticket_message') ?? 'Gracias por su visita');
    setTicketFontSize(getSystemConfig('ticket_font_size') ?? 'medium');

    // Clima
    setShowWeather(getSystemConfig('show_weather') !== 'false');
    setWeatherCity(getSystemConfig('weather_city') ?? 'chile_vina');

    // Multimedia
    try {
      const saved = getSystemConfig('monitor_media');
      if (saved) setMediaItems(JSON.parse(saved));
    } catch { /* noop */ }

    try {
      const hMon = JSON.parse(getSystemConfig('hours_mon') || '{}');
      if (hMon.start) setHoursMon(hMon);
      const hTue = JSON.parse(getSystemConfig('hours_tue_fri') || '{}');
      if (hTue.start) setHoursTueFri(hTue);
      const hWeek = JSON.parse(getSystemConfig('hours_weekend') || '{}');
      if (hWeek.start) setHoursWeekend(hWeek);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ─── Multimedia ────────────────────────────────────────────────────────────

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos y videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],  // ← nuevo formato
      allowsMultipleSelection: true,
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newItems: MediaItem[] = result.assets.map(a => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        name: a.fileName ?? a.uri.split('/').pop() ?? 'media',
      }));
      const updated = [...mediaItems, ...newItems].slice(0, 20); // max 20 items
      setMediaItems(updated);
      setSystemConfig('monitor_media', JSON.stringify(updated));
    }
  };

  const handleRemoveMedia = (uri: string) => {
    Alert.alert('Eliminar', '¿Quitar este archivo del monitor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          const updated = mediaItems.filter(m => m.uri !== uri);
          setMediaItems(updated);
          setSystemConfig('monitor_media', JSON.stringify(updated));
        },
      },
    ]);
  };

  // ─── Secciones ─────────────────────────────────────────────────────────────

  const openCreateSection = () => {
    setEditingSection(null);
    setSForm({ title: '', description: '', avgTime: '10', prefix: 'D', color: COLORS.primary });
    setSError('');
    setShowSectionModal(true);
  };

  const openEditSection = (s: ServiceSection) => {
    setEditingSection(s);
    setSForm({ title: s.title, description: s.description ?? '', avgTime: String(s.avg_time_minutes), prefix: s.prefix, color: s.color });
    setSError('');
    setShowSectionModal(true);
  };

  const handleSaveSection = async () => {
    if (!sForm.title.trim())  { setSError('El nombre es obligatorio.'); return; }
    if (!sForm.prefix.trim()) { setSError('El prefijo es obligatorio.'); return; }
    const avg = parseInt(sForm.avgTime);
    if (isNaN(avg) || avg < 1) { setSError('Tiempo promedio inválido.'); return; }
    setSaving(true);
    try {
      if (editingSection) {
        updateSection(editingSection.id, sForm.title, sForm.description, avg, sForm.color);
      } else {
        createSection(sForm.title, sForm.description, avg, sForm.prefix, sForm.color);
      }
      setShowSectionModal(false);
      reload();
    } catch (e: any) {
      setSError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = (s: ServiceSection) => {
    Alert.alert('Eliminar Sección', `¿Eliminar "${s.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { deleteSection(s.id); reload(); } },
    ]);
  };

  // ─── Asignaciones ──────────────────────────────────────────────────────────

  const openAssign = (s: ServiceSection) => { setAssignSection(s); setShowAssignModal(true); };

  const getAssignedEmployeeIds = (sectionId: number) =>
    assignments.filter(a => a.section_id === sectionId).map(a => a.user_id);

  const toggleAssignment = (empId: number, sectionId: number) => {
    const assigned = getAssignedEmployeeIds(sectionId);
    if (assigned.includes(empId)) removeEmployeeFromSection(empId, sectionId);
    else assignEmployeeToSection(empId, sectionId);
    reload();
  };

  // ─── Config ────────────────────────────────────────────────────────────────

  const handleSaveConfig = () => {
    setSystemConfig('brand_name',    brandName.trim() || 'Warteliste');
    setSystemConfig('brand_color',   brandColor.trim() || '#00685F');
    setSystemConfig('active_desks',  String(parseInt(activeDesks) || 12));
    setSystemConfig('auto_allocate', String(autoAllocate));
    setSystemConfig('hours_mon',     JSON.stringify(hoursMon));
    setSystemConfig('hours_tue_fri', JSON.stringify(hoursTueFri));
    setSystemConfig('hours_weekend', JSON.stringify(hoursWeekend));
    setSystemConfig('ticket_show_logo',         String(ticketShowLogo));
    setSystemConfig('ticket_show_wait_time',    String(ticketShowWaitTime));
    setSystemConfig('ticket_show_section_name', String(ticketShowSectionName));
    setSystemConfig('ticket_print_qr',          String(ticketPrintQr));
    setSystemConfig('ticket_message',           ticketMessage);
    setSystemConfig('ticket_font_size',         ticketFontSize);
    // Clima
    setSystemConfig('show_weather', String(showWeather));
    setSystemConfig('weather_city', weatherCity);
    Alert.alert('✅ Guardado', 'Configuración actualizada correctamente.');
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const selectedCity = WEATHER_CITIES.find(c => c.value === weatherCity);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="grid-view" size={22} color={COLORS.primary} />
          <View>
            <Text style={styles.headerTitle}>Warteliste</Text>
            <Text style={styles.headerSub}>Admin · {user?.full_name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={22} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        {([
          { key: 'sections', label: 'Secciones', icon: 'account-tree' },
          { key: 'staff',    label: 'Personal',  icon: 'people' },
          { key: 'config',   label: 'Config',    icon: 'settings' },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <MaterialIcons name={t.icon} size={18} color={activeTab === t.key ? COLORS.primary : COLORS.onSurfaceVariant} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── TAB: SECCIONES ──────────────────────────────────────────────── */}
        {activeTab === 'sections' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Secciones de Servicio</Text>
              <TouchableOpacity style={styles.addBtn} onPress={openCreateSection}>
                <MaterialIcons name="add" size={18} color={COLORS.onPrimary} />
                <Text style={styles.addBtnText}>Nueva</Text>
              </TouchableOpacity>
            </View>

            {sections.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No hay secciones aún.</Text>
              </View>
            )}

            {sections.map(s => {
              const assignedIds   = getAssignedEmployeeIds(s.id);
              const assignedNames = assignments.filter(a => a.section_id === s.id).map(a => a.user_name ?? '');
              return (
                <View key={s.id} style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <View style={[styles.prefixBadge, { backgroundColor: s.color + '22' }]}>
                      <Text style={[styles.prefixText, { color: s.color }]}>{s.prefix}</Text>
                    </View>
                    <View style={styles.sectionCardInfo}>
                      <Text style={styles.sectionCardTitle}>{s.title}</Text>
                      <Text style={styles.sectionCardDesc}>{s.description}</Text>
                    </View>
                    <View style={styles.sectionCardActions}>
                      <TouchableOpacity onPress={() => openEditSection(s)} style={styles.iconBtn}>
                        <MaterialIcons name="edit" size={18} color={COLORS.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteSection(s)} style={styles.iconBtn}>
                        <MaterialIcons name="delete" size={18} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.sectionCardFooter}>
                    <View style={styles.metaBadge}>
                      <MaterialIcons name="schedule" size={14} color={COLORS.outline} />
                      <Text style={styles.metaText}>{s.avg_time_minutes} min prom.</Text>
                    </View>
                    <TouchableOpacity style={styles.assignBtn} onPress={() => openAssign(s)}>
                      <MaterialIcons name="person-add" size={14} color={COLORS.primary} />
                      <Text style={styles.assignBtnText}>
                        {assignedIds.length > 0 ? `${assignedIds.length} asignado${assignedIds.length > 1 ? 's' : ''}` : 'Asignar personal'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {assignedNames.length > 0 && (
                    <View style={styles.avatarRow}>
                      {assignedNames.map((name, i) => (
                        <View key={i} style={[styles.avatar, { backgroundColor: s.color + '33', borderColor: s.color + '66' }]}>
                          <Text style={[styles.avatarText, { color: s.color }]}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── TAB: PERSONAL ───────────────────────────────────────────────── */}
        {activeTab === 'staff' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal y Asignaciones</Text>
            <Text style={styles.sectionSubtitle}>Empleados activos y sus secciones asignadas</Text>
            {employees.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No hay empleados registrados.</Text>
              </View>
            )}
            {employees.map(emp => {
              const myAssignments = assignments.filter(a => a.user_id === emp.id);
              return (
                <View key={emp.id} style={styles.empCard}>
                  <View style={styles.empAvatar}>
                    <Text style={styles.empAvatarText}>{emp.full_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.empInfo}>
                    <Text style={styles.empName}>{emp.full_name}</Text>
                    <Text style={styles.empEmail}>{emp.email}</Text>
                    {emp.station && <Text style={styles.empStation}>📍 {emp.station}</Text>}
                    {myAssignments.length > 0 ? (
                      <View style={styles.chipRow}>
                        {myAssignments.map(a => {
                          const sec = sections.find(s => s.id === a.section_id);
                          return (
                            <View key={a.id} style={[styles.chip, { backgroundColor: (sec?.color ?? COLORS.primary) + '22' }]}>
                              <Text style={[styles.chipText, { color: sec?.color ?? COLORS.primary }]}>{a.section_title}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.noSection}>Sin secciones asignadas</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── TAB: CONFIG ─────────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuración del Sistema</Text>
            <Text style={styles.sectionSubtitle}>Gestiona tu sucursal, escritorios y la apariencia visual.</Text>

            {/* 1. Identidad de Marca */}
            <View style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <MaterialIcons name="palette" size={20} color={COLORS.primary} />
                <Text style={styles.configCardTitle}>Identidad de Marca</Text>
              </View>
              <Text style={styles.configLabel}>Nombre de la Marca</Text>
              <TextInput style={styles.configInput} value={brandName} onChangeText={setBrandName} placeholder="Warteliste" />
              <Text style={styles.configLabel}>Color Principal</Text>
              <View style={styles.colorInputRow}>
                <View style={[styles.colorPreview, { backgroundColor: brandColor }]} />
                <TextInput style={[styles.configInput, { flex: 1 }]} value={brandColor} onChangeText={setBrandColor} placeholder="#00685F" />
              </View>
            </View>

            {/* 2. Capacidad */}
            <View style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <MaterialIcons name="countertops" size={20} color={COLORS.primary} />
                <Text style={styles.configCardTitle}>Capacidad Activa</Text>
              </View>
              <Text style={styles.configSubText}>Número de escritorios o ventanillas operativas.</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity style={styles.counterBtn} onPress={() => setDesks(String(Math.max(1, parseInt(activeDesks) - 1)))}>
                  <MaterialIcons name="remove" size={22} color={COLORS.onSurface} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.counterText}>{activeDesks}</Text>
                  <Text style={styles.counterLabel}>ESCRITORIOS</Text>
                </View>
                <TouchableOpacity style={[styles.counterBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]} onPress={() => setDesks(String(parseInt(activeDesks) + 1))}>
                  <MaterialIcons name="add" size={22} color={COLORS.onPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Asignación automática</Text>
                  <Text style={styles.switchSub}>Asigna tickets dinámicamente al siguiente empleado disponible.</Text>
                </View>
                <Switch value={autoAllocate} onValueChange={setAutoAllocate} trackColor={{ true: COLORS.primary }} />
              </View>
            </View>

            {/* 3. Horarios */}
            <View style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
                <Text style={styles.configCardTitle}>Horarios de Atención</Text>
              </View>
              {[
                { label: 'Lunes',            state: hoursMon,     setState: setHoursMon },
                { label: 'Martes - Viernes', state: hoursTueFri,  setState: setHoursTueFri },
                { label: 'Sábado - Domingo', state: hoursWeekend, setState: setHoursWeekend },
              ].map(({ label, state, setState }) => (
                <View key={label} style={styles.hoursBlock}>
                  <View style={styles.hoursTop}>
                    <Text style={styles.hoursTitle}>{label}</Text>
                    <Switch value={state.active} onValueChange={v => setState((s: any) => ({ ...s, active: v }))} trackColor={{ true: COLORS.primary }} />
                  </View>
                  <View style={[styles.hoursInputs, !state.active && styles.hoursDisabled]}>
                    <TextInput style={styles.timeInput} value={state.start} onChangeText={t => setState((s: any) => ({ ...s, start: t }))} editable={state.active} />
                    <Text style={styles.timeTo}>a</Text>
                    <TextInput style={styles.timeInput} value={state.end}   onChangeText={t => setState((s: any) => ({ ...s, end: t }))}   editable={state.active} />
                  </View>
                </View>
              ))}
            </View>

            {/* 4. Ticket */}
            <View style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <MaterialIcons name="confirmation-number" size={20} color={COLORS.primary} />
                <Text style={styles.configCardTitle}>Configuración de Ticket</Text>
              </View>
              {[
                { label: 'Mostrar Logo de Marca',              val: ticketShowLogo,        set: setTicketShowLogo },
                { label: 'Mostrar Tiempo Estimado de Espera',  val: ticketShowWaitTime,    set: setTicketShowWaitTime },
                { label: 'Mostrar Nombre de Sección',          val: ticketShowSectionName, set: setTicketShowSectionName },
                { label: 'Imprimir Código QR',                 val: ticketPrintQr,         set: setTicketPrintQr },
              ].map(({ label, val, set }) => (
                <View key={label} style={styles.switchRowSimple}>
                  <Text style={styles.switchLabelSimple}>{label}</Text>
                  <Switch value={val} onValueChange={set} trackColor={{ true: COLORS.primary }} />
                </View>
              ))}
              <Text style={[styles.configLabel, { marginTop: 16 }]}>Mensaje Personalizado (Footer)</Text>
              <TextInput style={[styles.configInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} multiline value={ticketMessage} onChangeText={setTicketMessage} />
              <Text style={[styles.configLabel, { marginTop: 12 }]}>Tamaño de Fuente</Text>
              <View style={styles.segmentRow}>
                {['small', 'medium', 'large'].map(sz => (
                  <TouchableOpacity key={sz} onPress={() => setTicketFontSize(sz)} style={[styles.segmentBtn, ticketFontSize === sz && styles.segmentBtnActive]}>
                    <Text style={[styles.segmentText, ticketFontSize === sz && styles.segmentTextActive]}>
                      {sz === 'small' ? 'Pequeño' : sz === 'medium' ? 'Mediano' : 'Grande'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── 5. CLIMA ─────────────────────────────────────────────────── */}
            <View style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <MaterialIcons name="wb-cloudy" size={20} color={COLORS.primary} />
                <Text style={styles.configCardTitle}>Configuración del Clima</Text>
              </View>
              <Text style={styles.configSubText}>Muestra el clima local en el monitor de sala de espera.</Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Mostrar Clima en Monitor</Text>
                  <Text style={styles.switchSub}>Aparece en la esquina superior del monitor.</Text>
                </View>
                <Switch value={showWeather} onValueChange={setShowWeather} trackColor={{ true: COLORS.primary }} />
              </View>

              {showWeather && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.configLabel}>Ciudad / País</Text>
                  <TouchableOpacity style={styles.citySelector} onPress={() => setShowCityPicker(true)}>
                    <MaterialIcons name="location-on" size={18} color={COLORS.primary} />
                    <Text style={styles.citySelectorText}>
                      {selectedCity?.label ?? 'Selecciona una ciudad...'}
                    </Text>
                    <MaterialIcons name="expand-more" size={20} color={COLORS.onSurfaceVariant} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* ── 6. MULTIMEDIA ────────────────────────────────────────────── */}
            <View style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <MaterialIcons name="movie" size={20} color={COLORS.primary} />
                <Text style={styles.configCardTitle}>Contenido Multimedia del Monitor</Text>
              </View>
              <Text style={styles.configSubText}>
                Sube fotos o videos para entretener a los clientes en la sala de espera.
                Se mostrarán en carrusel automático. Máximo 20 archivos.
              </Text>

              {/* Drop zone / botón subir */}
              <TouchableOpacity style={styles.uploadZone} onPress={handlePickMedia}>
                <View style={styles.uploadIcons}>
                  <MaterialIcons name="image"    size={36} color={COLORS.outline} />
                  <MaterialIcons name="movie"    size={36} color={COLORS.outline} />
                </View>
                <Text style={styles.uploadTitle}>Subir Fotos o Videos</Text>
                <Text style={styles.uploadSub}>MP4, MOV, JPG, PNG · Máx 50 MB · Máx 20 archivos</Text>
                <View style={styles.uploadBtn}>
                  <MaterialIcons name="add" size={16} color={COLORS.onPrimary} />
                  <Text style={styles.uploadBtnText}>Seleccionar archivos</Text>
                </View>
              </TouchableOpacity>

              {/* Grid de archivos subidos */}
              {mediaItems.length > 0 && (
                <View style={styles.mediaGrid}>
                  <Text style={styles.mediaCount}>{mediaItems.length} archivo{mediaItems.length > 1 ? 's' : ''} cargado{mediaItems.length > 1 ? 's' : ''}</Text>
                  <View style={styles.mediaRow}>
                    {mediaItems.map(item => (
                      <View key={item.uri} style={styles.mediaThumbnail}>
                        {item.type === 'image' ? (
                          <Image source={{ uri: item.uri }} style={styles.mediaThumbImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.mediaThumbVideo}>
                            <MaterialIcons name="play-circle-filled" size={28} color={COLORS.onPrimary} />
                          </View>
                        )}
                        <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => handleRemoveMedia(item.uri)}>
                          <MaterialIcons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.mediaTypeBadge}>
                          <MaterialIcons name={item.type === 'video' ? 'videocam' : 'image'} size={10} color="#fff" />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { marginTop: 8 }]} onPress={handleSaveConfig}>
              <MaterialIcons name="save" size={18} color={COLORS.onPrimary} />
              <Text style={styles.saveBtnText}>Guardar Configuración</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* MODAL: Crear / Editar Sección */}
      <Modal visible={showSectionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingSection ? 'Editar Sección' : 'Nueva Sección'}</Text>
            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput style={styles.modalInput} value={sForm.title} onChangeText={t => setSForm(f => ({ ...f, title: t }))} placeholder="Ej. Sales, Support..." placeholderTextColor={COLORS.outline} />
            <Text style={styles.fieldLabel}>Descripción</Text>
            <TextInput style={[styles.modalInput, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]} multiline value={sForm.description} onChangeText={t => setSForm(f => ({ ...f, description: t }))} placeholder="Breve descripción" placeholderTextColor={COLORS.outline} />
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Prefijo *</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign: 'center', fontWeight: '700', fontSize: 20 }]}
                  value={sForm.prefix}
                  onChangeText={t => setSForm(f => ({ ...f, prefix: t.toUpperCase().slice(0, 1) }))}
                  maxLength={1} editable={!editingSection} placeholder="A" placeholderTextColor={COLORS.outline}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldLabel}>Tiempo promedio (min)</Text>
                <TextInput style={styles.modalInput} value={sForm.avgTime} onChangeText={t => setSForm(f => ({ ...f, avgTime: t }))} keyboardType="numeric" placeholder="10" placeholderTextColor={COLORS.outline} />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorPicker}>
              {SECTION_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setSForm(f => ({ ...f, color: c }))} style={[styles.colorDot, { backgroundColor: c }, sForm.color === c && styles.colorDotSelected]} />
              ))}
            </View>
            {!!sError && <Text style={styles.errorText}>{sError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSectionModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleSaveSection} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.onPrimary} size="small" /> : <Text style={styles.saveBtnText}>{editingSection ? 'Guardar' : 'Crear'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Asignar empleados */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Asignar personal a {assignSection?.title}</Text>
            <Text style={styles.modalSub}>Selecciona los empleados que atenderán esta sección</Text>
            {employees.map(emp => {
              const assigned = assignSection ? getAssignedEmployeeIds(assignSection.id).includes(emp.id) : false;
              return (
                <TouchableOpacity key={emp.id} style={[styles.empPickRow, assigned && styles.empPickRowActive]} onPress={() => assignSection && toggleAssignment(emp.id, assignSection.id)}>
                  <View style={[styles.empPickAvatar, { backgroundColor: assigned ? COLORS.primary : COLORS.surfaceContainerLow }]}>
                    <Text style={[styles.empPickAvatarText, { color: assigned ? COLORS.onPrimary : COLORS.onSurfaceVariant }]}>{emp.full_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empPickName}>{emp.full_name}</Text>
                    <Text style={styles.empPickSub}>{emp.station ?? emp.email}</Text>
                  </View>
                  <MaterialIcons name={assigned ? 'check-circle' : 'radio-button-unchecked'} size={22} color={assigned ? COLORS.primary : COLORS.outline} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 8 }]} onPress={() => setShowAssignModal(false)}>
              <Text style={styles.saveBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Selector de ciudad */}
      <Modal visible={showCityPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>Seleccionar Ciudad</Text>
            <ScrollView>
              {WEATHER_CITIES.map(city => (
                <TouchableOpacity
                  key={city.value}
                  style={[styles.cityPickRow, weatherCity === city.value && styles.cityPickRowActive]}
                  onPress={() => { setWeatherCity(city.value); setShowCityPicker(false); }}
                >
                  <MaterialIcons name="location-on" size={18} color={weatherCity === city.value ? COLORS.primary : COLORS.outline} />
                  <Text style={[styles.cityPickText, weatherCity === city.value && { color: COLORS.primary, fontWeight: '700' }]}>
                    {city.label}
                  </Text>
                  {weatherCity === city.value && <MaterialIcons name="check" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCityPicker(false)}>
              <Text style={styles.cancelBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  headerSub: { fontSize: 12, color: COLORS.onSurfaceVariant },
  logoutBtn: { padding: 8 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.onSurfaceVariant },
  tabTextActive: { color: COLORS.primary },
  scroll: { padding: 16, gap: 12, paddingBottom: 60 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onBackground },
  sectionSubtitle: { fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: -8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 15, color: COLORS.onSurfaceVariant, textAlign: 'center' },
  sectionCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: COLORS.outlineVariant },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefixBadge: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefixText: { fontSize: 20, fontWeight: '800' },
  sectionCardInfo: { flex: 1 },
  sectionCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.onBackground },
  sectionCardDesc: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2 },
  sectionCardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  sectionCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.outline },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant },
  assignBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  avatarRow: { flexDirection: 'row', gap: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 13, fontWeight: '700' },
  empCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.outlineVariant },
  empAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  empAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.onPrimaryContainer },
  empInfo: { flex: 1, gap: 3 },
  empName: { fontSize: 15, fontWeight: '700', color: COLORS.onBackground },
  empEmail: { fontSize: 12, color: COLORS.onSurfaceVariant },
  empStation: { fontSize: 12, color: COLORS.outline },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },
  noSection: { fontSize: 12, color: COLORS.outline, fontStyle: 'italic' },
  configCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: COLORS.outlineVariant, marginTop: 4 },
  configHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  configCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.onBackground },
  configSubText: { fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: -6, marginBottom: 4 },
  configLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  configInput: { height: 48, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLow },
  colorInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorPreview: { width: 48, height: 48, borderRadius: 10, borderWidth: 2, borderColor: COLORS.surfaceContainerLowest },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.outlineVariant },
  counterBtn: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  counterText: { fontSize: 32, fontWeight: '700', color: COLORS.primary },
  counterLabel: { fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: COLORS.onBackground },
  switchSub: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2 },
  hoursBlock: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 8 },
  hoursTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hoursTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onBackground },
  hoursInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hoursDisabled: { opacity: 0.4 },
  timeInput: { flex: 1, height: 40, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 8, textAlign: 'center', fontSize: 14 },
  timeTo: { fontSize: 14, color: COLORS.onSurfaceVariant },
  switchRowSimple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  switchLabelSimple: { fontSize: 14, color: COLORS.onBackground },
  segmentRow: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: COLORS.outlineVariant },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: COLORS.surfaceContainerLowest },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.onSurfaceVariant },
  segmentTextActive: { color: COLORS.primary },
  // Clima
  citySelector: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, backgroundColor: COLORS.surfaceContainerLow },
  citySelectorText: { flex: 1, fontSize: 15, color: COLORS.onSurface },
  cityPickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4 },
  cityPickRowActive: { backgroundColor: COLORS.surfaceContainerLow },
  cityPickText: { flex: 1, fontSize: 15, color: COLORS.onBackground },
  // Multimedia
  uploadZone: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.outlineVariant, borderRadius: 16, padding: 28, alignItems: 'center', gap: 8, backgroundColor: COLORS.surfaceContainerLow },
  uploadIcons: { flexDirection: 'row', gap: 12 },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: COLORS.onSurfaceVariant },
  uploadSub: { fontSize: 12, color: COLORS.outline, textAlign: 'center' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.onPrimary },
  mediaGrid: { gap: 8 },
  mediaCount: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumbnail: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  mediaThumbImage: { width: '100%', height: '100%' },
  mediaThumbVideo: { width: '100%', height: '100%', backgroundColor: COLORS.inverseSurface, alignItems: 'center', justifyContent: 'center' },
  mediaRemoveBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 2 },
  mediaTypeBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 2 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.onPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surfaceContainerLowest, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onBackground },
  modalSub: { fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: -6 },
  modalInput: { height: 48, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLow },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowInputs: { flexDirection: 'row', gap: 10 },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: COLORS.onBackground, transform: [{ scale: 1.15 }] },
  errorText: { fontSize: 13, color: COLORS.error },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.surfaceContainerHigh, borderWidth: 1, borderColor: COLORS.outlineVariant },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.onSurfaceVariant },
  empPickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  empPickRowActive: { backgroundColor: COLORS.surfaceContainerLow },
  empPickAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empPickAvatarText: { fontSize: 18, fontWeight: '700' },
  empPickName: { fontSize: 14, fontWeight: '600', color: COLORS.onBackground },
  empPickSub: { fontSize: 12, color: COLORS.onSurfaceVariant },
});