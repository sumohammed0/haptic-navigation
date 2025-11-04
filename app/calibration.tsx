/**
 * Indoor Navigation Calibration Screen
 * 
 * This screen is used by the researcher to create navigation routes by logging waypoints.
 * 
 * Calibration Process:
 * 1. Researcher creates a new route or selects an existing one
 * 2. Researcher walks to key spots in the navigation path
 * 3. At each spot, researcher presses "Log Point" and enters the direction instruction
 * 4. Directions are logged sequentially to create a step-by-step navigation route
 * 5. After calibration, the route can be used for navigation tasks
 * 
 * Usage:
 * - Route name: Descriptive name for this navigation path (e.g., "Red Dot Task Route A")
 * - Task type: Select which task this route is for (optional)
 * - Log Point: Walk to a key location, press this button, and enter the direction instruction
 * - Direction examples: "Go straight", "Turn left", "Turn right 90 degrees", "Turn around"
 */

import { Text, View } from '@/components/Themed';
import { useApp, NavigationWaypoint } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';

export default function CalibrationScreen() {
  const router = useRouter();
  const { addRoute, updateRoute, routes, getRoute } = useApp();
  const [routeName, setRouteName] = useState('');
  const [taskType, setTaskType] = useState<'red_dot' | 'object_search' | undefined>();
  const [currentRouteId, setCurrentRouteId] = useState<string | undefined>();
  const [waypoints, setWaypoints] = useState<NavigationWaypoint[]>([]);
  const [directionInput, setDirectionInput] = useState('');
  const [stepCountInput, setStepCountInput] = useState('');
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const headingRef = useRef<number | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);

  // Request location permissions and start heading updates
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      if (status === 'granted') {
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          headingRef.current = h.trueHeading ?? h.magHeading ?? null;
        });
      }
    })();
    return () => {
      if (headingSubRef.current) {
        headingSubRef.current.remove();
      }
    };
  }, []);

  // Load existing route if editing
  const handleLoadRoute = (routeId: string) => {
    const route = getRoute(routeId);
    if (route) {
      setCurrentRouteId(routeId);
      setRouteName(route.routeName);
      setTaskType(route.taskType);
      setWaypoints(route.waypoints.sort((a, b) => a.order - b.order));
    }
  };

  // Create or update route
  const handleSaveRoute = () => {
    if (!routeName.trim()) {
      Alert.alert('Error', 'Please enter a route name');
      return;
    }

    if (currentRouteId) {
      // Update existing route
      updateRoute(currentRouteId, {
        routeName,
        taskType,
        waypoints,
      });
      Alert.alert('Success', 'Route updated');
    } else {
      // Create new route
      const route = addRoute({
        routeName,
        taskType,
        waypoints,
      });
      setCurrentRouteId(route.routeId);
      Alert.alert('Success', 'Route created. You can now log waypoints.');
    }
  };

  // Log a waypoint at current location
  const handleLogPoint = async () => {
    if (!directionInput.trim()) {
      Alert.alert('Error', 'Please enter a direction instruction');
      return;
    }

    if (!currentRouteId) {
      Alert.alert('Error', 'Please create or load a route first');
      return;
    }

    if (locationPermission !== 'granted') {
      Alert.alert('Error', 'Location permission is required to log waypoints');
      return;
    }

    // Parse step count (optional, but recommended)
    const stepCount = stepCountInput.trim() ? parseInt(stepCountInput.trim(), 10) : undefined;
    if (stepCountInput.trim() && (stepCount === undefined || isNaN(stepCount) || stepCount < 0)) {
      Alert.alert('Error', 'Step count must be a positive number');
      return;
    }

    const newWaypoint: NavigationWaypoint = {
      waypointId: generateUuidV4(),
      order: waypoints.length,
      direction: directionInput.trim(),
      targetHeading: headingRef.current ?? undefined,
      stepCountToNext: stepCount,
      createdAt: Date.now(),
    };

    const updatedWaypoints = [...waypoints, newWaypoint];
    setWaypoints(updatedWaypoints);
    setDirectionInput('');
    setStepCountInput('');
    
    // Update route immediately
    updateRoute(currentRouteId, {
      waypoints: updatedWaypoints,
    });
  };

  // Delete a waypoint
  const handleDeleteWaypoint = (waypointId: string) => {
    const updated = waypoints
      .filter((w) => w.waypointId !== waypointId)
      .map((w, idx) => ({ ...w, order: idx }));
    setWaypoints(updated);
    if (currentRouteId) {
      updateRoute(currentRouteId, {
        waypoints: updated,
      });
    }
  };

  // Start new route
  const handleNewRoute = () => {
    setCurrentRouteId(undefined);
    setRouteName('');
    setTaskType(undefined);
    setWaypoints([]);
    setDirectionInput('');
    setStepCountInput('');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Indoor Navigation Calibration</Text>
      <Text style={styles.subtitle}>
        Create navigation routes by logging waypoints at key locations
      </Text>

      {/* Route Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Management</Text>
        
        <Text style={styles.label}>Route Name</Text>
        <TextInput
          style={styles.input}
          value={routeName}
          onChangeText={setRouteName}
          placeholder="e.g., Red Dot Task Route A"
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.label}>Task Type (Optional)</Text>
        <View style={styles.row}>
          {(['red_dot', 'object_search'] as const).map((task) => (
            <TouchableOpacity
              key={task}
              onPress={() => setTaskType(task === taskType ? undefined : task)}
              style={[styles.chip, taskType === task && styles.chipSelected]}
            >
              <Text style={taskType === task ? styles.chipTextSelected : styles.chipText}>
                {task.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.buttonRow}>
          <Button text="New Route" onPress={handleNewRoute} variant="secondary" />
          <Button text="Save Route" onPress={handleSaveRoute} />
        </View>

        {routes.length > 0 && (
          <>
            <Text style={styles.label}>Load Existing Route</Text>
            {routes.map((route) => (
              <TouchableOpacity
                key={route.routeId}
                onPress={() => handleLoadRoute(route.routeId)}
                style={[
                  styles.routeItem,
                  currentRouteId === route.routeId && styles.routeItemSelected,
                ]}
              >
                <Text style={styles.routeName}>{route.routeName}</Text>
                <Text style={styles.routeInfo}>
                  {route.waypoints.length} waypoints • {route.taskType ?? 'No task'}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Log Waypoint */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Log Waypoint</Text>
        <Text style={styles.instruction}>
          Walk to a key location in your navigation path. Press "Log Point" and enter the
          direction instruction the user should follow from this location.
        </Text>

        <Text style={styles.label}>Direction Instruction</Text>
        <TextInput
          style={styles.input}
          value={directionInput}
          onChangeText={setDirectionInput}
          placeholder='e.g., "Go straight", "Turn left", "Turn right 90 degrees"'
          placeholderTextColor="#9CA3AF"
          multiline
        />

        <Text style={styles.label}>Step Count to Next Point</Text>
        <Text style={[styles.instruction, { fontSize: 12, opacity: 0.7 }]}>
          Count the number of steps from this location to the next waypoint. The user will tap the screen once per step.
        </Text>
        <TextInput
          style={styles.input}
          value={stepCountInput}
          onChangeText={setStepCountInput}
          placeholder="e.g., 15"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
        />

        <Text style={styles.info}>
          Current heading: {headingRef.current?.toFixed(0) ?? '—'}° (optional - used for alignment-based navigation)
        </Text>
        <Text style={styles.instruction}>
          The heading will be automatically captured when you log the point. This is used to detect when the user is aligned with the correct direction.
        </Text>
        <Text style={styles.info}>
          Location permission: {locationPermission}
        </Text>

        <Button
          text="Log Point"
          onPress={handleLogPoint}
          disabled={!currentRouteId || locationPermission !== 'granted'}
        />
      </View>

      {/* Waypoints List */}
      {waypoints.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Waypoints ({waypoints.length})
          </Text>
          {waypoints.map((waypoint, idx) => (
            <View key={waypoint.waypointId} style={styles.waypointItem}>
              <View style={styles.waypointContent}>
                <Text style={styles.waypointOrder}>{idx + 1}</Text>
                <View style={styles.waypointInfo}>
                  <Text style={styles.waypointDirection}>{waypoint.direction}</Text>
                  {waypoint.targetHeading !== undefined && (
                    <Text style={styles.waypointHeading}>
                      Heading: {waypoint.targetHeading.toFixed(0)}°
                    </Text>
                  )}
                  {waypoint.stepCountToNext !== undefined && (
                    <Text style={styles.waypointHeading}>
                      Steps to next: {waypoint.stepCountToNext}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteWaypoint(waypoint.waypointId)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
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
  variant?: 'primary' | 'secondary';
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.buttonTextSecondary,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function generateUuidV4(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = Array.from(bytes, toHex).join('');
  return (
    hex.substring(0, 8) +
    '-' +
    hex.substring(8, 12) +
    '-' +
    hex.substring(12, 16) +
    '-' +
    hex.substring(16, 20) +
    '-' +
    hex.substring(20)
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  instruction: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
    minHeight: 44,
  },
  info: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonTextSecondary: {
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
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  waypointContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  waypointOrder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    color: 'white',
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '600',
    marginRight: 12,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointDirection: {
    fontWeight: '600',
    fontSize: 16,
  },
  waypointHeading: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontWeight: '600',
  },
});

