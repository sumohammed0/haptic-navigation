/**
 * Audio Navigation Mode Screen (Continuous GPS-Based)
 * 
 * Provides continuous audio directions guiding users towards target locations.
 * Unlike rigid waypoint navigation, this allows users to explore at their own pace
 * while receiving constant directional feedback.
 * 
 * Features:
 * - Continuous GPS-based direction guidance towards target
 * - Real-time audio feedback about direction and distance
 * - Allows user to explore environment freely
 * - No automatic waypoint advancement - user controls pace
 * - Researcher can manually advance waypoints when user reaches target
 * 
 * Usage:
 * - Researcher starts navigation from researcher screen
 * - User is blindfolded and handed the phone
 * - Audio continuously guides user towards target location
 * - User can explore and feel their environment
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useHeadingBasedNavigation } from '@/hooks/useHeadingBasedNavigation';
import { useIsFocused } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';

const DIRECTION_FEEDBACK_INTERVAL = 3000; // ms - how often to provide direction feedback
const DISTANCE_FEEDBACK_INTERVAL = 5000; // ms - how often to provide distance feedback
const PROXIMITY_ANNOUNCEMENT_DISTANCE = 5; // meters - announce when close to target

export default function AudioNavigationScreen() {
  const { navigationState, settings } = useApp();
  const isFocused = useIsFocused();
  const nav = useHeadingBasedNavigation(settings.alignThresholdDeg);
  
  const lastSpokenRef = useRef<number>(0);
  const lastDirectionRef = useRef<string>('');
  const lastTargetIndexRef = useRef<number>(-1);
  const isInitialTargetRef = useRef<boolean>(true);

  // Stop speech when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      Speech.stop();
    }
    return () => {
      Speech.stop();
    };
  }, [isFocused]);

  // Reset initial target flag when navigation starts
  useEffect(() => {
    if (navigationState.isActive && nav.isActive) {
      if (lastTargetIndexRef.current === -1) {
        isInitialTargetRef.current = true;
      }
    }
  }, [navigationState.isActive, nav.isActive]);

  // Announce new target when it changes
  useEffect(() => {
    if (!navigationState.isActive || !nav.isActive || !nav.direction) {
      return;
    }

    const now = Date.now();
    const targetChanged = nav.targetIndex !== lastTargetIndexRef.current;

    if (targetChanged && lastTargetIndexRef.current >= 0) {
      // Target changed - announce new target
      const delay = now - lastSpokenRef.current < 1000 ? 800 : 0;
      setTimeout(() => {
        const announcement = nav.isFinalTarget
          ? `New target: ${nav.direction}.`
          : `New target: ${nav.direction}. Navigate towards this location.`;
        Speech.speak(announcement, { rate: 0.9 });
        lastSpokenRef.current = Date.now();
        lastTargetIndexRef.current = nav.targetIndex;
      }, delay);
    } else if (targetChanged && lastTargetIndexRef.current === -1) {
      // First target - announce immediately
      const announcement = nav.isFinalTarget
        ? `Navigate towards: ${nav.direction}.`
        : `Navigate towards: ${nav.direction}. Follow the audio directions.`;
      Speech.speak(announcement, { rate: 0.9 });
      lastSpokenRef.current = Date.now();
      lastTargetIndexRef.current = nav.targetIndex;
      isInitialTargetRef.current = false;
    }
  }, [nav.targetIndex, nav.direction, nav.isFinalTarget, navigationState.isActive, nav.isActive]);

  // Continuous direction guidance
  useEffect(() => {
    if (!navigationState.isActive || !nav.isActive) {
      return;
    }

    const now = Date.now();
    
    // Don't provide feedback too frequently
    if (now - lastSpokenRef.current < DIRECTION_FEEDBACK_INTERVAL) {
      return;
    }

    // Provide directional guidance based on heading
    if (nav.targetHeading !== null && nav.alignmentError !== null) {
      // Heading-based guidance (no GPS)
      const absErr = Math.abs(nav.alignmentError);
      const dir = nav.alignmentError > 0 ? 'right' : 'left';

      if (absErr > settings.alignThresholdDeg) {
        if (absErr <= 15) {
          Speech.speak(`Turn slightly ${dir}`, { rate: 0.9 });
        } else {
          Speech.speak(`Turn ${dir} ${Math.round(absErr)} degrees`, { rate: 0.9 });
        }
        lastSpokenRef.current = now;
      } else if (nav.isAligned) {
        Speech.speak('You are facing the correct direction. Continue forward.', { rate: 0.9 });
        lastSpokenRef.current = now;
      }
    }
  }, [
    nav.bearingToTarget,
    nav.alignmentError,
    nav.isAligned,
    nav.targetHeading,
    navigationState.isActive,
    nav.isActive,
    settings.alignThresholdDeg,
  ]);

  // Movement feedback - encourage user when they're moving in correct direction
  useEffect(() => {
    if (!navigationState.isActive || !nav.isActive) {
      return;
    }

    const now = Date.now();
    
    // Provide movement encouragement periodically
    if (now - lastSpokenRef.current < DISTANCE_FEEDBACK_INTERVAL) {
      return;
    }

    if (nav.isAligned && nav.hasMoved && nav.alignedMovementTime > 5000) {
      // User is aligned and has been moving - encourage
      Speech.speak('You are moving in the correct direction. Continue forward.', { rate: 0.9 });
      lastSpokenRef.current = now;
    } else if (nav.hasMoved && nav.movementConfidence > 0.7 && !nav.isAligned) {
      // User is moving but not aligned - remind about direction
      if (nav.alignmentError !== null) {
        const dir = nav.alignmentError > 0 ? 'right' : 'left';
        Speech.speak(`You are moving, but turn ${dir} to face the correct direction.`, { rate: 0.9 });
        lastSpokenRef.current = now;
      }
    }
  }, [nav.isAligned, nav.hasMoved, nav.movementConfidence, nav.alignedMovementTime, nav.alignmentError, navigationState.isActive, nav.isActive]);

  // Announce navigation completion
  useEffect(() => {
    if (!navigationState.isActive && lastTargetIndexRef.current >= 0) {
      Speech.speak('Navigation has ended.', { rate: 0.9 });
      lastTargetIndexRef.current = -1;
      isInitialTargetRef.current = true;
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
      
      {nav.isActive && (
        <>
          <View style={styles.statusSection}>
            <Text style={styles.statusText}>
              Target {nav.targetIndex + 1} of {nav.totalTargets}
            </Text>
            <Text style={styles.directionText}>{nav.direction}</Text>
          </View>

          {nav.hasMoved && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Movement Detected:</Text>
              <Text style={styles.infoValue}>
                {nav.movementConfidence > 0.7 ? 'High confidence' : nav.movementConfidence > 0.4 ? 'Moderate' : 'Low'}
              </Text>
              {nav.isAligned && nav.alignedMovementTime > 0 && (
                <Text style={styles.proximityText}>
                  Moving in correct direction for {Math.floor(nav.alignedMovementTime / 1000)}s
                </Text>
              )}
            </View>
          )}

          {nav.targetHeading !== null && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Current Heading:</Text>
              <Text style={styles.infoValue}>
                {nav.currentHeading?.toFixed(0) ?? '—'}°
              </Text>
              <Text style={styles.infoLabel}>Target Heading:</Text>
              <Text style={styles.infoValue}>{nav.targetHeading.toFixed(0)}°</Text>
              {nav.alignmentError !== null && (
                <>
                  <Text style={styles.infoLabel}>Alignment Error:</Text>
                  <Text style={styles.infoValue}>
                    {nav.alignmentError > 0 ? '+' : ''}
                    {nav.alignmentError.toFixed(0)}°
                  </Text>
                  <Text style={styles.infoLabel}>Status:</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      nav.isAligned && styles.statusBadgeAligned,
                    ]}
                  >
                    {nav.isAligned ? 'Aligned ✓' : 'Not Aligned'}
                  </Text>
                </>
              )}
            </View>
          )}

          {nav.isFinalTarget && (
            <Text style={styles.finalWaypointText}>Final target</Text>
          )}

          <Text style={styles.instruction}>
            Audio will continuously guide you towards the target. Explore at your own pace.
          </Text>
        </>
      )}
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
  instruction: {
    fontSize: 14,
    opacity: 0.8,
    fontStyle: 'italic',
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
  proximityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 8,
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
});
