/**
 * Static Haptic Navigation Mode Screen (Continuous)
 * 
 * Provides continuous vibration when user is facing the correct direction.
 * Unlike rigid waypoint navigation, this allows users to explore at their own pace
 * while receiving constant haptic feedback about direction.
 * 
 * Features:
 * - Continuous vibration when aligned with target direction
 * - No vibration when not aligned
 * - Works with GPS-based or heading-based targets
 * - Allows user to explore environment freely
 * - Researcher can manually advance waypoints when user reaches target
 * 
 * Usage:
 * - Researcher starts navigation from researcher screen
 * - User is blindfolded and handed the phone
 * - Continuous vibration indicates correct direction
 * - Vibration stops when user turns away from target
 */

import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { useHeadingBasedNavigation } from '@/hooks/useHeadingBasedNavigation';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Vibration } from 'react-native';

export default function HapticNavigationScreen() {
  const { navigationState, settings } = useApp();
  const isFocused = useIsFocused();
  const nav = useHeadingBasedNavigation(settings.alignThresholdDeg);
  
  const vibratingRef = useRef<boolean>(false);
  const lastTargetIndexRef = useRef<number>(-1);

  // Stop vibration when screen loses focus or navigation stops
  useEffect(() => {
    if (!isFocused || !navigationState.isActive) {
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      lastTargetIndexRef.current = -1;
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
    if (!navigationState.isActive || !nav.isActive) {
      // Not active - stop vibration
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
      return;
    }

    // Static haptic: continuous vibration when aligned, none when not aligned
    if (nav.isAligned && nav.targetHeading !== null) {
      // User is aligned - start continuous vibration
      if (!vibratingRef.current) {
        // Start continuous vibration: pattern [0ms wait, 200ms vibrate, 50ms pause] repeated
        Vibration.vibrate([0, 200, 50], true);
        vibratingRef.current = true;
      }
    } else {
      // Not aligned - stop vibration
      if (vibratingRef.current) {
        Vibration.cancel();
        vibratingRef.current = false;
      }
    }
  }, [
    nav.isAligned,
    nav.targetHeading,
    nav.bearingToTarget,
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
      Vibration.vibrate(100);
      lastTargetIndexRef.current = nav.targetIndex;
    } else if (nav.targetIndex !== lastTargetIndexRef.current && lastTargetIndexRef.current === -1) {
      // First target
      lastTargetIndexRef.current = nav.targetIndex;
    }
  }, [nav.targetIndex, navigationState.isActive, nav.isActive]);

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
                {nav.movementConfidence > 0.7 ? 'Detected (High)' : nav.movementConfidence > 0.4 ? 'Detected (Moderate)' : 'None'}
              </Text>
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
              {nav.alignmentError !== null && (
                <>
                  <Text style={styles.infoLabel}>Alignment Error:</Text>
                  <Text style={styles.infoValue}>
                    {nav.alignmentError > 0 ? '+' : ''}
                    {nav.alignmentError.toFixed(0)}°
                  </Text>
                  <View style={styles.vibrationIndicator}>
                    <Text style={styles.infoLabel}>Vibration Status:</Text>
                    <Text
                      style={[
                        styles.vibrationBadge,
                        nav.isAligned && styles.vibrationBadgeActive,
                      ]}
                    >
                      {nav.isAligned ? 'Vibrating ✓' : 'Not Vibrating'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {nav.isFinalTarget && (
            <Text style={styles.finalWaypointText}>Final target</Text>
          )}

          <Text style={styles.instruction}>
            Continuous vibration indicates you are facing the correct direction.
            Turn until you feel vibration, then explore at your own pace.
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
});
