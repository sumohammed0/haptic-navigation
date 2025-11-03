/**
 * Audio Navigation Mode Screen
 * 
 * Provides step-by-step audio directions for indoor navigation.
 * Directions are given one after another as the user progresses through waypoints.
 * 
 * Features:
 * - Audio-only feedback with spoken directions
 * - Step-by-step guidance through waypoint sequence
 * - Alignment feedback when target heading is specified
 * - Automatic progression through waypoints
 * - No user interaction required (hands-free operation)
 * 
 * Usage:
 * - Researcher starts navigation from researcher screen
 * - User is blindfolded and handed the phone
 * - Audio cues guide user step by step automatically
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useIndoorNavigation } from '@/hooks/useIndoorNavigation';
import { useIsFocused } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';

export default function AudioNavigationScreen() {
  const { navigationState, settings } = useApp();
  const isFocused = useIsFocused();
  const alignment = useIndoorNavigation(settings.alignThresholdDeg);
  
  const lastSpokenRef = useRef<number>(0);
  const lastDirectionRef = useRef<string>('');
  const lastWaypointIndexRef = useRef<number>(-1);
  const isInitialWaypointRef = useRef<boolean>(true);

  // Stop speech when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      Speech.stop();
    }
    return () => {
      Speech.stop();
    };
  }, [isFocused]);

  // Reset initial waypoint flag when navigation starts
  useEffect(() => {
    if (navigationState.isActive && alignment.isActive) {
      if (lastWaypointIndexRef.current === -1) {
        // Navigation just started
        isInitialWaypointRef.current = true;
      }
    }
  }, [navigationState.isActive, alignment.isActive]);

  // Announce new waypoint directions when waypoint changes
  useEffect(() => {
    if (!navigationState.isActive || !alignment.isActive || !alignment.direction) {
      return;
    }

    const now = Date.now();
    const waypointChanged = alignment.waypointIndex !== lastWaypointIndexRef.current;

    // Announce waypoint instruction when it changes
    if (waypointChanged) {
      // Wait a moment if we just spoke something
      const delay = now - lastSpokenRef.current < 1000 ? 800 : 0;

      setTimeout(() => {
        let announcement: string;

        if (isInitialWaypointRef.current) {
          // First waypoint - just announce the direction
          announcement = alignment.isFinalWaypoint
            ? `${alignment.direction}.`
            : `${alignment.direction}. Continue until you reach the next turn point.`;
          isInitialWaypointRef.current = false;
        } else {
          // Subsequent waypoints - acknowledge turn point reached, then announce next direction
          if (alignment.isFinalWaypoint) {
            announcement = `You have reached a turn point. ${alignment.direction}.`;
          } else {
            announcement = `You have reached a turn point. Next direction: ${alignment.direction}. Continue until you reach the next turn point.`;
          }
        }

        Speech.speak(announcement, { rate: 0.9 });
        lastSpokenRef.current = Date.now();
        lastDirectionRef.current = alignment.direction;
        lastWaypointIndexRef.current = alignment.waypointIndex;
      }, delay);
    }
  }, [alignment.direction, alignment.waypointIndex, alignment.totalWaypoints, alignment.isFinalWaypoint, navigationState.isActive, alignment.isActive]);

  // Provide alignment feedback when heading is available
  useEffect(() => {
    if (!navigationState.isActive || !alignment.isActive || !alignment.targetHeading) {
      return;
    }

    // Don't provide alignment feedback immediately after waypoint announcement
    const now = Date.now();
    if (now - lastSpokenRef.current < 3000) {
      return;
    }

    // If aligned, confirm alignment periodically
    if (alignment.isAligned && alignment.absoluteError !== null) {
      if (alignment.absoluteError <= 5) {
        // Well aligned - confirm periodically (every 5 seconds)
        if (now - lastSpokenRef.current > 5000) {
          Speech.speak('You are facing the correct direction. Continue forward.', { rate: 0.9 });
          lastSpokenRef.current = now;
        }
      }
    } else if (alignment.alignmentError !== null && alignment.absoluteError !== null) {
      // Not aligned - provide correction feedback
      const deg = Math.round(alignment.absoluteError);
      const dir = alignment.alignmentError > 0 ? 'right' : 'left';
      
      // Provide feedback at intervals (every 3 seconds when misaligned)
      if (now - lastSpokenRef.current > 3000) {
        if (deg <= 15) {
          Speech.speak(`Turn slightly ${dir}`, { rate: 0.9 });
        } else if (deg <= 45) {
          Speech.speak(`Turn ${dir} ${deg} degrees`, { rate: 0.9 });
        } else {
          Speech.speak(`Turn ${dir} ${deg} degrees to face the correct direction`, { rate: 0.9 });
        }
        lastSpokenRef.current = now;
      }
    }
  }, [
    alignment.isAligned,
    alignment.alignmentError,
    alignment.absoluteError,
    alignment.targetHeading,
    navigationState.isActive,
    alignment.isActive,
  ]);

  // Announce navigation completion
  useEffect(() => {
    if (!navigationState.isActive && lastWaypointIndexRef.current >= 0) {
      // Navigation just ended - check if it was completed
      const wasActive = lastWaypointIndexRef.current >= 0;
      if (wasActive) {
        Speech.speak('You have reached your destination. Navigation complete.', { rate: 0.9 });
        lastWaypointIndexRef.current = -1;
        isInitialWaypointRef.current = true;
      }
    }
  }, [navigationState.isActive]);

  if (!navigationState.isActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Audio Navigation</Text>
        <Text style={styles.subtitle}>
          Waiting for navigation to start...
        </Text>
        <Text style={styles.info}>
          The researcher will start navigation from the control panel.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audio Navigation</Text>
      
      {alignment.isActive && (
        <>
          <View style={styles.statusSection}>
            <Text style={styles.statusText}>
              Step {alignment.waypointIndex + 1} of {alignment.totalWaypoints}
            </Text>
            <Text style={styles.directionText}>{alignment.direction}</Text>
          </View>

          {alignment.targetHeading !== null && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Current Heading:</Text>
              <Text style={styles.infoValue}>
                {alignment.currentHeading?.toFixed(0) ?? '—'}°
              </Text>
              <Text style={styles.infoLabel}>Target Heading:</Text>
              <Text style={styles.infoValue}>{alignment.targetHeading.toFixed(0)}°</Text>
              {alignment.alignmentError !== null && (
                <>
                  <Text style={styles.infoLabel}>Alignment Error:</Text>
                  <Text style={styles.infoValue}>
                    {alignment.alignmentError > 0 ? '+' : ''}
                    {alignment.alignmentError.toFixed(0)}°
                  </Text>
                  <Text style={styles.infoLabel}>Status:</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      alignment.isAligned && styles.statusBadgeAligned,
                    ]}
                  >
                    {alignment.isAligned ? 'Aligned ✓' : 'Not Aligned'}
                  </Text>
                </>
              )}
            </View>
          )}

          {alignment.isFinalWaypoint && (
            <Text style={styles.finalWaypointText}>Final waypoint</Text>
          )}
        </>
      )}

      {/* Hidden info for accessibility/debugging */}
      <Text style={styles.hidden} accessibilityLabel="Navigation status">
        {navigationState.isActive ? 'Navigation active' : 'Navigation inactive'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginTop: 16,
  },
  info: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
  statusSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#1a1a1a',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  directionText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  infoSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 8,
  },
  statusBadgeAligned: {
    color: '#10b981',
  },
  finalWaypointText: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
    marginTop: 8,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});
