/**
 * Object Search Task Screen
 * 
 * Task: User finds a specific object and places it somewhere else while following navigation.
 * 
 * Integration:
 * - Works with all navigation modes (audio, static haptic, dynamic haptic)
 * - Navigation guides user through waypoints automatically
 * - Researcher controls task start/stop and logs object found status
 * - User is blindfolded - no interaction required on this screen
 * 
 * Workflow:
 * 1. Researcher starts navigation from control panel
 * 2. User follows navigation to waypoints
 * 3. User locates target object during navigation
 * 4. Researcher logs when object is found
 * 5. User places object at target location
 * 6. Task can be ended when complete
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';

export default function ObjectSearchStage() {
  const router = useRouter();
  const {
    navigationState,
    sessions,
    addSession,
    updateSession,
    stopNavigation,
  } = useApp();
  
  const [startTime, setStartTime] = useState<number | undefined>();
  const [elapsed, setElapsed] = useState(0);
  const [objectFound, setObjectFound] = useState(false);
  const [objectFoundTime, setObjectFoundTime] = useState<number | undefined>();
  const [objectPlaced, setObjectPlaced] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  // Auto-start timer when navigation begins
  useEffect(() => {
    if (navigationState.isActive && !startTime) {
      // Navigation just started - start task timer
      const now = Date.now();
      setStartTime(now);
      
      // Find or create session
      const inProgressSession = sessions.find(
        (s) => !s.endTime && s.stage === 'object_search'
      );
      if (inProgressSession) {
        currentSessionRef.current = inProgressSession.sessionId;
        updateSession(inProgressSession.sessionId, { startTime: now });
      }
    }
  }, [navigationState.isActive, startTime, sessions, updateSession]);

  // Update elapsed time
  useEffect(() => {
    if (startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 500);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [startTime]);

  const handleMarkObjectFound = () => {
    if (objectFound) {
      Alert.alert('Already Logged', 'Object found status has already been logged.');
      return;
    }

    const now = Date.now();
    const searchDuration = startTime ? Math.floor((now - startTime) / 1000) : 0;
    
    setObjectFound(true);
    setObjectFoundTime(now);

    if (currentSessionRef.current) {
      updateSession(currentSessionRef.current, {
        objectFound: true,
        searchDurationSeconds: searchDuration,
      });
    }

    Alert.alert(
      'Object Found',
      `Object found after ${formatSeconds(searchDuration)}.\nUser can now place the object.`
    );
  };

  const handleMarkObjectPlaced = () => {
    if (!objectFound) {
      Alert.alert('Object Not Found', 'Please mark object as found first.');
      return;
    }

    if (objectPlaced) {
      Alert.alert('Already Logged', 'Object placement has already been logged.');
      return;
    }

    setObjectPlaced(true);
    Alert.alert('Object Placed', 'Object placement has been logged.');
  };

  const handleEndTask = () => {
    if (!startTime) {
      Alert.alert('No Task Active', 'No task is currently running.');
      return;
    }

    const completionTime = Math.floor((Date.now() - startTime) / 1000);
    const searchDuration = objectFoundTime && startTime
      ? Math.floor((objectFoundTime - startTime) / 1000)
      : undefined;

    Alert.alert(
      'End Task?',
      `End the Object Search task?\n\nCompletion time: ${formatSeconds(completionTime)}\nObject found: ${objectFound ? 'Yes' : 'No'}${
        searchDuration ? `\nSearch duration: ${formatSeconds(searchDuration)}` : ''
      }\nObject placed: ${objectPlaced ? 'Yes' : 'No'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Task',
          style: 'destructive',
          onPress: () => {
            // Stop navigation
            stopNavigation();

            // Update session
            if (currentSessionRef.current) {
              updateSession(currentSessionRef.current, {
                endTime: Date.now(),
                completionStatus: objectFound && objectPlaced ? 'completed' : 'incomplete',
                completionTimeSeconds: completionTime,
                objectFound,
                searchDurationSeconds: searchDuration,
              });
            }

            // Reset state
            setStartTime(undefined);
            setElapsed(0);
            setObjectFound(false);
            setObjectFoundTime(undefined);
            setObjectPlaced(false);
            currentSessionRef.current = null;

            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }

            Alert.alert('Task Ended', 'The Object Search task has been completed.');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Object Search Task</Text>
      
      {/* Task Status */}
      <View style={styles.statusSection}>
        <Text style={styles.statusLabel}>
          {startTime ? 'Task In Progress' : 'Waiting for Navigation to Start'}
        </Text>
        <Text style={styles.elapsedTime}>Elapsed Time: {formatSeconds(elapsed)}</Text>
        {navigationState.isActive && (
          <View style={styles.navigationInfo}>
            <Text style={styles.infoText}>
              Navigation Active ({navigationState.feedbackMode?.replace('_', ' ')})
            </Text>
            <Text style={styles.infoText}>
              Waypoint: {navigationState.currentWaypointIndex + 1}
            </Text>
          </View>
        )}
      </View>

      {/* Task Instructions for Researcher */}
      <View style={styles.instructionSection}>
        <Text style={styles.instructionTitle}>Instructions</Text>
        <Text style={styles.instructionText}>
          • User is blindfolded and will follow navigation automatically
          {'\n'}• Navigation guides user through waypoints step by step
          {'\n'}• User searches for target object during navigation
          {'\n'}• Mark when user finds the object
          {'\n'}• Mark when user places the object at target location
          {'\n'}• End task when complete
        </Text>
      </View>

      {/* Task Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>Task Progress</Text>
        <View style={styles.progressItem}>
          <Text style={styles.progressLabel}>Object Found:</Text>
          <Text
            style={[
              styles.progressValue,
              objectFound && styles.progressValueComplete,
            ]}
          >
            {objectFound ? '✓ Yes' : '✗ No'}
          </Text>
          {objectFoundTime && startTime && (
            <Text style={styles.progressTime}>
              Found after {formatSeconds(Math.floor((objectFoundTime - startTime) / 1000))}
            </Text>
          )}
        </View>
        <View style={styles.progressItem}>
          <Text style={styles.progressLabel}>Object Placed:</Text>
          <Text
            style={[
              styles.progressValue,
              objectPlaced && styles.progressValueComplete,
            ]}
          >
            {objectPlaced ? '✓ Yes' : '✗ No'}
          </Text>
        </View>
      </View>

      {/* Researcher Controls */}
      <View style={styles.controlsSection}>
        <Button
          text={objectFound ? 'Object Found ✓' : 'Mark Object Found'}
          onPress={handleMarkObjectFound}
          disabled={!startTime || objectFound}
          variant={objectFound ? 'success' : 'primary'}
        />
        <View style={{ height: 8 }} />
        <Button
          text={objectPlaced ? 'Object Placed ✓' : 'Mark Object Placed'}
          onPress={handleMarkObjectPlaced}
          disabled={!startTime || !objectFound || objectPlaced}
          variant={objectPlaced ? 'success' : 'primary'}
        />
        <View style={{ height: 8 }} />
        <Button
          text="End Task"
          onPress={handleEndTask}
          disabled={!startTime}
          variant="danger"
        />
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
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
  variant?: 'primary' | 'danger' | 'success';
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === 'danger' && styles.buttonDanger,
        variant === 'success' && styles.buttonSuccess,
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

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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
  statusSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  elapsedTime: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  navigationInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  instructionSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  progressSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressItem: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
    color: '#ef4444',
  },
  progressValueComplete: {
    color: '#10b981',
  },
  progressTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  controlsSection: {
    marginBottom: 16,
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
  buttonSuccess: {
    backgroundColor: '#10b981',
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
});
