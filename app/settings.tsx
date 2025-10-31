import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, TextInput, TouchableOpacity } from 'react-native';

export default function SettingsScreen() {
  const { settings, updateSettings } = useApp();
  const thresholdOptions = useMemo(() => [3, 5, 10, 15, 20, 30], []);
  const [latInput, setLatInput] = useState<string>(settings.targetLat != null ? String(settings.targetLat) : '');
  const [lonInput, setLonInput] = useState<string>(settings.targetLon != null ? String(settings.targetLon) : '');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Experiment Settings</Text>

      <View style={styles.rowBetween}>
        <Text>Use True North</Text>
        <Switch
          accessibilityLabel="Use true north"
          value={settings.useTrueNorth}
          onValueChange={(v) => updateSettings({ useTrueNorth: v })}
        />
      </View>

      <Text style={styles.label}>Alignment Threshold (degrees)</Text>
      <View style={styles.chipsRow}>
        {thresholdOptions.map((deg) => (
          <Chip
            key={deg}
            text={`${deg}°`}
            selected={settings.alignThresholdDeg === deg}
            onPress={() => updateSettings({ alignThresholdDeg: deg })}
          />
        ))}
      </View>

      <Text style={styles.label}>Target Coordinates</Text>
      <View style={{ gap: 8 }}>
        <Text>Latitude</Text>
        <TextInput
          style={styles.input}
          keyboardType="numbers-and-punctuation"
          placeholder="e.g., 37.7749"
          placeholderTextColor="#9CA3AF"
          value={latInput}
          onChangeText={setLatInput}
          onBlur={() => {
            const v = Number(latInput);
            if (!Number.isNaN(v)) updateSettings({ targetLat: v });
          }}
        />
        <Text>Longitude</Text>
        <TextInput
          style={styles.input}
          keyboardType="numbers-and-punctuation"
          placeholder="e.g., -122.4194"
          placeholderTextColor="#9CA3AF"
          value={lonInput}
          onChangeText={setLonInput}
          onBlur={() => {
            const v = Number(lonInput);
            if (!Number.isNaN(v)) updateSettings({ targetLon: v });
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Set target to current location"
          onPress={async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setLatInput(String(pos.coords.latitude));
            setLonInput(String(pos.coords.longitude));
            updateSettings({ targetLat: pos.coords.latitude, targetLon: pos.coords.longitude });
          }}
          style={[styles.chip, styles.primaryBtn]}
        >
          <Text style={styles.primaryBtnText}>Use Current Location</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ marginTop: 16 }}>Tip: Move the phone in a figure-eight to recalibrate the compass.</Text>
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
    marginTop: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
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
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '600',
  },
});


