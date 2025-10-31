import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function RedDotStage() {
  const { addSession } = useApp();
  const [start, setStart] = useState<number | undefined>();
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (start) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [start]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Red Dot Navigation</Text>
      <Text>Elapsed Time: {formatSeconds(elapsed)}</Text>
      <View style={{ height: 16 }} />
      <Button text={start ? 'Running…' : 'Start Task'} onPress={() => setStart(Date.now())} disabled={!!start} />
      <View style={{ height: 8 }} />
      <Button text="Checkpoint Reached" onPress={() => { /* log checkpoint stub */ }} />
      <View style={{ height: 8 }} />
      <Button text="Log Error" onPress={() => { /* log error stub */ }} />
      <View style={{ height: 8 }} />
      <Button text="End Task" onPress={() => setStart(undefined)} />
    </View>
  );
}

function Button({ text, onPress, disabled }: { text: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.button, disabled && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={text}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
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
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});


