import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function AudioNorthScreen() {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const lastSpokenRef = useRef<number>(0);
  const { settings } = useApp();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      Speech.stop();
      setHeading(null);
      return;
    }
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') return;
      const sub = await Location.watchHeadingAsync((h) => {
        const value = settings.useTrueNorth ? (h.trueHeading ?? h.magHeading ?? 0) : (h.magHeading ?? h.trueHeading ?? 0);
        setHeading(value);
      });
      return () => sub.remove();
    })();
  }, [isFocused, settings.useTrueNorth]);

  useEffect(() => {
    if (!isFocused || heading == null) return;
    if (settings.targetLat == null || settings.targetLon == null) return;
    (async () => {
      const now = Date.now();
      if (now - lastSpokenRef.current < 2000) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const targetBearing = bearingFromAToB(
        pos.coords.latitude,
        pos.coords.longitude,
        settings.targetLat as number,
        settings.targetLon as number
      );
      const angleErr = normalizeAngleDiff(heading, targetBearing);
      const dir = angleErr > 0 ? 'right' : 'left';
      const deg = Math.abs(Math.round(angleErr));
      const ok = deg <= (settings.alignThresholdDeg ?? 5);
      if (ok) {
        Speech.speak('Facing target', { rate: 1.0 });
        lastSpokenRef.current = now;
      } else if (deg > (settings.alignThresholdDeg ?? 5) && deg <= 15) {
        Speech.speak(`Turn slightly ${dir}`, { rate: 1.0 });
        lastSpokenRef.current = now;
      } else {
        Speech.speak(`Turn ${dir} ${deg} degrees to face target`, { rate: 1.0 });
        lastSpokenRef.current = now;
      }
    })();
  }, [heading, settings.targetLat, settings.targetLon, settings.alignThresholdDeg, isFocused]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audio: Face Target</Text>
      <Text accessibilityLabel="Current heading">Heading: {heading?.toFixed(0) ?? '—'}°</Text>
      <Text>Permission: {permission}</Text>
      <View style={{ height: 16 }} />
      <Button text="Repeat instruction" onPress={() => Speech.speak('Face the target. Turn until you hear Facing target.')} />
      {settings.targetLat == null || settings.targetLon == null ? (
        <Text>Set a target in Settings to enable guidance.</Text>
      ) : null}
    </View>
  );
}

function Button({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button} accessibilityRole="button" accessibilityLabel={text}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
}

function normalizeAngleDiff(currentDeg: number, targetDeg: number): number {
  let diff = targetDeg - currentDeg; // positive => need to turn right (clockwise)
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
  button: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});


