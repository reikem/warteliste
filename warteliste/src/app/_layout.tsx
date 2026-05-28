/**
 * QueueMaster Pro — Root Layout
 * SDK 56 · Sin @react-navigation/native
 * Redirección por rol al hacer login.
 */

import React, { useEffect } from 'react';
import { Tabs, router, useSegments } from 'expo-router';
import { useColorScheme, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LayoutDashboard, Printer, Home, Tv, Monitor, Settings } from 'lucide-react-native';
import { AuthProvider, useAuth } from '../../service/authContext';
import { COLORS } from '../constants/colors';

// ─── Ruta inicial según rol ───────────────────────────────────────────────────

function homeRouteForRole(role: string): string {
  switch (role) {
    case 'admin':    return '/queueMasterSetupScreen';
    case 'employee': return '/dashboard';
    case 'monitor':  return '/monitor';
    case 'kiosk':    return '/kiosk';
    default:         return '/dashboard';
  }
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const onLoginScreen = segments[0] === 'login';

    if (!isAuthenticated && !onLoginScreen) {
      router.replace('/login');
    } else if (isAuthenticated && onLoginScreen && user) {
      router.replace(homeRouteForRole(user.role) as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

// ─── Tabs (visibilidad por rol) ───────────────────────────────────────────────

function AppTabs() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const role = user?.role ?? '';

  // helper: null oculta del tab bar
  const show = (allowedRoles: string[]) => allowedRoles.includes(role) ? undefined : null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: isDark ? COLORS.outlineVariant : COLORS.onSurfaceVariant,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? COLORS.inverseSurface : COLORS.surfaceContainerLowest,
          borderTopColor: isDark ? COLORS.outline : COLORS.outlineVariant,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {/* Inicio — todos los roles autenticados */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', href: show(['admin','employee','monitor','kiosk']), tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />

      {/* Dashboard — solo empleados */}
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', href: show(['employee']), tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }}
      />

      {/* Ticket (print preview) — kiosk después de crear ticket */}
      <Tabs.Screen
        name="printPreview"
        options={{ title: 'Mi Ticket', href: show(['kiosk']), tabBarIcon: ({ color }) => <Printer size={22} color={color} /> }}
      />

      {/* Kiosko — solo kiosk */}
      <Tabs.Screen
        name="kiosk"
        options={{ title: 'Kiosco', href: show(['kiosk']), tabBarIcon: ({ color }) => <Tv size={22} color={color} /> }}
      />

      {/* Monitor — solo monitor */}
      <Tabs.Screen
        name="monitor"
        options={{ title: 'Monitor', href: show(['monitor']), tabBarIcon: ({ color }) => <Monitor size={22} color={color} /> }}
      />

      {/* Config — solo admin */}
      <Tabs.Screen
        name="queueMasterSetupScreen"
        options={{ title: 'Config', href: show(['admin']), tabBarIcon: ({ color }) => <Settings size={22} color={color} /> }}
      />

      {/* Sin tab bar */}
      <Tabs.Screen name="login"   options={{ href: null }} />
    </Tabs>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <AuthGate>
          <AppTabs />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}