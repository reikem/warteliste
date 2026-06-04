/**
 * Warteliste — Login Screen
 * NUEVAS FUNCIONALIDADES:
 *   + Crear nueva empresa (registro de empresa + admin)
 *   + Acceso por slug de empresa (empresa.warteliste.app)
 *   + Crear asistentes dentro de la empresa
 *   + Onboarding check: si no completó tutorial, redirige a /onboarding
 *   + Secciones NO se crean por defecto al registrar empresa
 *
 * Ubicación: app/login.tsx
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye, EyeOff, LogIn, Grid, ShieldCheck,
  Building2, UserPlus, ChevronRight,
} from 'lucide-react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/colors';
import { useAuth } from '../../store/authcontext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ONBOARDING_KEY = 'warteliste_onboarding_done';

const DEMO_USERS = [
  { role: 'Admin',    email: 'admin@warteliste.com',   color: COLORS.primary,   label: 'ADM' },
  { role: 'Empleado', email: 'marcus@warteliste.com',  color: COLORS.secondary, label: 'EMP' },
  { role: 'Monitor',  email: 'monitor@warteliste.com', color: '#565e74',        label: 'MON' },
  { role: 'Kiosco',   email: 'kiosk@warteliste.com',   color: '#78350f',        label: 'KSK' },
];

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { login, register } = useAuth();

  // ── Tab: login | register-company | add-user ──────────────────────────────
  const [tab, setTab] = useState<'login' | 'register' | 'adduser'>('login');

  // ── Login ─────────────────────────────────────────────────────────────────
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [emailErr, setEmailErr]   = useState('');
  const [passErr, setPassErr]     = useState('');
  const [globalErr, setGlobalErr] = useState('');
  const [submitting, setSubmit]   = useState(false);

  // ── Registro empresa ──────────────────────────────────────────────────────
  const [companyName, setCompanyName]   = useState('');
  const [companySlug, setCompanySlug]   = useState('');
  const [adminEmail, setAdminEmail]     = useState('');
  const [adminName, setAdminName]       = useState('');
  const [adminPass, setAdminPass]       = useState('');
  const [regError, setRegError]         = useState('');
  const [regLoading, setRegLoading]     = useState(false);
  const [regSuccess, setRegSuccess]     = useState(false);

  // ── Agregar asistente ─────────────────────────────────────────────────────
  const [newEmail, setNewEmail]     = useState('');
  const [newName, setNewName]       = useState('');
  const [newPass, setNewPass]       = useState('');
  const [newRole, setNewRole]       = useState<'employee' | 'monitor' | 'kiosk'>('employee');
  const [newStation, setNewStation] = useState('');
  const [addError, setAddError]     = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const clearErrors = () => { setEmailErr(''); setPassErr(''); setGlobalErr(''); };

  // ─── Login ────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    clearErrors();
    let ok = true;
    if (!email.trim()) { setEmailErr('El correo es obligatorio.'); ok = false; }
    if (!password)     { setPassErr('La contraseña es obligatoria.'); ok = false; }
    if (!ok || submitting) return;

    setSubmit(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        // Verificar si completó el onboarding
        const done = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (done !== 'true') {
          router.replace('/onboarding');
        }
        // AuthGate maneja la redirección por rol si onboarding ya fue hecho
      } else {
        setGlobalErr(result.error ?? 'Credenciales incorrectas.');
      }
    } finally {
      setSubmit(false);
    }
  };

  // ─── Registro de empresa nueva ────────────────────────────────────────────

  const handleRegisterCompany = async () => {
    setRegError('');
    if (!companyName.trim()) { setRegError('Ingresa el nombre de la empresa.'); return; }
    if (!companySlug.trim()) { setRegError('Ingresa el identificador (slug).'); return; }
    if (!adminEmail.trim())  { setRegError('Ingresa el correo del administrador.'); return; }
    if (!adminName.trim())   { setRegError('Ingresa el nombre del administrador.'); return; }
    if (adminPass.length < 6){ setRegError('La contraseña debe tener al menos 6 caracteres.'); return; }

    setRegLoading(true);
    try {
      // Registrar empresa + usuario admin
      // register() en authcontext acepta un objeto extendido con company_name
      const result = await register({
        email:        adminEmail.trim().toLowerCase(),
        password:     adminPass,
        full_name:    adminName.trim(),
        role:         'admin',
        company_name: companyName.trim(),
        company_slug: companySlug.trim().toLowerCase().replace(/\s+/g, '-'),
      });

      if (result.success) {
        setRegSuccess(true);
        // NO crear secciones por defecto — el admin las crea desde Config
        await AsyncStorage.removeItem(ONBOARDING_KEY); // forzar tutorial
        setTimeout(() => router.replace('/onboarding'), 1200);
      } else {
        setRegError(result.error ?? 'Error al crear la empresa.');
      }
    } finally {
      setRegLoading(false);
    }
  };

  // ─── Agregar asistente ────────────────────────────────────────────────────

  const handleAddUser = async () => {
    setAddError('');
    if (!newEmail.trim()) { setAddError('El correo es obligatorio.'); return; }
    if (!newName.trim())  { setAddError('El nombre es obligatorio.'); return; }
    if (newPass.length < 6){ setAddError('Contraseña mínimo 6 caracteres.'); return; }

    setAddLoading(true);
    try {
      const result = await register({
        email:     newEmail.trim().toLowerCase(),
        password:  newPass,
        full_name: newName.trim(),
        role:      newRole,
        station:   newStation.trim() || undefined,
      });

      if (result.success) {
        setAddSuccess(true);
        setNewEmail(''); setNewName(''); setNewPass(''); setNewStation('');
        setTimeout(() => setAddSuccess(false), 2500);
      } else {
        setAddError(result.error ?? 'Error al crear el usuario.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  const fill = (u: typeof DEMO_USERS[0]) => {
    clearErrors();
    setEmail(u.email);
    setPassword('admin123');
    setTab('login');
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* LOGO */}
          <View style={s.brand}>
            <View style={s.logoWrap}>
              <Grid size={36} color={COLORS.onPrimary} />
            </View>
            <Text style={s.brandName}>Warteliste</Text>
            <Text style={s.brandTag}>Sistema de Gestión de Turnos</Text>
          </View>

          {/* TABS */}
          <View style={s.tabBar}>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'login' && s.tabBtnActive]}
              onPress={() => setTab('login')}
            >
              <LogIn size={15} color={tab === 'login' ? COLORS.primary : COLORS.onSurfaceVariant} />
              <Text style={[s.tabBtnText, tab === 'login' && { color: COLORS.primary }]}>
                Ingresar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'register' && s.tabBtnActive]}
              onPress={() => setTab('register')}
            >
              <Building2 size={15} color={tab === 'register' ? COLORS.primary : COLORS.onSurfaceVariant} />
              <Text style={[s.tabBtnText, tab === 'register' && { color: COLORS.primary }]}>
                Nueva empresa
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'adduser' && s.tabBtnActive]}
              onPress={() => setTab('adduser')}
            >
              <UserPlus size={15} color={tab === 'adduser' ? COLORS.primary : COLORS.onSurfaceVariant} />
              <Text style={[s.tabBtnText, tab === 'adduser' && { color: COLORS.primary }]}>
                Asistente
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── TAB: LOGIN ── */}
          {tab === 'login' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Iniciar Sesión</Text>

              {!!globalErr && (
                <View style={s.errBanner}>
                  <ShieldCheck size={16} color={COLORS.onErrorContainer} />
                  <Text style={s.errBannerText}>{globalErr}</Text>
                </View>
              )}

              <View style={s.field}>
                <Text style={s.label}>Correo Electrónico</Text>
                <TextInput
                  style={[s.input, !!emailErr && s.inputErr]}
                  value={email}
                  onChangeText={t => { setEmail(t); clearErrors(); }}
                  placeholder="correo@empresa.com"
                  placeholderTextColor={COLORS.outline}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                {!!emailErr && <Text style={s.fieldErr}>{emailErr}</Text>}
              </View>

              <View style={s.field}>
                <Text style={s.label}>Contraseña</Text>
                <View style={[s.inputRow, !!passErr && s.inputErr]}>
                  <TextInput
                    style={s.inputInner}
                    value={password}
                    onChangeText={t => { setPassword(t); clearErrors(); }}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.outline}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                    {showPass
                      ? <EyeOff size={20} color={COLORS.outline} />
                      : <Eye    size={20} color={COLORS.outline} />}
                  </TouchableOpacity>
                </View>
                {!!passErr && <Text style={s.fieldErr}>{passErr}</Text>}
              </View>

              <TouchableOpacity
                style={[s.loginBtn, submitting && { opacity: 0.6 }]}
                onPress={handleLogin}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  : <><LogIn size={20} color={COLORS.onPrimary} /><Text style={s.loginBtnText}>Entrar al Sistema</Text></>}
              </TouchableOpacity>

              {/* Tutorial */}
              <TouchableOpacity
                style={s.tutorialBtn}
                onPress={() => router.push('/onboarding')}
              >
                <Text style={s.tutorialText}>📖 Ver tutorial de la aplicación</Text>
                <ChevronRight size={14} color={COLORS.primary} />
              </TouchableOpacity>

              {/* Demo */}
              <View style={s.demoBox}>
                <Text style={s.demoTitle}>Acceso rápido · contraseña: admin123</Text>
                {DEMO_USERS.map(u => (
                  <TouchableOpacity key={u.email} onPress={() => fill(u)} style={s.demoRow}>
                    <View style={[s.demoBadge, { backgroundColor: u.color + '22' }]}>
                      <Text style={[s.demoBadgeText, { color: u.color }]}>{u.label}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.demoRole}>{u.role}</Text>
                      <Text style={s.demoEmail}>{u.email}</Text>
                    </View>
                    <Text style={s.demoTap}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── TAB: NUEVA EMPRESA ── */}
          {tab === 'register' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Registrar Nueva Empresa</Text>
              <Text style={s.cardSub}>
                Crea tu empresa y el primer administrador. Las secciones de servicio
                las configuras desde el panel de administración.
              </Text>

              {regSuccess && (
                <View style={s.successBanner}>
                  <Text style={s.successText}>✅ Empresa creada. Iniciando tutorial...</Text>
                </View>
              )}

              {!!regError && (
                <View style={s.errBanner}>
                  <Text style={s.errBannerText}>{regError}</Text>
                </View>
              )}

              <View style={s.field}>
                <Text style={s.label}>Nombre de la empresa</Text>
                <TextInput
                  style={s.input}
                  value={companyName}
                  onChangeText={t => { setCompanyName(t); setCompanySlug(t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }}
                  placeholder="Ej. Clínica San José"
                  placeholderTextColor={COLORS.outline}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Identificador único (slug)</Text>
                <TextInput
                  style={s.input}
                  value={companySlug}
                  onChangeText={t => setCompanySlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="clinica-san-jose"
                  placeholderTextColor={COLORS.outline}
                  autoCapitalize="none"
                />
                <Text style={s.hint}>Solo letras minúsculas, números y guiones</Text>
              </View>

              <View style={s.divider} />
              <Text style={s.sectionHeader}>Datos del Administrador</Text>

              <View style={s.field}>
                <Text style={s.label}>Nombre completo</Text>
                <TextInput style={s.input} value={adminName} onChangeText={setAdminName}
                  placeholder="Ej. Juan Pérez" placeholderTextColor={COLORS.outline} autoCapitalize="words" />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Correo electrónico</Text>
                <TextInput style={s.input} value={adminEmail} onChangeText={setAdminEmail}
                  placeholder="admin@empresa.com" placeholderTextColor={COLORS.outline}
                  keyboardType="email-address" autoCapitalize="none" />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Contraseña (mín. 6 caracteres)</Text>
                <TextInput style={s.input} value={adminPass} onChangeText={setAdminPass}
                  placeholder="••••••••" placeholderTextColor={COLORS.outline}
                  secureTextEntry autoCapitalize="none" />
              </View>

              <TouchableOpacity
                style={[s.loginBtn, regLoading && { opacity: 0.6 }]}
                onPress={handleRegisterCompany}
                disabled={regLoading}
                activeOpacity={0.85}
              >
                {regLoading
                  ? <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  : <><Building2 size={20} color={COLORS.onPrimary} /><Text style={s.loginBtnText}>Crear Empresa</Text></>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── TAB: AGREGAR ASISTENTE ── */}
          {tab === 'adduser' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Agregar Asistente</Text>
              <Text style={s.cardSub}>
                Crea una cuenta para un empleado, monitor o kiosco dentro de tu empresa.
                Debes estar autenticado como administrador.
              </Text>

              {addSuccess && (
                <View style={s.successBanner}>
                  <Text style={s.successText}>✅ Usuario creado exitosamente</Text>
                </View>
              )}

              {!!addError && (
                <View style={s.errBanner}>
                  <Text style={s.errBannerText}>{addError}</Text>
                </View>
              )}

              <View style={s.field}>
                <Text style={s.label}>Nombre completo</Text>
                <TextInput style={s.input} value={newName} onChangeText={setNewName}
                  placeholder="Ej. María García" placeholderTextColor={COLORS.outline} autoCapitalize="words" />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Correo electrónico</Text>
                <TextInput style={s.input} value={newEmail} onChangeText={setNewEmail}
                  placeholder="empleado@empresa.com" placeholderTextColor={COLORS.outline}
                  keyboardType="email-address" autoCapitalize="none" />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Contraseña</Text>
                <TextInput style={s.input} value={newPass} onChangeText={setNewPass}
                  placeholder="••••••••" placeholderTextColor={COLORS.outline}
                  secureTextEntry autoCapitalize="none" />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Estación (opcional)</Text>
                <TextInput style={s.input} value={newStation} onChangeText={setNewStation}
                  placeholder="Ej. Estación 05" placeholderTextColor={COLORS.outline} autoCapitalize="words" />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Rol</Text>
                <View style={s.roleRow}>
                  {(['employee', 'monitor', 'kiosk'] as const).map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[s.roleOpt, newRole === r && s.roleOptActive]}
                      onPress={() => setNewRole(r)}
                    >
                      <Text style={[s.roleOptText, newRole === r && { color: COLORS.primary, fontWeight: '700' }]}>
                        {{ employee: '👤 Empleado', monitor: '🖥️ Monitor', kiosk: '🎫 Kiosco' }[r]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[s.loginBtn, addLoading && { opacity: 0.6 }]}
                onPress={handleAddUser}
                disabled={addLoading}
                activeOpacity={0.85}
              >
                {addLoading
                  ? <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  : <><UserPlus size={20} color={COLORS.onPrimary} /><Text style={s.loginBtnText}>Crear Asistente</Text></>}
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.footer}>v2.0.0 · Warteliste · Powered by Supabase</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', gap: 16 },
  brand:  { alignItems: 'center', gap: 8 },
  logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  brandName: { fontSize: 26, fontWeight: '700', color: COLORS.onBackground, marginTop: 4 },
  brandTag:  { fontSize: 13, color: COLORS.onSurfaceVariant },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 3, gap: 2, alignSelf: 'stretch', borderWidth: 1, borderColor: COLORS.outlineVariant },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 9 },
  tabBtnActive: { backgroundColor: COLORS.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  tabBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.onSurfaceVariant },

  // Card
  card:    { width: '100%', maxWidth: 440, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 14 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.onBackground },
  cardSub:   { fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 18, marginTop: -6 },

  // Banners
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.errorContainer, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.error + '40' },
  errBannerText: { flex: 1, fontSize: 13, color: COLORS.onErrorContainer },
  successBanner: { backgroundColor: '#dcfce7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#86efac' },
  successText:   { fontSize: 13, color: '#166534', fontWeight: '600' },

  // Campos
  field:    { gap: 5 },
  label:    { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint:     { fontSize: 11, color: COLORS.outline, marginTop: 2 },
  input:    { height: 50, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLow },
  inputErr: { borderColor: COLORS.error, backgroundColor: COLORS.errorContainer + '30' },
  inputRow: { height: 50, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow },
  inputInner: { flex: 1, fontSize: 15, color: COLORS.onSurface },
  eyeBtn:     { padding: 4 },
  fieldErr:   { fontSize: 12, color: COLORS.error },

  divider:      { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 4 },
  sectionHeader:{ fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Botón login
  loginBtn:     { height: 54, backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, marginTop: 4 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },

  // Tutorial
  tutorialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  tutorialText:{ fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Rol
  roleRow: { flexDirection: 'row', gap: 8 },
  roleOpt: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.outlineVariant, alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow },
  roleOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryContainer + '44' },
  roleOptText:   { fontSize: 12, color: COLORS.onSurfaceVariant },

  // Demo
  demoBox:   { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 8 },
  demoTitle: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  demoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant },
  demoBadge: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  demoBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  demoRole:  { fontSize: 13, fontWeight: '700', color: COLORS.onBackground },
  demoEmail: { fontSize: 11, color: COLORS.onSurfaceVariant },
  demoTap:   { fontSize: 16, color: COLORS.outline },

  footer: { fontSize: 12, color: COLORS.outline, textAlign: 'center' },
});