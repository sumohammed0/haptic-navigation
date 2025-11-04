/**
 * Step-Based Navigation Screen (Blindfolded User Interface)
 * 
 * This screen provides a simple full-screen touch interface for blindfolded users.
 * The user taps the screen once per step to record their progress.
 * 
 * Features:
 * - Full-screen touch area - tap anywhere to record a step
 * - Immediate haptic/audio feedback for each tap
 * - Real-time direction validation with off-course feedback
 * - Automatic advancement when step count AND direction are correct
 * - No visible UI (or minimal for debugging)
 * - Works with step-based navigation system
 * 
 * Usage:
 * - Researcher starts navigation from researcher screen
 * - User is blindfolded and handed the phone
 * - User taps screen once per step taken
 * - Haptic/audio feedback indicates direction corrections
 * - Confirmation cue when segment is complete
 */

import { useApp } from '@/context/AppContext';
import { useStepBasedNavigation, isOffCourse } from '@/hooks/useStepBasedNavigation';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';

const DEVIATION_FEEDBACK_THRESHOLD = 20; // degrees - trigger feedback when off by this much
const STEP_FEEDBACK_DELAY = 100; // ms - delay between step feedback to avoid overwhelming

export default function StepNavigationScreen() {
  const { navigationState, settings, incrementStepCount } = useApp();
  const isFocused = useIsFocused();
  const status = useStepBasedNavigation(settings.alignThresholdDeg);
  
  const lastStepFeedbackRef = useRef<number>(0);
  const lastOffCourseFeedbackRef = useRef<number>(0);
  const lastSegmentIndexRef = useRef<number>(-1);
  const offCourseFeedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle step tap
  const handleStepTap = () => {
    if (!navigationState.isActive || !status.isActive) {
      return;
    }

    const now = Date.now();
    // Prevent rapid taps (debounce)
    if (now - lastStepFeedbackRef.current < STEP_FEEDBACK_DELAY) {
      return;
    }
    lastStepFeedbackRef.current = now;

    // Increment step count
    incrementStepCount();

    // Provide immediate haptic feedback for step tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Provide off-course feedback
  useEffect(() => {
    // Clear any existing interval
    if (offCourseFeedbackIntervalRef.current) {
      clearInterval(offCourseFeedbackIntervalRef.current);
      offCourseFeedbackIntervalRef.current = null;
    }

    if (!navigationState.isActive || !status.isActive || !status.targetHeading) {
      return;
    }

    // Check if user is off-course and provide feedback
    const checkOffCourse = () => {
      if (status.alignmentError === null) return;

      const offCourse = isOffCourse(status.alignmentError, DEVIATION_FEEDBACK_THRESHOLD);
      const now = Date.now();

      if (offCourse && now - lastOffCourseFeedbackRef.current > 2000) {
        // User is off-course - provide gentle haptic feedback
        // Double pulse = turn right, single pulse = turn left
        if (status.alignmentError > 0) {
          // Turn right
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }, 150);
        } else {
          // Turn left
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        lastOffCourseFeedbackRef.current = now;
      }
    };

    // Check periodically for off-course feedback
    offCourseFeedbackIntervalRef.current = setInterval(checkOffCourse, 1000);

    return () => {
      if (offCourseFeedbackIntervalRef.current) {
        clearInterval(offCourseFeedbackIntervalRef.current);
        offCourseFeedbackIntervalRef.current = null;
      }
    };
  }, [
    status.alignmentError,
    status.targetHeading,
    navigationState.isActive,
    status.isActive,
  ]);

  // Provide confirmation cue when segment advances
  useEffect(() => {
    if (
      navigationState.isActive &&
      status.isActive &&
      status.segmentIndex !== lastSegmentIndexRef.current &&
      lastSegmentIndexRef.current >= 0
    ) {
      // Segment advanced - provide confirmation cue
      // Strong haptic pulse
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Optional: audio confirmation (if navigation mode supports audio)
      if (navigationState.feedbackMode === 'audio' || !status.isFinalSegment) {
        Speech.speak('Segment complete', { rate: 0.9 });
      }
    }
    lastSegmentIndexRef.current = status.segmentIndex;
  }, [status.segmentIndex, navigationState.isActive, status.isActive, status.isFinalSegment, navigationState.feedbackMode]);

  // Announce navigation completion
  useEffect(() => {
    if (!navigationState.isActive && lastSegmentIndexRef.current >= 0) {
      // Navigation just ended
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Speech.speak('Navigation complete. You have reached your destination.', { rate: 0.9 });
      lastSegmentIndexRef.current = -1;
    }
  }, [navigationState.isActive]);

  if (!navigationState.isActive) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.fullScreenTouch}
          activeOpacity={1}
          onPress={handleStepTap}
          disabled
        >
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Waiting for navigation to start...</Text>
            <Text style={styles.waitingSubtext}>
              The researcher will start navigation from the control panel.
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.fullScreenTouch}
        activeOpacity={0.9}
        onPress={handleStepTap}
      >
        {/* Minimal UI - mostly hidden for blindfolded users */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              Segment: {status.segmentIndex + 1}/{status.totalSegments}
            </Text>
            <Text style={styles.debugText}>
              Steps: {status.currentStepCount}{status.requiredStepCount !== null ? `/${status.requiredStepCount}` : ''}
            </Text>
            <Text style={styles.debugText}>
              Progress: {status.stepProgress.toFixed(0)}%
            </Text>
            {status.targetHeading !== null && (
              <>
                <Text style={styles.debugText}>
                  Heading: {status.currentHeading?.toFixed(0) ?? '—'}° / {status.targetHeading.toFixed(0)}°
                </Text>
                <Text style={styles.debugText}>
                  Aligned: {status.isAligned ? 'Yes ✓' : 'No'}
                </Text>
                {status.alignmentError !== null && (
                  <Text style={styles.debugText}>
                    Error: {status.alignmentError > 0 ? '+' : ''}{status.alignmentError.toFixed(0)}°
                  </Text>
                )}
              </>
            )}
            <Text style={styles.debugText}>
              Can Advance: {status.canAdvance ? 'Yes ✓' : 'No'}
            </Text>
            <Text style={styles.debugDirection}>{status.direction}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenTouch: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  waitingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  debugInfo: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  debugDirection: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});

