import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Vibration } from 'react-native';

export default function HapticDynamicNorthScreen() {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headingRef = useRef<number | null>(null);
  const { settings } = useApp();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') return;
      const sub = await Location.watchHeadingAsync((h) => {
        const value = settings.useTrueNorth ? (h.trueHeading ?? h.magHeading ?? 0) : (h.magHeading ?? h.trueHeading ?? 0);
        headingRef.current = value;
        setHeading(value);
      });
      return () => sub.remove();
    })();
  }, [isFocused, settings.useTrueNorth]);

  const lastPulseRef = useRef<number>(0);
  const vibratingRef = useRef<boolean>(false);
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isFocused) {
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      const h = headingRef.current;
      if (h == null) return;
      if (settings.targetLat == null || settings.targetLon == null) return;
      (async () => {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const targetBearing = bearingFromAToB(
          pos.coords.latitude,
          pos.coords.longitude,
          settings.targetLat as number,
          settings.targetLon as number
        );
        const angleErr = normalizeAngleDiff(h, targetBearing); // + => turn right, - => left
        const absErr = Math.abs(angleErr);
        const threshold = settings.alignThresholdDeg ?? 10;

        // When aligned: continuous vibration like static haptic screen
        if (absErr <= threshold) {
          if (!vibratingRef.current) {
            Vibration.vibrate([0, 200, 50], true);
            vibratingRef.current = true;
          }
          return;
        }

        // Not aligned: ensure continuous vibration is off
        if (vibratingRef.current) {
          Vibration.cancel();
          vibratingRef.current = false;
        }

        // Direction-coded pulsing: double pulse if need to turn right, single pulse if left
        // Closer => smaller interval (higher frequency)
        const frequencyMs = mapRange(absErr, 0, 180, 200, 1200);
        const style = absErr < 10 ? Haptics.ImpactFeedbackStyle.Heavy : absErr < 30 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
        const now = Date.now();
        if (now - lastPulseRef.current >= frequencyMs) {
          if (angleErr > 0) {
            // Right: double pulse
            Haptics.impactAsync(style);
            setTimeout(() => {
              Haptics.impactAsync(style);
            }, 120);
          } else {
            // Left: single pulse
            Haptics.impactAsync(style);
          }
          lastPulseRef.current = now;
        }
      })();
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
    };
  }, [isFocused, settings.alignThresholdDeg]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Haptic Dynamic: Face Target</Text>
      <Text>Heading: {heading?.toFixed(0) ?? '—'}°</Text>
      <Text>Closer to target → stronger and faster pulses.</Text>
      <Text>Permission: {permission}</Text>
      {settings.targetLat == null || settings.targetLon == null ? (
        <Text>Set a target in Settings to enable guidance.</Text>
      ) : null}
    </View>
  );
}

function normalizeAngleDiff(currentDeg: number, targetDeg: number): number {
  let diff = targetDeg - currentDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  const norm = (clamped - inMin) / (inMax - inMin);
  return outMin + norm * (outMax - outMin);
}

function bearingFromAToB(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});


