/**
 * Warteliste — Root Layout
 * DUAL SYNC:
 *   - initNetworkListener() al arrancar → detecta conexión y drena cola pendiente
 *   - initialSync() al autenticar → descarga datos frescos de Supabase → SQLite
 *   - subscribeRealtimeQueue() → monitor recibe cambios en tiempo real
 *   - useFonts → carga MaterialIcons antes de renderizar tabs
 *
 * Ubicación: app/_layout.tsx
 */

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Tabs, router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Home, LayoutDashboard, Tv, Monitor, Settings,
} from 'lucide-react-native';

import { AuthProvider, useAuth } from '../../store/authcontext';
import { setActiveCompanyId } from '../../service/queueservice';
import {
  initNetworkListener,
  initialSync,
  subscribeRealtimeQueue,
} from '../../service/syncService';
import { COLORS } from '../constants/colors';

// ─── Guard de autenticación ───────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments  = useSegments();
  const unsubRef  = useRef<(() => void) | null>(null);

  // Sincronizar company_id y arrancar sync cuando el usuario se autentica
  useEffect(() => {
    if (!user) {
      // Limpiar suscripción Realtime al cerrar sesión
      unsubRef.current?.();
      unsubRef.current = null;
      return;
    }

    const companyId = user.company_id ?? 1;
    setActiveCompanyId(companyId);

    // Sync inicial en background (no bloquea UI)
    initialSync(companyId).catch(console.warn);

    // Suscripción Realtime → actualiza SQLite local cuando otro dispositivo
    // llama un turno (importante para el monitor en TV)
    unsubRef.current?.(); // limpiar anterior si existe
    unsubRef.current = subscribeRealtimeQueue(companyId);

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [user?.id]);

  // Navegación por autenticación
  useEffect(() => {
    if (isLoading) return;
    const onLogin      = segments[0] === 'login';
    const onOnboarding = segments[0] === 'onboarding';

    if (!isAuthenticated && !onLogin && !onOnboarding) {
      router.replace('/login');
    } else if (isAuthenticated && onLogin) {
      switch (user?.role) {
        case 'monitor': router.replace('/monitor');   break;
        case 'kiosk':   router.replace('/kiosk');     break;
        default:        router.replace('/dashboard'); break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function AppTabs() {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const { user }    = useAuth();
  const role        = user?.role ?? 'employee';
  const show        = (roles: string[]) => (roles.includes(role) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: isDark ? COLORS.outlineVariant : COLORS.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: isDark ? COLORS.inverseSurface : COLORS.surfaceContainerLowest,
          borderTopColor:  isDark ? COLORS.outline : COLORS.outlineVariant,
          height: 60, paddingBottom: 8, paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"
        options={{ title: 'Inicio', href: show(['admin']), tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="dashboard"
        options={{ title: 'Dashboard', href: show(['admin','employee','supervisor']), tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }} />
      <Tabs.Screen name="kiosk"
        options={{ title: 'Kiosko', href: show(['admin','kiosk']), tabBarIcon: ({ color }) => <Tv size={22} color={color} /> }} />
      <Tabs.Screen name="monitor"
        options={{ title: 'Monitor', href: show(['admin','monitor']), tabBarIcon: ({ color }) => <Monitor size={22} color={color} /> }} />
      <Tabs.Screen name="queueMasterSetupScreen"
        options={{ title: 'Config', href: show(['admin']), tabBarIcon: ({ color }) => <Settings size={22} color={color} /> }} />
      <Tabs.Screen name="login"        options={{ href: null }} />
      <Tabs.Screen name="printPreview" options={{ href: null }} />
      <Tabs.Screen name="onboarding"   options={{ href: null }} />
    </Tabs>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Pre-cargar fuente MaterialIcons (resuelve crash en queueMasterSetupScreen)
  const [fontsLoaded] = useFonts({ ...MaterialIcons.font });

  // Iniciar listener de red al arrancar la app (drena cola pendiente al reconectar)
  useEffect(() => {
    const unsub = initNetworkListener();
    return unsub;
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
});