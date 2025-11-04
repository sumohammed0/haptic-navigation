/**
 * Dynamic Haptic Navigation Mode Screen (Continuous)
 * 
 * Provides variable intensity/frequency vibration patterns based on proximity to target direction and distance.
 * Combines directional guidance with distance feedback for comprehensive navigation assistance.
 * 
 * Features:
 * - Continuous vibration when perfectly aligned
 * - Direction-coded pulsing when not aligned:
 *   - Double pulse = turn right
 *   - Single pulse = turn left
 * - Pulse frequency increases as alignment improves
 * - Pulse intensity varies with alignment error
 * - Distance-based feedback (vibration intensity increases as user gets closer)
 * - Allows user to explore environment freely
 * 
 * Usage:
 * - Researcher starts navigation from researcher screen
 * - User is blindfolded and handed the phone
 * - Continuous vibration = aligned, proceed forward
 * - Pulsing = not aligned, follow pulse pattern to correct direction
 * - Closer to target = stronger, faster pulses
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useHeadingBasedNavigation } from '@/hooks/useHeadingBasedNavigation';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Vibration } from 'react-native';

export default function HapticDynamicNavigationScreen() {
  const { navigationState, settings } = useApp();
  const isFocused = useIsFocused();
  const nav = useHeadingBasedNavigation(settings.alignThresholdDeg);
  
  const vibratingRef = useRef<boolean>(false);
  const lastPulseRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTargetIndexRef = useRef<number>(-1);

  // Cleanup on unmount or when navigation stops
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
    };
  }, []);

  // Stop vibration when screen loses focus or navigation stops
  useEffect(() => {
    if (!isFocused || !navigationState.isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      lastPulseRef.current = 0;
      lastTargetIndexRef.current = -1;
    }
  }, [isFocused, navigationState.isActive]);

  // Dynamic haptic feedback logic
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!navigationState.isActive || !nav.isActive) {
      // Not active - ensure vibration is stopped
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      return;
    }

    // Continuous vibration when aligned
    if (nav.isAligned && nav.targetHeading !== null) {
      if (!vibratingRef.current) {
        // Start continuous vibration pattern
        Vibration.vibrate([0, 200, 50], true);
        vibratingRef.current = true;
      }
      return; // Don't pulse when aligned
    }

    // Not aligned - stop continuous vibration if active
    if (vibratingRef.current) {
      Vibration.cancel();
      vibratingRef.current = false;
    }

    // Set up pulsing interval for direction feedback
    const pulseInterval = () => {
      if (!nav.isActive || nav.isAligned) {
        return;
      }

      if (nav.absoluteError === null || nav.alignmentError === null) {
        return;
      }

      const absErr = nav.absoluteError;
      
      // Calculate pulse frequency: closer to target = faster pulses
      // Range: 200ms (very close, 0-10°) to 1200ms (far away, 170-180°)
      const frequencyMs = mapRange(absErr, 0, 180, 200, 1200);
      
      // Determine pulse intensity based on error and movement
      let style: Haptics.ImpactFeedbackStyle;
      
      // Adjust intensity based on movement confidence (moving = stronger feedback)
      const movementFactor = nav.hasMoved ? Math.min(1, nav.movementConfidence) : 0.5;
      
      if (absErr < 10) {
        style = Haptics.ImpactFeedbackStyle.Heavy;
      } else if (absErr < 30) {
        style = Haptics.ImpactFeedbackStyle.Medium;
      } else {
        style = Haptics.ImpactFeedbackStyle.Light;
      }

      // Apply distance factor (closer = stronger pulses)
      const now = Date.now();
      if (now - lastPulseRef.current >= frequencyMs) {
        if (nav.alignmentError > 0) {
          // Need to turn right: double pulse
          Haptics.impactAsync(style);
          setTimeout(() => {
            Haptics.impactAsync(style);
          }, 120);
        } else {
          // Need to turn left: single pulse
          Haptics.impactAsync(style);
        }
        lastPulseRef.current = now;
      }
    };

    // Update pulse interval based on current alignment error
    intervalRef.current = setInterval(pulseInterval, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    nav.isAligned,
    nav.absoluteError,
    nav.alignmentError,
    nav.targetHeading,
    nav.bearingToTarget,
    nav.distanceToTarget,
    navigationState.isActive,
    nav.isActive,
  ]);

  // Provide a brief vibration pulse when target changes
  useEffect(() => {
    if (
      navigationState.isActive &&
      nav.isActive &&
      nav.targetIndex !== lastTargetIndexRef.current &&
      lastTargetIndexRef.current >= 0
    ) {
      // Target changed - brief pulse to indicate new target
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Info);
      lastTargetIndexRef.current = nav.targetIndex;
    } else if (nav.targetIndex !== lastTargetIndexRef.current && lastTargetIndexRef.current === -1) {
      // First target
      lastTargetIndexRef.current = nav.targetIndex;
    }
  }, [nav.targetIndex, navigationState.isActive, nav.isActive]);

  if (!navigationState.isActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Dynamic Haptic Navigation</Text>
        <Text style={styles.subtitle}>
          Waiting for navigation to start...
        </Text>
        <Text style={styles.info}>
          The researcher will start navigation from the control panel.
        </Text>
        <Text style={styles.instruction}>
          When active:
          {'\n'}• Continuous vibration = aligned, continue forward
          {'\n'}• Double pulse = turn right
          {'\n'}• Single pulse = turn left
          {'\n'}• Closer to target = faster, stronger pulses
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dynamic Haptic Navigation</Text>
      
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
              <Text style={styles.infoLabel}>Movement:</Text>
              <Text style={styles.infoValue}>
                {nav.movementConfidence > 0.7 ? 'High confidence' : nav.movementConfidence > 0.4 ? 'Moderate' : 'Low'}
              </Text>
              {nav.isAligned && nav.alignedMovementTime > 0 && (
                <Text style={styles.proximityText}>
                  Moving correctly for {Math.floor(nav.alignedMovementTime / 1000)}s
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
              <Text style={styles.infoValue}>
                {nav.targetHeading.toFixed(0)}°
              </Text>
              {nav.alignmentError !== null && nav.absoluteError !== null && (
                <>
                  <Text style={styles.infoLabel}>Alignment Error:</Text>
                  <Text style={styles.infoValue}>
                    {nav.alignmentError > 0 ? '+' : ''}
                    {nav.alignmentError.toFixed(0)}°
                  </Text>
                  <View style={styles.vibrationIndicator}>
                    <Text style={styles.infoLabel}>Haptic Status:</Text>
                    <Text
                      style={[
                        styles.vibrationBadge,
                        nav.isAligned && styles.vibrationBadgeAligned,
                      ]}
                    >
                      {nav.isAligned
                        ? 'Continuous Vibration ✓'
                        : nav.alignmentError > 0
                        ? 'Double Pulse (Turn Right)'
                        : 'Single Pulse (Turn Left)'}
                    </Text>
                    {!nav.isAligned && nav.absoluteError !== null && (
                      <Text style={styles.pulseInfo}>
                        Pulse frequency: {mapRange(nav.absoluteError, 0, 180, 200, 1200).toFixed(0)}ms
                        {'\n'}
                        Intensity:{' '}
                        {nav.absoluteError < 10
                          ? 'Heavy'
                          : nav.absoluteError < 30
                          ? 'Medium'
                          : 'Light'}
                        {nav.hasMoved && (
                          <>
                            {'\n'}
                            Movement factor: {nav.movementConfidence.toFixed(2)}
                          </>
                        )}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          {nav.isFinalTarget && (
            <Text style={styles.finalWaypointText}>Final target</Text>
          )}
        </>
      )}
    </View>
  );
}

/**
 * Map a value from one range to another
 */
function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  const norm = (clamped - inMin) / (inMax - inMin);
  return outMin + norm * (outMax - outMin);
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
    lineHeight: 20,
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
  vibrationIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vibrationBadge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 4,
  },
  vibrationBadgeAligned: {
    color: '#10b981',
  },
  pulseInfo: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    fontStyle: 'italic',
  },
  finalWaypointText: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
    marginTop: 8,
  },
});
