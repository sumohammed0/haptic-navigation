import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';

export default function CalibrationModal() {
  const router = useRouter();
  const { updateSettings } = useApp();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [samples, setSamples] = useState<number[]>([]);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastSpokenRef = useRef<number>(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    // Announce instructions for accessibility
    Speech.speak('Compass calibration. Move your phone in a figure eight until calibration completes. You will hear a confirmation when done.', { rate: 0.95 });
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') return;
      subRef.current = await Location.watchHeadingAsync((h) => {
        const heading = (h.trueHeading ?? h.magHeading ?? 0) as number;
        setSamples((prev) => {
          const next = [...prev, heading];
          // keep last ~5 seconds at 10Hz assumption
          return next.slice(-50);
        });
      });
    })();
    return () => {
      if (subRef.current) subRef.current.remove();
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (samples.length < 20) return;
    // Compute range over full window and over last 1s
    const range = angleRange(samples);
    const recent = samples.slice(-10);
    const recentRange = angleRange(recent);
    // Heuristic: user has moved enough and heading has stabilized recently
    const movedEnough = range > 90;
    const stabilized = recentRange < 8;
    const now = Date.now();
    if (movedEnough && stabilized) {
      if (now - lastSpokenRef.current > 1000) {
        Speech.speak('Calibration complete', { rate: 1.0 });
        lastSpokenRef.current = now;
      }
      // Small delay so announcement is heard
      setTimeout(() => {
        updateSettings({ hasCalibrated: true });
        router.replace('/(tabs)');
      }, 800);
    }
  }, [samples]);

  // Fallback: if permissions denied or no stabilization after 15s, skip gracefully
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed > 15000) {
        Speech.speak('Skipping calibration', { rate: 1.0 });
        updateSettings({ hasCalibrated: true });
        router.replace('/(tabs)');
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.container} accessibilityViewIsModal accessibilityLabel="Compass calibration">
      <Text style={styles.title} accessibilityRole="header">Compass Calibration</Text>
      <Text style={styles.body} accessibilityLabel="Instructions">
        Move your phone in a gentle figure-eight motion until calibration completes automatically.
      </Text>
      <Text style={styles.bodySmall}>Permission: {permission}</Text>
      <View style={{ height: 16 }} />
      <TouchableOpacity
        onPress={() => Speech.speak('Move your phone in a figure eight until calibration completes.')}
        accessibilityRole="button"
        accessibilityLabel="Repeat instructions"
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>Repeat Instructions</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { updateSettings({ hasCalibrated: true }); router.back(); }}
        accessibilityRole="button"
        accessibilityLabel="Skip calibration"
        style={styles.secondaryBtn}
      >
        <Text style={styles.secondaryBtnText}>Skip</Text>
      </TouchableOpacity>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

function angleRange(values: number[]): number {
  // Handle wrap-around by converting to unit vectors and measuring spread
  const radians = values.map((d) => (d * Math.PI) / 180);
  const xs = radians.map((r) => Math.cos(r));
  const ys = radians.map((r) => Math.sin(r));
  const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
  // Angular deviation as 2*arcsin of chord length approx; simpler: compute min/max angle relative to mean
  const mean = Math.atan2(avgY, avgX);
  const deviations = radians.map((r) => normalizeAngle(r - mean));
  const min = Math.min(...deviations);
  const max = Math.max(...deviations);
  return ((max - min) * 180) / Math.PI;
}

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    fontSize: 18,
    lineHeight: 26,
  },
  bodySmall: {
    fontSize: 14,
    opacity: 0.8,
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
