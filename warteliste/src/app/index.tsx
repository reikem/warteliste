/**
 * QueueMaster Pro — Home / Index Screen
 * Navegación filtrada por rol:
 *   admin      → todas las pantallas
 *   employee   → solo Dashboard
 *   kiosk      → solo Kiosko
 *   monitor    → solo Pantalla de Turnos
 *
 * Ubicación: app/(tabs)/index.tsx
 */

import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Href, router } from 'expo-router';
import {
  LayoutDashboard, Printer, Tv, Monitor,
  Settings, ChevronRight, LucideIcon, LogOut,
} from 'lucide-react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '../../store/authcontext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UserRole = 'admin' | 'employee' | 'supervisor' | 'monitor' | 'kiosk';

interface NavItem {
  href: Href;
  label: string;
  Icon: LucideIcon;
  roles: UserRole[];
}

// ─── Ítems de navegación por rol ─────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Employee Dashboard',
    Icon: LayoutDashboard,
    roles: ['admin', 'employee', 'supervisor'],
  },
  {
    href: '/printPreview',
    label: 'Previsualizar Impresión',
    Icon: Printer,
    roles: ['admin'],
  },
  {
    href: '/kiosk',
    label: 'Modo Kiosko (Autogestión)',
    Icon: Tv,
    roles: ['admin', 'kiosk'],
  },
  {
    href: '/monitor',
    label: 'Pantalla de Turnos (Monitor)',
    Icon: Monitor,
    roles: ['admin', 'monitor'],
  },
  {
    href: '/queueMasterSetupScreen',
    label: 'Configuración Inicial',
    Icon: Settings,
    roles: ['admin'],
  },
];

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const role = (user?.role ?? 'employee') as UserRole;
  const [loggingOut, setLoggingOut] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(role),
  );

  // ── Cierre de sesión ────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      `¿Deseas cerrar la sesión de ${user?.full_name ?? 'este usuario'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace('/login');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={{ width: '100%' }}
        >
          {/* Hero Header */}
          <ThemedView style={styles.heroSection}>
            <AnimatedIcon />
            <ThemedText type="title" style={styles.title}>
              QueueMaster Pro
            </ThemedText>
            <ThemedText type="small" style={styles.subtitle}>
              {user
                ? `${user.full_name} · ${role.charAt(0).toUpperCase() + role.slice(1)}`
                : 'Panel de gestión de turnos'}
            </ThemedText>
          </ThemedView>

          <ThemedText type="code" style={styles.sectionLabel}>
            Módulos del Sistema
          </ThemedText>

          {/* Lista de accesos */}
          <ThemedView type="backgroundElement" style={styles.stepContainer}>
            {visibleItems.map((item, index) => {
              const isLast = index === visibleItems.length - 1;
              return (
                <Link key={item.href as string} href={item.href} asChild>
                  <TouchableOpacity
                    style={StyleSheet.flatten([
                      styles.menuRow,
                      isLast && { borderBottomWidth: 0 },
                    ])}
                    activeOpacity={0.7}
                  >
                    <item.Icon size={20} color="#00685f" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <ThemedText style={styles.menuLabel}>{item.label}</ThemedText>
                    </View>
                    <ChevronRight size={18} color="#6d7a77" />
                  </TouchableOpacity>
                </Link>
              );
            })}

            {visibleItems.length === 0 && (
              <View style={styles.menuRow}>
                <ThemedText style={styles.emptyText}>
                  No hay módulos disponibles para tu rol.
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* ── Cerrar sesión ─────────────────────────────────────────────── */}
          {user && (
            <TouchableOpacity
              style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.75}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#c0392b" />
              ) : (
                <>
                  <LogOut size={18} color="#c0392b" />
                  <ThemedText style={styles.logoutText}>Cerrar sesión</ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}

          {Platform.OS === 'web' && <WebBadge />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
    width: '100%',
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: Spacing.four,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#00685f',
    marginTop: Spacing.two,
  },
  stepContainer: {
    gap: 0,
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bcc9c6',
    backgroundColor: '#ffffff',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: '#eff4ff',
  },
  menuLabel: {
    fontWeight: '600',
  },
  emptyText: {
    color: '#6d7a77',
    fontSize: 14,
  },

  // ── Logout ──────────────────────────────────────────────────────────────────
  logoutBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#f5c6c6',
    backgroundColor: '#fff5f5',
    marginTop: Spacing.two,
  },
  logoutBtnDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c0392b',
  },
});