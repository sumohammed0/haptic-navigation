import { Text, View } from '@/components/Themed';
import { FeedbackMode, useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function ResearcherScreen() {
  const router = useRouter();
  const { participants, sessions, exportCsv } = useApp();
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | undefined>(participants[0]?.participantId);
  const [mode, setMode] = useState<FeedbackMode>('audio');

  const inProgress = useMemo(() => sessions.filter((s) => !s.endTime), [sessions]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation Study Control Panel</Text>
      <View style={styles.block}>
        <Text style={styles.label}>Participant</Text>
        <View style={styles.row}>
          {participants.length === 0 ? (
            <Text>No participants. Create one.</Text>
          ) : (
            <Text>{selectedParticipantId ?? 'Select'}</Text>
          )}
          <Button onPress={() => router.push('/session/new')} text="New Session" />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Feedback Mode</Text>
        <View style={styles.row}>
          <ModeButton current={mode} value="audio" onSelect={setMode} />
          <ModeButton current={mode} value="static_haptic" onSelect={setMode} />
          <ModeButton current={mode} value="dynamic_haptic" onSelect={setMode} />
        </View>
      </View>

      <View style={styles.block}>
        <Button onPress={() => router.push('/stages/red-dot')} text="Start Red Dot Task" />
        <View style={{ height: 8 }} />
        <Button onPress={() => router.push('/break')} text="Start 5-Min Break" />
        <View style={{ height: 8 }} />
        <Button onPress={() => router.push('/stages/object-search')} text="Start Object Search" />
      </View>

      <View style={styles.block}>
        <Button
          onPress={async () => {
            const csv = await exportCsv();
            console.log(csv);
            alert('CSV generated in console output');
          }}
          text="Export CSV"
        />
      </View>
    </View>
  );
}

function ModeButton({ current, value, onSelect }: { current: FeedbackMode; value: FeedbackMode; onSelect: (m: FeedbackMode) => void }) {
  const selected = current === value;
  return (
    <TouchableOpacity onPress={() => onSelect(value)} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="button" accessibilityLabel={`Select ${value} mode`}>
      <Text style={selected ? styles.chipTextSelected : styles.chipText}>{value.replace('_', ' ')}</Text>
    </TouchableOpacity>
  );
}

function Button({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button} accessibilityRole="button" accessibilityLabel={text}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
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
  block: {
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 14,
  },
  chipTextSelected: {
    color: 'white',
    fontSize: 14,
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


