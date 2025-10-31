import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Vibration } from 'react-native';

export default function HapticNorthScreen() {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headingRef = useRef<number | null>(null);
  const { settings } = useApp();
  const isFocused = useIsFocused();
  const wasWithinRef = useRef<boolean>(false);
  const vibratingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      wasWithinRef.current = false;
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
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

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isFocused) return;
    const threshold = settings.alignThresholdDeg ?? 10;
    intervalRef.current = setInterval(() => {
      const h = headingRef.current;
      if (h == null) return;
      if (settings.targetLat == null || settings.targetLon == null) return;
      // Compute target bearing from current position
      // Note: we sample position each tick; for battery, consider throttling.
      (async () => {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const targetBearing = bearingFromAToB(
          pos.coords.latitude,
          pos.coords.longitude,
          settings.targetLat as number,
          settings.targetLon as number
        );
        const err = Math.abs(normalizeAngleDiff(h, targetBearing));
        const within = err <= threshold;
        // Continuous vibration when aligned; stop when not aligned
        if (within && !vibratingRef.current) {
          Vibration.vibrate([0, 200, 50], true);
          vibratingRef.current = true;
        } else if (!within && vibratingRef.current) {
          Vibration.cancel();
          vibratingRef.current = false;
        }
        wasWithinRef.current = within;
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
      <Text style={styles.title}>Haptic: Face Target</Text>
      <Text>Heading: {heading?.toFixed(0) ?? '—'}°</Text>
      <Text>Continuous vibration while within {settings.alignThresholdDeg}° of the target; stops when you turn away.</Text>
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


