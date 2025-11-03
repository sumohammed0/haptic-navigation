/**
 * Red Dot Task Screen
 * 
 * Task: User locates red dots on walls while following navigation directions.
 * 
 * Integration:
 * - Works with all navigation modes (audio, static haptic, dynamic haptic)
 * - Navigation guides user through waypoints automatically
 * - Researcher controls task start/stop and logs checkpoints/errors
 * - User is blindfolded - no interaction required on this screen
 * 
 * Workflow:
 * 1. Researcher starts navigation from control panel
 * 2. User follows navigation to waypoints
 * 3. User locates red dots on walls during navigation
 * 4. Researcher logs checkpoints and errors as needed
 * 5. Task can be ended when complete
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';

export default function RedDotStage() {
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
  const [checkpoints, setCheckpoints] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
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
        (s) => !s.endTime && s.stage === 'red_dot'
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

  // Reset when navigation stops
  useEffect(() => {
    if (!navigationState.isActive && startTime) {
      // Navigation stopped - optionally keep timer running or stop it
      // For now, keep timer running until task is explicitly ended
    }
  }, [navigationState.isActive, startTime]);

  const handleLogCheckpoint = () => {
    const now = Date.now();
    setCheckpoints([...checkpoints, now]);
    
    if (currentSessionRef.current) {
      // Update session with checkpoint info (could store in session data structure)
      // For now, just log it
      console.log('Checkpoint logged at', new Date(now).toISOString());
    }
    
    Alert.alert('Checkpoint Logged', `Checkpoint ${checkpoints.length + 1} recorded.`);
  };

  const handleLogError = () => {
    const newErrorCount = errors + 1;
    setErrors(newErrorCount);
    
    if (currentSessionRef.current) {
      updateSession(currentSessionRef.current, {
        navigationErrors: newErrorCount,
      });
    }
    
    Alert.alert('Error Logged', `Navigation error ${newErrorCount} recorded.`);
  };

  const handleEndTask = () => {
    if (!startTime) {
      Alert.alert('No Task Active', 'No task is currently running.');
      return;
    }

    const completionTime = Math.floor((Date.now() - startTime) / 1000);
    
    Alert.alert(
      'End Task?',
      `End the Red Dot task?\n\nCompletion time: ${formatSeconds(completionTime)}\nCheckpoints: ${checkpoints.length}\nErrors: ${errors}`,
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
                completionStatus: 'completed',
                completionTimeSeconds: completionTime,
                navigationErrors: errors,
              });
            }

            // Reset state
            setStartTime(undefined);
            setElapsed(0);
            setCheckpoints([]);
            setErrors(0);
            currentSessionRef.current = null;

            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }

            Alert.alert('Task Ended', 'The Red Dot task has been completed.');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Red Dot Task</Text>
      
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
          {'\n'}• User locates red dots on walls during navigation
          {'\n'}• Log checkpoints when user reaches key points
          {'\n'}• Log errors if user makes navigation mistakes
          {'\n'}• End task when user completes the route
        </Text>
      </View>

      {/* Researcher Controls */}
      <View style={styles.controlsSection}>
        <Button
          text={`Log Checkpoint (${checkpoints.length})`}
          onPress={handleLogCheckpoint}
          disabled={!startTime}
        />
        <View style={{ height: 8 }} />
        <Button
          text={`Log Error (${errors})`}
          onPress={handleLogError}
          disabled={!startTime}
        />
        <View style={{ height: 8 }} />
        <Button
          text="End Task"
          onPress={handleEndTask}
          disabled={!startTime}
          variant="danger"
        />
      </View>

      {/* Task Statistics */}
      {startTime && (
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>Task Statistics</Text>
          <Text style={styles.statsText}>Checkpoints: {checkpoints.length}</Text>
          <Text style={styles.statsText}>Navigation Errors: {errors}</Text>
          <Text style={styles.statsText}>
            Average Time per Checkpoint:{' '}
            {checkpoints.length > 0
              ? formatSeconds(Math.floor(elapsed / checkpoints.length))
              : 'N/A'}
          </Text>
        </View>
      )}

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
  statsSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
});
