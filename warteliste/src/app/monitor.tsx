/**
 * Warteliste — Monitor
 * + Widget de clima real (Open-Meteo API, sin API key)
 * + Carrusel automático de fotos/videos subidos desde Setup
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  Easing, Dimensions, StyleSheet, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Wifi, WifiOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { getRecentCompleted, getQueueStats, getSystemConfig } from '../../service/queueservice';
import { bus, EVENTS, TicketCalledPayload, TicketCreatedPayload } from '../../service/eventBus';
import type { Queue } from '../../service/database';
import { useAuth } from '../../store/authcontext';
import type { MediaItem } from './queueMasterSetupScreen';

const { width: SW } = Dimensions.get('window');

// ─── Ciudades (deben coincidir con Setup) ─────────────────────────────────────

const WEATHER_CITIES: Record<string, { lat: number; lon: number; label: string }> = {
  mexico_cdmx:    { lat: 19.4326,  lon: -99.1332,  label: 'CDMX' },
  spain_madrid:   { lat: 40.4168,  lon: -3.7038,   label: 'Madrid' },
  argentina_ba:   { lat: -34.6037, lon: -58.3816,  label: 'Bs. Aires' },
  colombia_bogota:{ lat: 4.7110,   lon: -74.0721,  label: 'Bogotá' },
  chile_santiago: { lat: -33.4489, lon: -70.6693,  label: 'Santiago' },
  chile_vina:     { lat: -33.0245, lon: -71.5518,  label: 'Viña del Mar' },
  peru_lima:      { lat: -12.0464, lon: -77.0428,  label: 'Lima' },
  usa_ny:         { lat: 40.7128,  lon: -74.0060,  label: 'New York' },
  usa_miami:      { lat: 25.7617,  lon: -80.1918,  label: 'Miami' },
};

// WMO weather code → emoji + descripción
function weatherCodeToInfo(code: number): { icon: string; desc: string } {
  if (code === 0)              return { icon: '☀️',  desc: 'Despejado' };
  if (code <= 2)               return { icon: '⛅',  desc: 'Parcial' };
  if (code === 3)              return { icon: '☁️',  desc: 'Nublado' };
  if (code <= 49)              return { icon: '🌫️', desc: 'Neblina' };
  if (code <= 57)              return { icon: '🌧️', desc: 'Llovizna' };
  if (code <= 67)              return { icon: '🌧️', desc: 'Lluvia' };
  if (code <= 77)              return { icon: '❄️',  desc: 'Nieve' };
  if (code <= 82)              return { icon: '🌦️', desc: 'Chubascos' };
  if (code <= 86)              return { icon: '🌨️', desc: 'Nevada' };
  if (code >= 95)              return { icon: '⛈️',  desc: 'Tormenta' };
  return { icon: '🌡️', desc: 'Clima' };
}

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  cityLabel: string;
}

// ─── Sub-componente: Widget de Clima ─────────────────────────────────────────

function WeatherWidget({ cityKey }: { cityKey: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const city = WEATHER_CITIES[cityKey];
    if (!city) { setLoading(false); return; }

    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
        const res  = await fetch(url);
        const data = await res.json();
        const c    = data.current;
        setWeather({
          temp:        Math.round(c.temperature_2m),
          feelsLike:   Math.round(c.apparent_temperature),
          humidity:    c.relative_humidity_2m,
          windSpeed:   Math.round(c.wind_speed_10m),
          weatherCode: c.weather_code,
          cityLabel:   city.label,
        });
      } catch {
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // actualiza cada 10 min
    return () => clearInterval(interval);
  }, [cityKey]);

  if (loading) {
    return (
      <View style={wStyles.widget}>
        <Text style={wStyles.loadingText}>🌡️ --°</Text>
      </View>
    );
  }
  if (!weather) return null;

  const { icon, desc } = weatherCodeToInfo(weather.weatherCode);

  return (
    <View style={wStyles.widget}>
      <Text style={wStyles.icon}>{icon}</Text>
      <View>
        <Text style={wStyles.temp}>{weather.temp}°C</Text>
        <Text style={wStyles.city}>{weather.cityLabel}</Text>
      </View>
      <View style={wStyles.details}>
        <Text style={wStyles.detail}>💧 {weather.humidity}%</Text>
        <Text style={wStyles.detail}>💨 {weather.windSpeed} km/h</Text>
      </View>
    </View>
  );
}

const wStyles = StyleSheet.create({
  widget: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  icon:        { fontSize: 22 },
  temp:        { fontSize: 16, fontWeight: '700', color: '#fff' },
  city:        { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  details:     { gap: 2 },
  detail:      { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
});

// ─── Sub-componente: Carrusel Multimedia ─────────────────────────────────────

function MediaCarousel({ items }: { items: MediaItem[] }) {
  const [index, setIndex]   = useState(0);
  const fadeAnim            = useRef(new Animated.Value(1)).current;
  const videoRef            = useRef<any>(null);

  // Avanza al siguiente slide automáticamente
  useEffect(() => {
    if (items.length <= 1) return;
    const current = items[index];
    // Videos: dejarlos terminar (máx 30s), imágenes: 6s
    const duration = current.type === 'video' ? 30000 : 6000;
    const timer = setTimeout(() => advance(), duration);
    return () => clearTimeout(timer);
  }, [index, items]);

  const advance = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setIndex(i => (i + 1) % items.length);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  }, [fadeAnim, items.length]);

  if (items.length === 0) return null;

  const current = items[index];

  return (
    <View style={cStyles.container}>
      <Animated.View style={[cStyles.slide, { opacity: fadeAnim }]}>
      {current.type === 'image' ? (
  <Image source={{ uri: current.uri }} style={cStyles.media} resizeMode="cover" />
) : (
  <View style={[cStyles.media, cStyles.videoPlaceholder]}>
    <Text style={{ fontSize: 48 }}>▶️</Text>
    <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>{current.name}</Text>
    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Video</Text>
  </View>
)}
        {/* Overlay suave en la parte inferior */}
        <View style={cStyles.overlay} />
      </Animated.View>

      {/* Indicadores de posición */}
      {items.length > 1 && (
        <View style={cStyles.dots}>
          {items.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setIndex(i)}>
              <View style={[cStyles.dot, i === index && cStyles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Badge tipo de contenido */}
      <View style={cStyles.badge}>
        <Text style={cStyles.badgeText}>{current.type === 'video' ? '▶ VIDEO' : '📷 FOTO'}</Text>
      </View>
    </View>
  );
}

const cStyles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden', height: 200, backgroundColor: COLORS.inverseSurface },
  slide:     { flex: 1 },
  media:     { width: '100%', height: '100%' },
  overlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.3)' },
  dots:      { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 18, backgroundColor: '#fff' },
  badge:     { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  videoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
});

// ─── Pantalla Principal ───────────────────────────────────────────────────────

interface CurrentCall {
  ticketNumber: string;
  desk: string;
  sectionTitle: string;
  servedBy: string;
}

export default function MonitorScreen() {
  const { logout } = useAuth();

  const [current, setCurrent] = useState<CurrentCall | null>(null);
  const [history, setHistory] = useState<Queue[]>([]);
  const [stats, setStats]     = useState({ waiting: 0, serving: 0, completed_today: 0, avg_wait_seconds: 0 });
  const [currentTime, setTime]= useState('');
  const [isLive, setIsLive]   = useState(true);
  const [newCall, setNewCall] = useState(false);

  // Config del sistema
  const [showWeather, setShowWeather] = useState(true);
  const [weatherCity, setWeatherCity] = useState('chile_vina');
  const [mediaItems, setMediaItems]   = useState<MediaItem[]>([]);

  // Animaciones
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const flashAnim   = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(1)).current;
  const marqueeAnim = useRef(new Animated.Value(SW)).current;

  // ─── Cargar config del sistema ──────────────────────────────────────────────

  const loadConfig = useCallback(() => {
    setShowWeather(getSystemConfig('show_weather') !== 'false');
    setWeatherCity(getSystemConfig('weather_city') ?? 'chile_vina');
    try {
      const saved = getSystemConfig('monitor_media');
      console.log('[Monitor] media raw:', saved);  // ← agrega esto
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[Monitor] media items:', parsed.length, parsed[0]?.uri);
        setMediaItems(parsed);
      }
    } catch (e) {
      console.log('[Monitor] media error:', e);
    }
  }, []);

  // ─── Datos de la cola ───────────────────────────────────────────────────────

  const reloadStats = useCallback(() => {
    setStats(getQueueStats());
    setHistory(getRecentCompleted(6));
  }, []);

  useEffect(() => {
    reloadStats();
    loadConfig();
  }, [reloadStats, loadConfig]);

  // Recargar config al entrar en foco (por si Admin cambió algo)
  useEffect(() => {
    const unsub = bus.on(EVENTS.QUEUE_UPDATED, () => {
      loadConfig();
    });
    return unsub;
  }, [loadConfig]);

  // ─── Reloj ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Pulso continuo ─────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // ─── Marquee ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const runMarquee = () => {
      marqueeAnim.setValue(SW);
      Animated.timing(marqueeAnim, { toValue: -SW * 2, duration: 22000, easing: Easing.linear, useNativeDriver: true })
        .start(({ finished }) => { if (finished) runMarquee(); });
    };
    runMarquee();
  }, [marqueeAnim]);

  // ─── Flash al llamar ────────────────────────────────────────────────────────

  const playCallAnimation = useCallback(() => {
    setNewCall(true);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
    Animated.sequence([
      Animated.timing(numberScale, { toValue: 1.15, duration: 200, useNativeDriver: true }),
      Animated.spring(numberScale,  { toValue: 1,    useNativeDriver: true, friction: 4 }),
    ]).start();
    setTimeout(() => setNewCall(false), 3000);
  }, [flashAnim, numberScale]);

  // ─── EventBus ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubCall = bus.on<TicketCalledPayload>(EVENTS.TICKET_CALLED, (payload) => {
      setCurrent({ ticketNumber: payload.ticketNumber, desk: payload.desk, sectionTitle: payload.sectionTitle, servedBy: payload.servedBy });
      playCallAnimation();
      reloadStats();
    });
    const unsubQueue   = bus.on(EVENTS.QUEUE_UPDATED, () => { reloadStats(); setHistory(getRecentCompleted(6)); });
    const unsubCreated = bus.on<TicketCreatedPayload>(EVENTS.TICKET_CREATED, () => { reloadStats(); });
    return () => { unsubCall(); unsubQueue(); unsubCreated(); };
  }, [playCallAnimation, reloadStats]);

  const flashBg = flashAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [COLORS.surfaceContainerLowest, COLORS.primary + '18'],
  });

  const handleLogout = () => {
    Alert.alert('Salir', '¿Cerrar sesión de monitor?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const formatWait = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.round(secs / 60)}m`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={[styles.liveDot, { backgroundColor: isLive ? '#4ade80' : COLORS.error }]} />
          <Text style={styles.topTitle}>Warteliste</Text>
          <Text style={styles.topSub}>Monitor · Sala de Espera</Text>
        </View>
        <View style={styles.topRight}>
          {/* Widget clima en la barra superior */}
          {showWeather && <WeatherWidget cityKey={weatherCity} />}
          <Text style={styles.clock}>{currentTime}</Text>
          {isLive ? <Wifi size={16} color="#4ade80" /> : <WifiOff size={16} color={COLORS.error} />}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={18} color={COLORS.inverseOnSurface + 'aa'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* AHORA SIRVIENDO */}
        <Animated.View style={[styles.nowCard, { backgroundColor: flashBg }]}>
          {newCall && (
            <View style={styles.newCallBanner}>
              <Text style={styles.newCallText}>🔔 ¡NUEVO LLAMADO!</Text>
            </View>
          )}
          <View style={styles.nowHeader}>
            <Text style={styles.nowLabel}>🔔  AHORA SIRVIENDO</Text>
            {current && (
              <View style={styles.deskBadge}>
                <Text style={styles.deskBadgeText}>{current.desk}</Text>
              </View>
            )}
          </View>

          {current ? (
            <>
              <Animated.Text style={[styles.bigNumber, { transform: [{ scale: numberScale }] }]}>
                {current.ticketNumber}
              </Animated.Text>
              <Text style={styles.nowSection}>{current.sectionTitle}</Text>
              <View style={styles.deskRow}>
                <Text style={styles.deskLabel}>Dirígete a:</Text>
                <View style={styles.deskChip}>
                  <Text style={styles.deskChipText}>{current.desk}</Text>
                </View>
              </View>
              <Text style={styles.servedBy}>Atendido por: {current.servedBy}</Text>
            </>
          ) : (
            <View style={styles.standby}>
              <Text style={styles.standbyIcon}>⏳</Text>
              <Text style={styles.standbyText}>En espera de llamado...</Text>
              <Text style={styles.standbySub}>El número aparecerá aquí cuando un empleado llame el siguiente turno</Text>
            </View>
          )}
        </Animated.View>

        {/* ESTADÍSTICAS */}
        <View style={styles.statsRow}>
          {[
            { label: 'Esperando',   val: stats.waiting,          icon: '👥', color: COLORS.primary },
            { label: 'Completados', val: stats.completed_today,  icon: '✅', color: COLORS.primaryContainer },
            { label: 'Espera prom', val: formatWait(stats.avg_wait_seconds), icon: '⏱', color: COLORS.secondary },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* CARRUSEL MULTIMEDIA — solo si hay contenido */}
        {mediaItems.length > 0 && (
          <View style={styles.mediaSection}>
            <Text style={styles.mediaSectionTitle}>📺  Contenido del Monitor</Text>
            <MediaCarousel items={mediaItems} />
          </View>
        )}

        {/* HISTORIAL RECIENTE */}
        {history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Turnos Recientes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
              {history.map((t, i) => (
                <View key={t.id} style={[styles.histChip, { opacity: 1 - i * 0.13 }]}>
                  <Text style={styles.histNum}>{t.ticket_number}</Text>
                  <Text style={styles.histDesk}>{t.desk ?? '—'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* MARQUEE INFERIOR */}
      <View style={styles.marqueeBar}>
        <Animated.Text style={[styles.marqueeText, { transform: [{ translateX: marqueeAnim }] }]}>
          ⚡ Tiempo estimado de espera: {formatWait(stats.avg_wait_seconds)}  •  {stats.waiting} personas en fila  •  Tenga su identificación lista para un servicio más rápido  •  Únase a nuestro programa de fidelidad para prioridad de atención
        </Animated.Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.inverseSurface },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.inverseSurface, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLORS.inverseOnSurface },
  topSub: { fontSize: 12, color: COLORS.inverseOnSurface + '80' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clock: { fontSize: 13, fontWeight: '600', color: COLORS.inverseOnSurface },
  logoutBtn: { padding: 6 },
  scroll: { padding: 14, gap: 14, paddingBottom: 60 },
  nowCard: { borderRadius: 16, padding: 28, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.outlineVariant, overflow: 'hidden', minHeight: 280 },
  newCallBanner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: COLORS.primary, paddingVertical: 8, alignItems: 'center' },
  newCallText: { fontSize: 14, fontWeight: '800', color: COLORS.onPrimary, letterSpacing: 2 },
  nowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 },
  nowLabel: { fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant, letterSpacing: 1.5, textTransform: 'uppercase' },
  deskBadge: { backgroundColor: COLORS.primaryContainer, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  deskBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.onPrimaryContainer },
  bigNumber: { fontSize: 100, fontWeight: '800', color: COLORS.primary, letterSpacing: -4, lineHeight: 110 },
  nowSection: { fontSize: 18, fontWeight: '600', color: COLORS.onSurfaceVariant },
  deskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  deskLabel: { fontSize: 15, color: COLORS.onSurfaceVariant },
  deskChip: { backgroundColor: COLORS.primaryContainer, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  deskChipText: { fontSize: 22, fontWeight: '700', color: COLORS.onPrimaryContainer },
  servedBy: { fontSize: 12, color: COLORS.outline, marginTop: 4 },
  standby: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  standbyIcon: { fontSize: 48 },
  standbyText: { fontSize: 18, fontWeight: '600', color: COLORS.onSurfaceVariant },
  standbySub: { fontSize: 13, color: COLORS.outline, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.surfaceContainerLowest + 'dd', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.outlineVariant },
  statIcon: { fontSize: 20 },
  statVal: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: COLORS.onSurfaceVariant, textAlign: 'center' },
  // Multimedia
  mediaSection: { gap: 8 },
  mediaSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant + 'cc', textTransform: 'uppercase', letterSpacing: 1 },
  // Historial
  historyCard: { backgroundColor: COLORS.surfaceContainerLowest + 'cc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.outlineVariant, gap: 10 },
  historyTitle: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  historyScroll: { gap: 10 },
  histChip: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 80, borderWidth: 1, borderColor: COLORS.outlineVariant },
  histNum: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  histDesk: { fontSize: 11, color: COLORS.onSurfaceVariant, marginTop: 2 },
  marqueeBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.primary, paddingVertical: 10, overflow: 'hidden' },
  marqueeText: { fontSize: 13, fontWeight: '600', color: COLORS.onPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
});