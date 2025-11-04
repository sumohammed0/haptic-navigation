/**
 * Researcher Control Panel Screen
 * 
 * This screen provides controls for the researcher to:
 * - Manage participants and sessions
 * - Select navigation routes
 * - Start navigation with specific feedback modes
 * - Control task execution (Red Dot, Object Search)
 * - Access calibration interface
 * 
 * Workflow:
 * 1. Create/select participant and session
 * 2. Create calibration route (navigate to calibration screen)
 * 3. Select feedback mode (audio, static haptic, dynamic haptic)
 * 4. Select route for the task
 * 5. Start task - navigation begins automatically
 * 6. After task completion, select next navigation mode and repeat
 */

import { Text, View } from '@/components/Themed';
import { FeedbackMode, useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function ResearcherScreen() {
  const router = useRouter();
  const {
    participants,
    sessions,
    routes,
    navigationState,
    startNavigation,
    stopNavigation,
    advanceToNextWaypoint,
    addSession,
    exportCsv,
  } = useApp();
  
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | undefined>(
    participants[0]?.participantId
  );
  const [selectedMode, setSelectedMode] = useState<FeedbackMode>('audio');
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(
    routes[0]?.routeId
  );

  const inProgress = useMemo(() => sessions.filter((s) => !s.endTime), [sessions]);

  // Routes filtered by task type for task-specific selection
  const routesForRedDot = useMemo(
    () => routes.filter((r) => !r.taskType || r.taskType === 'red_dot'),
    [routes]
  );
  const routesForObjectSearch = useMemo(
    () => routes.filter((r) => !r.taskType || r.taskType === 'object_search'),
    [routes]
  );

  const handleStartNavigation = (taskType: 'red_dot' | 'object_search') => {
    if (!selectedRouteId) {
      Alert.alert('Error', 'Please select a route first. Create one in Calibration.');
      return;
    }

    const selectedRoute = routes.find((r) => r.routeId === selectedRouteId);
    if (!selectedRoute || selectedRoute.waypoints.length === 0) {
      Alert.alert('Error', 'Selected route has no waypoints. Please create waypoints in Calibration.');
      return;
    }

    // Stop any existing navigation
    if (navigationState.isActive) {
      stopNavigation();
    }

    // Start navigation with selected mode
    startNavigation(selectedRouteId, selectedMode);

    // Create session if participant selected
    if (selectedParticipantId) {
      addSession({
        participantId: selectedParticipantId,
        feedbackMode: selectedMode,
        stage: taskType,
        routeId: selectedRouteId,
        startTime: Date.now(),
      });
    }

    // Navigate to appropriate screen based on mode
    switch (selectedMode) {
      case 'audio':
        router.push('/(tabs)/audio');
        break;
      case 'static_haptic':
        router.push('/(tabs)/haptic');
        break;
      case 'dynamic_haptic':
        router.push('/(tabs)/haptic-dynamic');
        break;
      case 'step_based':
        router.push('/(tabs)/step-navigation');
        break;
    }
  };

  const handleStopNavigation = () => {
    if (navigationState.isActive) {
      stopNavigation();
      Alert.alert('Navigation Stopped', 'Navigation has been stopped.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Navigation Study Control Panel</Text>

      {/* Participant Management */}
      <View style={styles.block}>
        <Text style={styles.label}>Participant</Text>
        <View style={styles.row}>
          {participants.length === 0 ? (
            <Text style={styles.info}>No participants. Create one.</Text>
          ) : (
            <Text style={styles.info}>
              {selectedParticipantId ?? 'Select participant'}
            </Text>
          )}
          <Button onPress={() => router.push('/session/new')} text="New Session" />
        </View>
      </View>

      {/* Calibration */}
      <View style={styles.block}>
        <Text style={styles.label}>Calibration</Text>
        <Text style={styles.info}>
          Create navigation routes by logging waypoints at key locations.
        </Text>
        <Button onPress={() => router.push('/calibration')} text="Open Calibration" />
      </View>

      {/* Route Selection */}
      <View style={styles.block}>
        <Text style={styles.label}>Navigation Route</Text>
        {routes.length === 0 ? (
          <Text style={styles.warning}>
            No routes available. Create a route in Calibration first.
          </Text>
        ) : (
          <>
            <Text style={styles.info}>Select route for navigation:</Text>
            {routes.map((route) => (
              <TouchableOpacity
                key={route.routeId}
                onPress={() => setSelectedRouteId(route.routeId)}
                style={[
                  styles.routeItem,
                  selectedRouteId === route.routeId && styles.routeItemSelected,
                ]}
              >
                <Text style={styles.routeName}>{route.routeName}</Text>
                <Text style={styles.routeInfo}>
                  {route.waypoints.length} waypoints • {route.taskType ?? 'Any task'}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Feedback Mode Selection */}
      <View style={styles.block}>
        <Text style={styles.label}>Feedback Mode</Text>
        <Text style={styles.info}>
          Select the navigation mode for the next task. The user will receive guidance via:
        </Text>
        <View style={styles.row}>
          <ModeButton
            current={selectedMode}
            value="audio"
            onSelect={setSelectedMode}
          />
          <ModeButton
            current={selectedMode}
            value="static_haptic"
            onSelect={setSelectedMode}
          />
          <ModeButton
            current={selectedMode}
            value="dynamic_haptic"
            onSelect={setSelectedMode}
          />
          <ModeButton
            current={selectedMode}
            value="step_based"
            onSelect={setSelectedMode}
          />
        </View>
      </View>

      {/* Navigation Status */}
      {navigationState.isActive && (
        <View style={[styles.block, styles.statusBlock]}>
          <Text style={styles.statusLabel}>Navigation Active</Text>
          <Text style={styles.statusText}>
            Mode: {navigationState.feedbackMode?.replace('_', ' ')}
            {'\n'}
            Target: {navigationState.currentWaypointIndex + 1}
            {'\n'}
            {'\n'}
            User can explore freely. Advance to next target when they reach the current one.
          </Text>
          <View style={styles.buttonRow}>
            <Button
              onPress={advanceToNextWaypoint}
              text="Advance to Next Target"
              variant="secondary"
            />
            <Button
              onPress={handleStopNavigation}
              text="Stop Navigation"
              variant="danger"
            />
          </View>
        </View>
      )}

      {/* Task Controls */}
      <View style={styles.block}>
        <Text style={styles.label}>Start Task</Text>
        <Text style={styles.info}>
          Select a task to start. Navigation will begin automatically with the selected mode.
        </Text>
        <Button
          onPress={() => handleStartNavigation('red_dot')}
          text="Start Red Dot Task"
          disabled={!selectedRouteId}
        />
        <View style={{ height: 8 }} />
        <Button
          onPress={() => handleStartNavigation('object_search')}
          text="Start Object Search Task"
          disabled={!selectedRouteId}
        />
        <View style={{ height: 8 }} />
        <Button onPress={() => router.push('/break')} text="Start 5-Min Break" />
      </View>

      {/* Data Export */}
      <View style={styles.block}>
        <Button
          onPress={async () => {
            const csv = await exportCsv();
            console.log(csv);
            Alert.alert('CSV Generated', 'CSV data has been logged to the console.');
          }}
          text="Export CSV"
        />
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function ModeButton({
  current,
  value,
  onSelect,
}: {
  current: FeedbackMode;
  value: FeedbackMode;
  onSelect: (m: FeedbackMode) => void;
}) {
  const selected = current === value;
  const descriptions: Record<FeedbackMode, string> = {
    audio: 'Audio directions',
    static_haptic: 'Fixed vibration patterns',
    dynamic_haptic: 'Variable vibration intensity',
    step_based: 'Tap-to-step with direction validation',
  };

  return (
    <TouchableOpacity
      onPress={() => onSelect(value)}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${value} mode`}
    >
      <Text style={selected ? styles.chipTextSelected : styles.chipText}>
        {value.replace('_', ' ')}
      </Text>
      <Text
        style={[
          styles.chipDescription,
          selected && styles.chipDescriptionSelected,
        ]}
      >
        {descriptions[value]}
      </Text>
    </TouchableOpacity>
  );
}

function Button({
  text,
  onPress,
  disabled,
  variant = 'primary',
}: {
  text: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger';
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'danger' && styles.buttonTextDanger,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  block: {
    borderRadius: 8,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
  },
  warning: {
    fontSize: 14,
    color: '#f59e0b',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  chipDescription: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
    textAlign: 'center',
  },
  chipDescriptionSelected: {
    color: 'white',
    opacity: 0.9,
  },
  button: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDanger: {
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonTextDanger: {
    color: 'white',
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
  routeItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  routeItemSelected: {
    backgroundColor: '#2563eb20',
    borderColor: '#2563eb',
  },
  routeName: {
    fontWeight: '600',
    fontSize: 16,
  },
  routeInfo: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  statusBlock: {
    backgroundColor: '#10b98120',
    borderColor: '#10b981',
  },
  statusLabel: {
    fontWeight: '600',
    fontSize: 16,
    color: '#10b981',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 12,
  },
});
