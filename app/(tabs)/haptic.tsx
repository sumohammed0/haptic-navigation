/**
 * Static Haptic Navigation Mode Screen
 * 
 * Provides fixed vibration patterns to indicate navigation direction.
 * Vibration indicates when user is aligned with the target heading.
 * 
 * Features:
 * - Fixed vibration pattern when aligned (continuous vibration)
 * - No vibration when not aligned
 * - Works with step-by-step waypoint navigation
 * - No user interaction required (hands-free operation)
 * 
 * Usage:
 * - Researcher starts navigation from researcher screen
 * - User is blindfolded and handed the phone
 * - Continuous vibration indicates correct alignment
 * - Vibration stops when user turns away from target direction
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useIndoorNavigation } from '@/hooks/useIndoorNavigation';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Vibration } from 'react-native';

export default function HapticNavigationScreen() {
  const { navigationState, settings } = useApp();
  const isFocused = useIsFocused();
  const alignment = useIndoorNavigation(settings.alignThresholdDeg);
  
  const vibratingRef = useRef<boolean>(false);
  const wasAlignedRef = useRef<boolean>(false);

  // Stop vibration when screen loses focus or navigation stops
  useEffect(() => {
    if (!isFocused || !navigationState.isActive) {
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      wasAlignedRef.current = false;
    }
    return () => {
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
    };
  }, [isFocused, navigationState.isActive]);

  // Control vibration based on alignment
  useEffect(() => {
    if (!navigationState.isActive || !alignment.isActive || !alignment.targetHeading) {
      // No target heading or not active - stop vibration
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      wasAlignedRef.current = false;
      return;
    }

    // Static haptic: continuous vibration when aligned, none when not aligned
    if (alignment.isAligned) {
      if (!vibratingRef.current) {
        // Start continuous vibration: pattern [0ms wait, 200ms vibrate, 50ms pause] repeated
        Vibration.vibrate([0, 200, 50], true);
        vibratingRef.current = true;
        wasAlignedRef.current = true;
      }
    } else {
      // Not aligned - stop vibration
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
        wasAlignedRef.current = false;
      }
    }
  }, [
    alignment.isAligned,
    alignment.targetHeading,
    navigationState.isActive,
    alignment.isActive,
  ]);

  // Provide a brief vibration pulse when waypoint changes (if not already vibrating)
  useEffect(() => {
    if (
      navigationState.isActive &&
      alignment.isActive &&
      alignment.direction &&
      !vibratingRef.current
    ) {
      // Brief pulse to indicate new waypoint (if not aligned yet)
      Vibration.vibrate(100);
    }
  }, [alignment.waypointIndex, navigationState.isActive, alignment.isActive, alignment.direction]);

  if (!navigationState.isActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Static Haptic Navigation</Text>
        <Text style={styles.subtitle}>
          Waiting for navigation to start...
        </Text>
        <Text style={styles.info}>
          The researcher will start navigation from the control panel.
        </Text>
        <Text style={styles.instruction}>
          When active, continuous vibration indicates you are facing the correct direction.
          Vibration stops when you turn away.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Static Haptic Navigation</Text>
      
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
                  <View style={styles.vibrationIndicator}>
                    <Text style={styles.infoLabel}>Vibration Status:</Text>
                    <Text
                      style={[
                        styles.vibrationBadge,
                        alignment.isAligned && styles.vibrationBadgeActive,
                      ]}
                    >
                      {alignment.isAligned ? 'Vibrating ✓' : 'Not Vibrating'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {alignment.isFinalWaypoint && (
            <Text style={styles.finalWaypointText}>Final waypoint</Text>
          )}

          <Text style={styles.instruction}>
            {alignment.isAligned
              ? 'You are aligned. Continue forward.'
              : 'Turn until you feel continuous vibration.'}
          </Text>
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
  vibrationIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vibrationBadge: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 4,
  },
  vibrationBadgeActive: {
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
