/**
 * QueueMaster Pro — Login Screen
 * Muestra credenciales demo para los 5 roles del sistema.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, LogIn, Grid, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { useAuth } from '../../store/authcontext';

const DEMO_USERS = [
  { role: 'Admin',    email: 'admin@queuemaster.com',     color: COLORS.primary,          label: 'ADM' },
  { role: 'Empleado', email: 'marcus@queuemaster.com',    color: COLORS.secondary,        label: 'EMP' },
  { role: 'Empleado', email: 'employee2@queuemaster.com', color: COLORS.secondary,        label: 'EMP' },
  { role: 'Monitor',  email: 'monitor@queuemaster.com',   color: '#565e74',               label: 'MON' },
  { role: 'Kiosco',   email: 'kiosk@queuemaster.com',     color: COLORS.primaryContainer, label: 'KSK' },
];

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [emailErr, setEmailErr]   = useState('');
  const [passErr, setPassErr]     = useState('');
  const [globalErr, setGlobalErr] = useState('');
  const [submitting, setSubmit]   = useState(false);

  const clearErrors = () => { setEmailErr(''); setPassErr(''); setGlobalErr(''); };

  const validate = () => {
    clearErrors();
    let ok = true;
    if (!email.trim()) { setEmailErr('El correo es obligatorio.'); ok = false; }
    if (!password)     { setPassErr('La contraseña es obligatoria.'); ok = false; }
    return ok;
  };

  const handleLogin = async () => {
    if (!validate() || submitting) return;
    setSubmit(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        // La redirección la maneja AuthGate según el rol
      } else {
        setGlobalErr(result.error ?? 'Credenciales incorrectas.');
      }
    } finally {
      setSubmit(false);
    }
  };

  const fill = (u: typeof DEMO_USERS[0]) => {
    clearErrors();
    setEmail(u.email);
    setPassword('admin123');
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* LOGO */}
          <View style={s.brand}>
            <View style={s.logoWrap}>
              <Grid size={36} color={COLORS.onPrimary} />
            </View>
            <Text style={s.brandName}>QueueMaster Pro</Text>
            <Text style={s.brandTag}>Sistema de Gestión de Turnos</Text>
          </View>

          {/* CARD */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Iniciar Sesión</Text>

            {!!globalErr && (
              <View style={s.errBanner}>
                <ShieldCheck size={16} color={COLORS.onErrorContainer} />
                <Text style={s.errBannerText}>{globalErr}</Text>
              </View>
            )}

            {/* Email */}
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

            {/* Password */}
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
                  {showPass ? <EyeOff size={20} color={COLORS.outline} /> : <Eye size={20} color={COLORS.outline} />}
                </TouchableOpacity>
              </View>
              {!!passErr && <Text style={s.fieldErr}>{passErr}</Text>}
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[s.loginBtn, submitting && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color={COLORS.onPrimary} />
                : <><LogIn size={20} color={COLORS.onPrimary} /><Text style={s.loginBtnText}>Entrar al Sistema</Text></>
              }
            </TouchableOpacity>

            {/* Credenciales demo */}
            <View style={s.demoBox}>
              <Text style={s.demoTitle}>Acceso rápido por rol · contraseña: admin123</Text>
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

          <Text style={s.footer}>v1.0.0 · Datos almacenados localmente</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', gap: 20 },
  brand: { alignItems: 'center', gap: 8 },
  logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  brandName: { fontSize: 26, fontWeight: '700', color: COLORS.onBackground, marginTop: 4 },
  brandTag: { fontSize: 13, color: COLORS.onSurfaceVariant },
  card: { width: '100%', maxWidth: 440, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.onBackground },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.errorContainer, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.error + '40' },
  errBannerText: { flex: 1, fontSize: 13, color: COLORS.onErrorContainer },
  field: { gap: 5 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 50, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLow },
  inputErr: { borderColor: COLORS.error, backgroundColor: COLORS.errorContainer + '30' },
  inputRow: { height: 50, borderWidth: 1.5, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow },
  inputInner: { flex: 1, fontSize: 15, color: COLORS.onSurface },
  eyeBtn: { padding: 4 },
  fieldErr: { fontSize: 12, color: COLORS.error },
  loginBtn: { height: 54, backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, marginTop: 4 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },
  demoBox: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 8 },
  demoTitle: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant },
  demoBadge: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  demoBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  demoRole: { fontSize: 13, fontWeight: '700', color: COLORS.onBackground },
  demoEmail: { fontSize: 11, color: COLORS.onSurfaceVariant },
  demoTap: { fontSize: 16, color: COLORS.outline },
  footer: { fontSize: 12, color: COLORS.outline, textAlign: 'center' },
});