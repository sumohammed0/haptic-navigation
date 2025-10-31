import { Text, View } from '@/components/Themed';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

const FIVE_MIN = 5 * 60;

export default function BreakTimer() {
  const [remaining, setRemaining] = useState(FIVE_MIN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (remaining === 0) {
      // TODO: Notify researcher; for now, use alert
      alert('Break finished. Please return to the test area.');
    }
  }, [remaining]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Break</Text>
      <Text>Remaining: {formatSeconds(remaining)}</Text>
    </View>
  );
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});


