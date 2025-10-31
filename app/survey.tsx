import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function SurveyScreen() {
  const { addSurvey, sessions } = useApp();
  const [ease, setEase] = useState(3);
  const [clarity, setClarity] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [feedback, setFeedback] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Post-Task Survey</Text>
      <SliderRow label="Ease of use" value={ease} onChange={setEase} />
      <SliderRow label="Clarity of guidance" value={clarity} onChange={setClarity} />
      <SliderRow label="Spatial confidence" value={confidence} onChange={setConfidence} />
      <Text accessibilityRole="header" style={{ marginTop: 12 }}>Additional comments</Text>
      <TextInput
        accessibilityLabel="Additional comments"
        style={styles.input}
        multiline
        value={feedback}
        onChangeText={setFeedback}
        placeholder="Type here"
      />
      <Button
        text="Submit Survey"
        onPress={() => {
          const sessionId = sessions[sessions.length - 1]?.sessionId;
          if (!sessionId) return alert('No session found');
          addSurvey({ sessionId, easeOfUse: ease, clarityOfGuidance: clarity, spatialConfidence: confidence, feedbackText: feedback });
          alert('Survey saved');
        }}
      />
    </View>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.row}>
      <Text style={{ width: 160 }}>{label}</Text>
      <View style={styles.scale}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} accessibilityRole="button" accessibilityLabel={`${label} ${n}`} onPress={() => onChange(n)} style={[styles.scaleItem, value === n && styles.scaleItemSelected]}>
            <Text style={value === n ? styles.scaleTextSelected : undefined}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scale: {
    flexDirection: 'row',
    gap: 6,
  },
  scaleItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleItemSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  scaleTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 100,
    padding: 8,
  },
  button: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});


