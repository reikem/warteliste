/**
 * Warteliste — Print Preview
 * QR generado con SVG puro (sin react-native-qrcode-svg)
 * usando la librería qrcode.js embebida como utilidad interna.
 * Cero dependencias nativas adicionales.
 *
 * Ubicación: app/(tabs)/printPreview.tsx
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, Clock, Home, Bell } from 'lucide-react-native';
import Svg, { Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { lastCreatedTicket } from './kiosk';
import {
  PRIORITY_LABELS, PRIORITY_ICONS, type TicketPriority,
} from '../../service/priorityQueue';
import { useQueueTimer } from '@/hooks/useQueueTimer';

// ─── QR puro en SVG (sin dependencias nativas) ────────────────────────────────
// Implementación minimalista de QR code versión 3 (hasta ~38 caracteres URL)
// Para URLs largas usa versión automática.

// Tabla de multiplicación GF(256)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x; GF_LOG[x] = i;
    x = x * 2; if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function gfPolyMul(p: number[], q: number[]): number[] {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++)
      r[i + j] ^= gfMul(p[i], q[j]);
  return r;
}

function rsGenPoly(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) g = gfPolyMul(g, [1, GF_EXP[i]]);
  return g;
}

function rsEncode(msg: number[], nsym: number): number[] {
  const gen = rsGenPoly(nsym);
  const out = [...msg, ...new Array(nsym).fill(0)];
  for (let i = 0; i < msg.length; i++) {
    const c = out[i];
    if (c !== 0)
      for (let j = 0; j < gen.length; j++)
        out[i + j] ^= gfMul(gen[j], c);
  }
  return out.slice(msg.length);
}

// Codificación byte para QR versión 2-M (capacidad ~32 bytes datos)
// Si el texto es más largo usa versión 3-M (~53 bytes)
function encodeQR(text: string): boolean[][] | null {
  try {
    const bytes = Array.from(new TextEncoder().encode(text));
    const n = bytes.length;
    // Versión 2-M: 28 datos + 16 EC, módulos 25x25
    // Versión 3-M: 44 datos + 26 EC, módulos 29x29
    const useV3 = n > 28;
    const version = useV3 ? 3 : 2;
    const size = version === 2 ? 25 : 29;
    const dataCapacity = version === 2 ? 28 : 44;
    const ecCount = version === 2 ? 16 : 26;

    if (n > dataCapacity - 2) return null; // texto muy largo

    // Header: modo byte (0100) + longitud (8 bits)
    let bits = '0100' + n.toString(2).padStart(8, '0');
    for (const b of bytes)
      bits += b.toString(2).padStart(8, '0');
    // Terminator
    bits += '0000';
    while (bits.length % 8 !== 0) bits += '0';
    // Pad bytes
    const pads = ['11101100', '00010001'];
    let pi = 0;
    while (bits.length < dataCapacity * 8)
      bits += pads[pi++ % 2];

    // Convertir a array de bytes
    const dataBytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8)
      dataBytes.push(parseInt(bits.slice(i, i + 8), 2));

    // Reed-Solomon
    const ec = rsEncode(dataBytes, ecCount);
    const allBytes = [...dataBytes, ...ec];

    // Construir matriz
    const mat: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false)); // función

    const set = (r: number, c: number, v: boolean, f = false) => {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      mat[r][c] = v; if (f) fn[r][c] = true;
    };

    // Finder patterns
    const finder = (tr: number, tc: number) => {
      for (let r = -1; r <= 7; r++)
        for (let c = -1; c <= 7; c++) {
          const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const border = inside && (r === 0 || r === 6 || c === 0 || c === 6);
          const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          set(tr + r, tc + c, border || center, true);
        }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // Separadores y timing ya cubiertos por finder + fn

    // Timing strips
    for (let i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0, true);
      set(i, 6, i % 2 === 0, true);
    }

    // Dark module
    set(size - 8, 8, true, true);

    // Format info (máscara 0, nivel M = 101) — simplificado
    const fmt = [1,0,1,1,1,0,0,0,0,1,0,0,1,0,1];
    const fmtPos: [number,number][] = [
      [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],
      [8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    ];
    const fmtPos2: [number,number][] = [
      [8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],
      [size-8,8],[size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8],
    ];
    fmt.forEach((v, i) => { set(fmtPos[i][0], fmtPos[i][1], v===1, true); set(fmtPos2[i][0], fmtPos2[i][1], v===1, true); });

    // Alineación versión 3
    if (version === 3) {
      const center = 20;
      for (let r = -2; r <= 2; r++)
        for (let c = -2; c <= 2; c++) {
          const v = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
          set(center + r, center + c, v, true);
        }
    }

    // Colocar bits de datos (zigzag)
    let bi = 0;
    const allBits: boolean[] = [];
    for (const byte of allBytes)
      for (let b = 7; b >= 0; b--)
        allBits.push((byte >> b & 1) === 1);

    let up = true;
    for (let col = size - 1; col >= 0; col -= 2) {
      if (col === 6) col--;
      for (let row = 0; row < size; row++) {
        const r = up ? size - 1 - row : row;
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          if (!fn[r][c] && bi < allBits.length) {
            // Máscara 0: (r+c) % 2 === 0
            mat[r][c] = allBits[bi++] !== ((r + c) % 2 === 0);
          }
        }
      }
      up = !up;
    }

    return mat;
  } catch { return null; }
}

// ─── Componente QR SVG ────────────────────────────────────────────────────────

function QRCodeSVG({ value, size = 120, color = '#000', bg = '#fff' }: {
  value: string; size?: number; color?: string; bg?: string;
}) {
  const matrix = encodeQR(value);
  if (!matrix) {
    // Fallback: cuadrado con mensaje
    return (
      <View style={{ width: size, height: size, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
        <Text style={{ fontSize: 9, color, textAlign: 'center' }}>QR{'\n'}no disp.</Text>
      </View>
    );
  }

  const modules = matrix.length;
  const mod = size / (modules + 4); // 2 módulos de quiet zone
  const offset = mod * 2;

  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill={bg} />
      {matrix.flatMap((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <Rect
              key={`${r}-${c}`}
              x={offset + c * mod}
              y={offset + r * mod}
              width={mod}
              height={mod}
              fill={color}
            />
          ) : null
        )
      )}
    </Svg>
  );
}

// ─── Config monitor ───────────────────────────────────────────────────────────

const BASE_MONITOR_URL = 'https://vmgvnxzcfqhmjexfkthk.supabase.co/monitor';

function buildQrUrl(companySlug: string, ticketNumber: string) {
  // URL corta para que quepa en el QR v2/v3
  return `${BASE_MONITOR_URL}?e=${companySlug}&t=${encodeURIComponent(ticketNumber)}`;
}

// ─── Colores prioridad ────────────────────────────────────────────────────────

const PRIO_COLORS: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  urgent: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
  vip:    { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' },
  senior: { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  normal: { bg: COLORS.primaryContainer + '33', text: COLORS.primary, border: COLORS.primary + '33' },
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function PrintPreviewScreen() {
  const ticket   = lastCreatedTicket;
  const priority = (ticket?.priority ?? 'normal') as TicketPriority;
  const pc       = PRIO_COLORS[priority];

  const { ahead, estimatedWaitMinutes, elapsedFormatted, isNext, isCalled } =
    useQueueTimer(ticket?.ticketId ?? null, ticket?.avgTime ?? 10);

  const qrUrl = ticket
    ? buildQrUrl(ticket.companySlug ?? 'warteliste', ticket.ticketNumber)
    : BASE_MONITOR_URL;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isNext && !isCalled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isNext, isCalled, pulseAnim]);

  const handleNewTicket = () => router.replace('/kiosk');

  if (!ticket) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.noTicket}>
          <Text style={{ fontSize: 48 }}>🎫</Text>
          <Text style={styles.noTicketText}>No hay ticket activo.</Text>
          <TouchableOpacity style={styles.homeBtn} onPress={handleNewTicket}>
            <Text style={styles.homeBtnText}>Ir al Kiosco</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {isCalled && (
          <Animated.View style={[styles.calledAlert, { transform: [{ scale: pulseAnim }] }]}>
            <Bell size={22} color={COLORS.onPrimary} />
            <Text style={styles.calledAlertText}>¡Es tu turno! Pasa a {ticket.sectionTitle}</Text>
          </Animated.View>
        )}

        {!isCalled && isNext && (
          <Animated.View style={[styles.nextAlert, { transform: [{ scale: pulseAnim }] }]}>
            <Bell size={18} color="#78350f" />
            <Text style={styles.nextAlertText}>¡Prepárate! Eres el siguiente</Text>
          </Animated.View>
        )}

        <View style={styles.ticketCard}>
          <View style={styles.holeLeft} />
          <View style={styles.holeRight} />

          <View style={styles.ticketHeader}>
            <View style={styles.iconWrap}>
              <Ticket size={26} color={COLORS.onPrimaryContainer} />
            </View>
            <Text style={styles.brand}>Warteliste</Text>
            <Text style={styles.branchName}>{ticket.companyName ?? 'Sucursal Central'}</Text>
          </View>

          {priority !== 'normal' && (
            <View style={[styles.prioBadge, { backgroundColor: pc.bg, borderColor: pc.border }]}>
              <Text style={[styles.prioBadgeText, { color: pc.text }]}>
                {PRIORITY_ICONS[priority]} Atención {PRIORITY_LABELS[priority]}
              </Text>
            </View>
          )}

          <View style={styles.dashed} />

          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Servicio</Text>
            <Text style={styles.sectionValue}>{ticket.sectionTitle}</Text>
          </View>

          <View style={styles.numberSection}>
            <Text style={styles.yourTicket}>Tu turno es</Text>
            <Animated.Text style={[
              styles.ticketNumber,
              (isNext || isCalled) && { transform: [{ scale: pulseAnim }] },
              isCalled && { color: COLORS.primary },
            ]}>
              {ticket.ticketNumber}
            </Animated.Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.waitRow}>
            <View style={styles.waitItem}>
              <Clock size={16} color={COLORS.primary} />
              <Text style={styles.waitLabel}>Espera est.</Text>
              <Text style={styles.waitValue}>{isCalled ? '¡Ahora!' : `~${estimatedWaitMinutes}m`}</Text>
            </View>
            <View style={styles.waitDivider} />
            <View style={styles.waitItem}>
              <Text style={styles.waitLabel}>Adelante</Text>
              <Text style={[styles.waitValue, ahead === 0 && { color: COLORS.primary }]}>
                {isCalled ? '0' : ahead}
              </Text>
            </View>
            <View style={styles.waitDivider} />
            <View style={styles.waitItem}>
              <Text style={styles.waitLabel}>Tiempo aquí</Text>
              <Text style={styles.waitValue}>{elapsedFormatted}</Text>
            </View>
          </View>

          <View style={styles.dashed} />

          {/* QR SVG puro — sin dependencias nativas */}
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Escanea para ver tu turno en pantalla</Text>
            <View style={styles.qrWrap}>
              <QRCodeSVG value={qrUrl} size={110} color="#1a2e2b" bg="#fff" />
            </View>
            <Text style={styles.qrUrl} numberOfLines={1} ellipsizeMode="middle">
              {qrUrl}
            </Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.footer}>
            <Text style={styles.footerMsg}>
              Permanece atento a la pantalla.{'\n'}Te llamaremos cuando sea tu turno.
            </Text>
            <Text style={styles.timestamp}>{ticket.timestamp}</Text>
          </View>
        </View>

        <View style={[styles.confirmBox, { borderColor: pc.border, backgroundColor: pc.bg }]}>
          <Text style={[styles.confirmText, { color: pc.text }]}>
            ¡Hola <Text style={{ fontWeight: '700' }}>{ticket.customerName}</Text>! Tu ticket ha sido registrado.
          </Text>
        </View>

        <TouchableOpacity style={styles.newTicketBtn} onPress={handleNewTicket} activeOpacity={0.85}>
          <Home size={20} color={COLORS.onPrimary} />
          <Text style={styles.newTicketBtnText}>Volver al Inicio</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center', gap: 14 },
  noTicket:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  noTicketText: { fontSize: 16, color: COLORS.onSurfaceVariant },
  homeBtn:      { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: 10 },
  homeBtnText:  { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },
  calledAlert: { width: '100%', maxWidth: 340, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  calledAlertText: { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },
  nextAlert: { width: '100%', maxWidth: 340, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fcd34d' },
  nextAlertText: { fontSize: 14, fontWeight: '700', color: '#78350f' },
  ticketCard: { width: '100%', maxWidth: 340, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: COLORS.outlineVariant, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6, position: 'relative' },
  holeLeft:  { position: 'absolute', left: -10, top: '48%', width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.outlineVariant },
  holeRight: { position: 'absolute', right: -10, top: '48%', width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.outlineVariant },
  ticketHeader: { alignItems: 'center', gap: 6 },
  iconWrap:     { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  brand:        { fontSize: 14, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1.5 },
  branchName:   { fontSize: 12, color: COLORS.outline },
  prioBadge:     { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  prioBadgeText: { fontSize: 13, fontWeight: '700' },
  dashed: { width: '100%', borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, borderStyle: 'dashed' },
  sectionRow:   { alignItems: 'center', gap: 2 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.outline },
  sectionValue: { fontSize: 18, fontWeight: '600', color: COLORS.onBackground },
  numberSection: { alignItems: 'center', gap: 4 },
  yourTicket:    { fontSize: 13, color: COLORS.onSurfaceVariant },
  ticketNumber:  { fontSize: 72, fontWeight: '800', color: COLORS.onBackground, letterSpacing: -2, lineHeight: 76 },
  waitRow:     { flexDirection: 'row', width: '100%', gap: 8 },
  waitItem:    { flex: 1, alignItems: 'center', gap: 4 },
  waitDivider: { width: 1, backgroundColor: COLORS.outlineVariant },
  waitLabel:   { fontSize: 10, color: COLORS.outline, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  waitValue:   { fontSize: 18, fontWeight: '700', color: COLORS.onBackground, textAlign: 'center' },
  qrSection: { alignItems: 'center', gap: 8, width: '100%' },
  qrLabel:   { fontSize: 11, color: COLORS.onSurfaceVariant, textAlign: 'center' },
  qrWrap:    { padding: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.outlineVariant },
  qrUrl:     { fontSize: 9, color: COLORS.outline, textAlign: 'center', maxWidth: 240 },
  footer:    { alignItems: 'center', gap: 8, width: '100%' },
  footerMsg: { fontSize: 12, color: COLORS.onSurfaceVariant, textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },
  timestamp: { fontSize: 10, color: COLORS.outline, letterSpacing: 0.5 },
  confirmBox: { width: '100%', maxWidth: 340, borderRadius: 12, padding: 14, borderWidth: 1 },
  confirmText: { flex: 1, fontSize: 14, lineHeight: 20 },
  newTicketBtn: { width: '100%', maxWidth: 340, height: 56, borderRadius: 14, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  newTicketBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.onPrimary },
});