import { Text, View } from '@/components/Themed';
import { FeedbackMode, useApp } from '@/context/AppContext';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function NewSessionScreen() {
  const { addParticipant, participants, addSession } = useApp();
  const [age, setAge] = useState('');
  const [vision, setVision] = useState<'blind' | 'low_vision' | 'sighted_control' | undefined>();
  const [mode, setMode] = useState<FeedbackMode>('audio');

  const canSave = useMemo(() => age.length > 0 && vision, [age, vision]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Session</Text>
      <Text style={styles.label}>Age</Text>
      <TextInput keyboardType="number-pad" value={age} onChangeText={setAge} style={styles.input} accessibilityLabel="Participant age" />
      <Text style={styles.label}>Vision Status</Text>
      <View style={styles.row}>
        {(['blind', 'low_vision', 'sighted_control'] as const).map((v) => (
          <Chip key={v} text={v.replace('_', ' ')} selected={vision === v} onPress={() => setVision(v)} />
        ))}
      </View>
      <Text style={styles.label}>Feedback Mode</Text>
      <View style={styles.row}>
        {(['audio', 'static_haptic', 'dynamic_haptic'] as const).map((m) => (
          <Chip key={m} text={m.replace('_', ' ')} selected={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>
      <Button
        text="Save Session"
        disabled={!canSave}
        onPress={() => {
          const p = addParticipant({ age: Number(age), visionStatus: vision });
          addSession({ participantId: p.participantId, feedbackMode: mode, stage: 'red_dot' });
          alert('Session created');
        }}
      />
    </View>
  );
}

function Chip({ text, selected, onPress }: { text: string; selected?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="button" accessibilityLabel={text}>
      <Text style={selected ? styles.chipTextSelected : styles.chipText}>{text}</Text>
    </TouchableOpacity>
  );
}

function Button({ text, onPress, disabled }: { text: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.button, disabled && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={text}>
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
  },
  label: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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
    marginTop: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});


