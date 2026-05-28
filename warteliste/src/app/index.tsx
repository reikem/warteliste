import React from 'react';
import { Platform, StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { LayoutDashboard, Printer, Tv, Monitor, Settings, ChevronRight } from 'lucide-react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
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
              Panel de desarrollo y acceso rápido a pantallas operacionales.
            </ThemedText>
          </ThemedView>

          <ThemedText type="code" style={styles.code}>
            Módulos del Sistema
          </ThemedText>

          {/* Contenedor de Accesos rápidos */}
          <ThemedView type="backgroundElement" style={styles.stepContainer}>
            
            <Link href="/dashboard" asChild>
              <TouchableOpacity style={styles.menuRow}>
                <LayoutDashboard size={20} color="#00685f" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ fontWeight: '600' }}>Employee Dashboard</ThemedText>
                </View>
                <ChevronRight size={18} color="#6d7a77" />
              </TouchableOpacity>
            </Link>

            <Link href="/printPreview" asChild>
              <TouchableOpacity style={styles.menuRow}>
                <Printer size={20} color="#00685f" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ fontWeight: '600' }}>Previsualizar Impresión</ThemedText>
                </View>
                <ChevronRight size={18} color="#6d7a77" />
              </TouchableOpacity>
            </Link>

            <Link href="/kiosk" asChild>
              <TouchableOpacity style={styles.menuRow}>
                <Tv size={20} color="#00685f" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ fontWeight: '600' }}>Modo Kiosko (Autogestión)</ThemedText>
                </View>
                <ChevronRight size={18} color="#6d7a77" />
              </TouchableOpacity>
            </Link>

            <Link href="/monitor" asChild>
              <TouchableOpacity style={styles.menuRow}>
                <Monitor size={20} color="#00685f" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ fontWeight: '600' }}>Pantalla de Turnos (Monitor)</ThemedText>
                </View>
                <ChevronRight size={18} color="#6d7a77" />
              </TouchableOpacity>
            </Link>

            <Link href="/queueMasterSetupScreen" asChild>
              {/* SOLUCIÓN: Uso de StyleSheet.flatten para combinar los estilos */}
              <TouchableOpacity style={StyleSheet.flatten([styles.menuRow, { borderBottomWidth: 0 }])}>
                <Settings size={20} color="#00685f" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ fontWeight: '600' }}>Configuración Inicial</ThemedText>
                </View>
                <ChevronRight size={18} color="#6d7a77" />
              </TouchableOpacity>
            </Link>

          </ThemedView>

          {Platform.OS === 'web' && <WebBadge />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

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
  code: {
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
  }
});