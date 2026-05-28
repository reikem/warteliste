/**
 * QueueMaster Pro — Kiosco (Usuario kiosk)
 * 1. Selecciona sección de servicio
 * 2. Ingresa nombre y contacto
 * 3. Genera ticket real en SQLite
 * 4. Navega a printPreview con los datos del ticket
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, User, Mail, CheckCircle2, ChevronRight, LogOut } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../service/authContext';
import { COLORS } from '../constants/colors';
import { getServiceSections, createTicket } from '../../service/queueservice';
import type { ServiceSection } from '../../service/database';

// Guardar el último ticket creado para que printPreview lo lea
export let lastCreatedTicket: {
  ticketNumber: string;
  customerName: string;
  sectionTitle: string;
  estimatedWait: string;
  timestamp: string;
} | null = null;

export default function KioskScreen() {
  const { logout } = useAuth();

  const [step, setStep]               = useState<'section' | 'form'>('section');
  const [sections, setSections]       = useState<ServiceSection[]>([]);
  const [selectedSection, setSection] = useState<ServiceSection | null>(null);
  const [fullName, setFullName]       = useState('');
  const [contact, setContact]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [nameError, setNameError]     = useState('');

  useEffect(() => {
    setSections(getServiceSections());
  }, []);

  const handleSelectSection = (section: ServiceSection) => {
    setSection(section);
    setStep('form');
  };

  const handleRegister = async () => {
    if (!fullName.trim()) { setNameError('El nombre es obligatorio.'); return; }
    if (!selectedSection) return;
    setLoading(true);
    try {
      const ticket = createTicket(fullName.trim(), selectedSection.id, contact.trim() || undefined);
      if (!ticket) throw new Error('No se pudo crear el ticket.');

      const now = new Date();
      const timestamp = `${now.toLocaleDateString('es-MX')} - ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

      lastCreatedTicket = {
        ticketNumber: ticket.ticket_number,
        customerName: fullName.trim(),
        sectionTitle: selectedSection.title,
        estimatedWait: `${selectedSection.avg_time_minutes} min`,
        timestamp,
      };

      // Navegar a la previsualización del ticket
      router.push('/printPreview');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo generar el ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('section');
      setFullName('');
      setContact('');
      setNameError('');
    }
  };

  const handleLogout = () => {
    Alert.alert('Salir', '¿Cerrar esta sesión de kiosco?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ticket size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>QueueMaster Pro</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={20} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* PASO 1: Seleccionar sección */}
        {step === 'section' && (
          <View style={styles.inner}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>¿Qué servicio necesitas?</Text>
              <Text style={styles.stepSub}>Selecciona la sección que corresponde a tu trámite</Text>
            </View>

            {sections.length === 0 ? (
              <View style={styles.noSections}>
                <Text style={styles.noSectionsText}>No hay secciones disponibles.\nContacta al administrador.</Text>
              </View>
            ) : (
              sections.map(section => (
                <TouchableOpacity
                  key={section.id}
                  style={styles.sectionCard}
                  onPress={() => handleSelectSection(section)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                  <View style={styles.sectionInfo}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionDesc}>{section.description}</Text>
                    <Text style={styles.sectionTime}>⏱ Tiempo estimado: {section.avg_time_minutes} min</Text>
                  </View>
                  <View style={[styles.prefixBadge, { backgroundColor: section.color + '22' }]}>
                    <Text style={[styles.prefixText, { color: section.color }]}>{section.prefix}</Text>
                  </View>
                  <ChevronRight size={20} color={COLORS.outline} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* PASO 2: Formulario */}
        {step === 'form' && selectedSection && (
          <View style={styles.inner}>
            <View style={styles.stepHeader}>
              <View style={[styles.selectedBadge, { backgroundColor: selectedSection.color + '22', borderColor: selectedSection.color + '44' }]}>
                <View style={[styles.sectionDot, { backgroundColor: selectedSection.color, width: 10, height: 10 }]} />
                <Text style={[styles.selectedBadgeText, { color: selectedSection.color }]}>{selectedSection.title}</Text>
              </View>
              <Text style={styles.stepTitle}>Ingresa tus datos</Text>
              <Text style={styles.stepSub}>Te notificaremos cuando sea tu turno</Text>
            </View>

            <View style={styles.formCard}>
              {/* Nombre */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nombre Completo *</Text>
                <View style={[styles.inputRow, !!nameError && styles.inputError]}>
                  <User size={20} color={COLORS.onSurfaceVariant} />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={t => { setFullName(t); setNameError(''); }}
                    placeholder="Ej. Juan Pérez"
                    placeholderTextColor={COLORS.outline}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                {!!nameError && <Text style={styles.fieldError}>{nameError}</Text>}
              </View>

              {/* Contacto (opcional) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Teléfono o Correo (opcional)</Text>
                <View style={styles.inputRow}>
                  <Mail size={20} color={COLORS.onSurfaceVariant} />
                  <TextInput
                    style={styles.input}
                    value={contact}
                    onChangeText={setContact}
                    placeholder="Para notificarte cuando sea tu turno"
                    placeholderTextColor={COLORS.outline}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                </View>
              </View>

              {/* Info */}
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  📋 Se generará un ticket para <Text style={{ fontWeight: '700' }}>{selectedSection.title}</Text>.
                  Tiempo estimado de espera: <Text style={{ fontWeight: '700' }}>{selectedSection.avg_time_minutes} min</Text>.
                </Text>
              </View>
            </View>

            {/* Botones */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.85}>
                <Text style={styles.backBtnText}>← Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.onPrimary} />
                  : <>
                      <CheckCircle2 size={20} color={COLORS.onPrimary} />
                      <Text style={styles.confirmBtnText}>Generar Ticket</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  logoutBtn: { padding: 8 },
  scroll: { flexGrow: 1, padding: 20 },
  inner: { gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  stepHeader: { gap: 6, marginBottom: 4 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: COLORS.onBackground },
  stepSub: { fontSize: 14, color: COLORS.onSurfaceVariant, lineHeight: 20 },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  selectedBadgeText: { fontSize: 13, fontWeight: '700' },
  noSections: { padding: 40, alignItems: 'center' },
  noSectionsText: { textAlign: 'center', fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 22 },
  sectionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  sectionDot: { width: 14, height: 14, borderRadius: 7 },
  sectionInfo: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onBackground },
  sectionDesc: { fontSize: 13, color: COLORS.onSurfaceVariant },
  sectionTime: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  prefixBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefixText: { fontSize: 18, fontWeight: '700' },
  formCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 14, padding: 20, gap: 16,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 52, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: COLORS.outlineVariant,
    borderRadius: 10, backgroundColor: COLORS.surfaceContainerLow,
  },
  inputError: { borderColor: COLORS.error },
  input: { flex: 1, fontSize: 15, color: COLORS.onSurface },
  fieldError: { fontSize: 12, color: COLORS.error },
  infoBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  infoText: { fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1, height: 54, borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.onSurfaceVariant },
  confirmBtn: {
    flex: 2, height: 54, borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },
});