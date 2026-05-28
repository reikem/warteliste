/**
 * QueueMaster Pro — Setup Screen (Administrador)
 * - Gestión de secciones de servicio (crear, editar, eliminar)
 * - Asignación de empleados a secciones
 * - Configuración del sistema
 * - Ver todos los usuarios
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Switch, StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../service/authContext';
import { COLORS } from '../constants/colors';
import {
  getServiceSections, createSection, updateSection, deleteSection,
  getSectionAssignments, assignEmployeeToSection, removeEmployeeFromSection,
  getEmployees, getSystemConfig, setSystemConfig,
} from '../../service/queueservice';
import type { ServiceSection, SectionAssignment } from '../../service/database';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Employee { id: number; full_name: string; email: string; station: string | null; }

const SECTION_COLORS = [
  '#00685f','#008378','#565e74','#ba1a1a',
  '#0055cc','#7c3aed','#d97706','#059669',
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const { user, logout } = useAuth();

  const [sections, setSections]       = useState<ServiceSection[]>([]);
  const [assignments, setAssignments] = useState<SectionAssignment[]>([]);
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [brandName, setBrandName]     = useState('QueueMaster Pro');
  const [activeDesks, setDesks]       = useState('12');
  const [activeTab, setTab]           = useState<'sections' | 'staff' | 'config'>('sections');

  // Modal de sección
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection]     = useState<ServiceSection | null>(null);
  const [sForm, setSForm] = useState<{ title: string; description: string; avgTime: string; prefix: string; color: string }>({
    title: '',
    description: '',
    avgTime: '10',
    prefix: 'D',
    color: COLORS.primary,
  });
  const [sError, setSError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal asignación
  const [showAssignModal, setShowAssignModal]   = useState(false);
  const [assignSection, setAssignSection]       = useState<ServiceSection | null>(null);

  const reload = useCallback(() => {
    setSections(getServiceSections());
    setAssignments(getSectionAssignments());
    setEmployees(getEmployees());
    setBrandName(getSystemConfig('brand_name') ?? 'QueueMaster Pro');
    setDesks(getSystemConfig('active_desks') ?? '12');
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ─── Secciones ──────────────────────────────────────────────────────────

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
    if (!sForm.title.trim()) { setSError('El nombre es obligatorio.'); return; }
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
    Alert.alert('Eliminar Sección', `¿Eliminar "${s.title}"? Los tickets existentes no se afectan.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { deleteSection(s.id); reload(); } },
    ]);
  };

  // ─── Asignaciones ────────────────────────────────────────────────────────

  const openAssign = (s: ServiceSection) => {
    setAssignSection(s);
    setShowAssignModal(true);
  };

  const getAssignedEmployeeIds = (sectionId: number) =>
    assignments.filter(a => a.section_id === sectionId).map(a => a.user_id);

  const toggleAssignment = (empId: number, sectionId: number) => {
    const assigned = getAssignedEmployeeIds(sectionId);
    if (assigned.includes(empId)) {
      removeEmployeeFromSection(empId, sectionId);
    } else {
      assignEmployeeToSection(empId, sectionId);
    }
    reload();
  };

  // ─── Config ──────────────────────────────────────────────────────────────

  const handleSaveConfig = () => {
    setSystemConfig('brand_name', brandName.trim() || 'QueueMaster Pro');
    setSystemConfig('active_desks', String(parseInt(activeDesks) || 12));
    Alert.alert('✅ Guardado', 'Configuración actualizada correctamente.');
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="grid-view" size={22} color={COLORS.primary} />
          <View>
            <Text style={styles.headerTitle}>QueueMaster Pro</Text>
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

        {/* ── TAB: SECCIONES ─────────────────────────────────────────────── */}
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
                <Text style={styles.emptyText}>No hay secciones aún. Crea la primera.</Text>
              </View>
            )}

            {sections.map(s => {
              const assignedIds = getAssignedEmployeeIds(s.id);
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

        {/* ── TAB: PERSONAL ──────────────────────────────────────────────── */}
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

        {/* ── TAB: CONFIG ────────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuración del Sistema</Text>

            <View style={styles.configCard}>
              <Text style={styles.configLabel}>Nombre de la Marca</Text>
              <TextInput
                style={styles.configInput}
                value={brandName}
                onChangeText={setBrandName}
                placeholder="QueueMaster Pro"
                placeholderTextColor={COLORS.outline}
              />

              <Text style={styles.configLabel}>Escritorios Activos</Text>
              <TextInput
                style={styles.configInput}
                value={activeDesks}
                onChangeText={setDesks}
                keyboardType="numeric"
                placeholder="12"
                placeholderTextColor={COLORS.outline}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveConfig}>
                <MaterialIcons name="save" size={18} color={COLORS.onPrimary} />
                <Text style={styles.saveBtnText}>Guardar Configuración</Text>
              </TouchableOpacity>
            </View>

            {/* Guía de credenciales demo */}
            <View style={styles.credCard}>
              <Text style={styles.credTitle}>👤 Usuarios del Sistema</Text>
              {[
                { role: 'Admin',    email: 'admin@queuemaster.com',     color: COLORS.primary },
                { role: 'Empleado', email: 'marcus@queuemaster.com',    color: COLORS.secondary },
                { role: 'Empleado', email: 'employee2@queuemaster.com', color: COLORS.secondary },
                { role: 'Monitor',  email: 'monitor@queuemaster.com',   color: '#565e74' },
                { role: 'Kiosco',   email: 'kiosk@queuemaster.com',     color: '#008378' },
              ].map(u => (
                <View key={u.email} style={styles.credRow}>
                  <View style={[styles.roleBadge, { backgroundColor: u.color + '22' }]}>
                    <Text style={[styles.roleText, { color: u.color }]}>{u.role}</Text>
                  </View>
                  <Text style={styles.credEmail}>{u.email}</Text>
                </View>
              ))}
              <Text style={styles.credNote}>Contraseña de todos: admin123</Text>
            </View>
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
            <TextInput style={[styles.modalInput, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]} multiline value={sForm.description} onChangeText={t => setSForm(f => ({ ...f, description: t }))} placeholder="Breve descripción del servicio" placeholderTextColor={COLORS.outline} />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Prefijo *</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign: 'center', fontWeight: '700', fontSize: 20 }]}
                  value={sForm.prefix}
                  onChangeText={t => setSForm(f => ({ ...f, prefix: t.toUpperCase().slice(0, 1) }))}
                  maxLength={1}
                  editable={!editingSection}
                  placeholder="A"
                  placeholderTextColor={COLORS.outline}
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
                <TouchableOpacity
                  key={emp.id}
                  style={[styles.empPickRow, assigned && styles.empPickRowActive]}
                  onPress={() => assignSection && toggleAssignment(emp.id, assignSection.id)}
                >
                  <View style={[styles.empPickAvatar, { backgroundColor: assigned ? COLORS.primary : COLORS.surfaceContainerLow }]}>
                    <Text style={[styles.empPickAvatarText, { color: assigned ? COLORS.onPrimary : COLORS.onSurfaceVariant }]}>
                      {emp.full_name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empPickName}>{emp.full_name}</Text>
                    <Text style={styles.empPickSub}>{emp.station ?? emp.email}</Text>
                  </View>
                  <MaterialIcons
                    name={assigned ? 'check-circle' : 'radio-button-unchecked'}
                    size={22}
                    color={assigned ? COLORS.primary : COLORS.outline}
                  />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={[styles.saveBtn, { marginTop: 8 }]} onPress={() => setShowAssignModal(false)}>
              <Text style={styles.saveBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
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

  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12, padding: 14, gap: 10,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
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

  configCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: COLORS.outlineVariant },
  configLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  configInput: { height: 48, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLow },

  credCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: COLORS.outlineVariant },
  credTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onBackground, marginBottom: 4 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 11, fontWeight: '700' },
  credEmail: { flex: 1, fontSize: 12, color: COLORS.onSurfaceVariant },
  credNote: { fontSize: 12, color: COLORS.outline, fontStyle: 'italic', marginTop: 4 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.onPrimary },

  // Modal
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