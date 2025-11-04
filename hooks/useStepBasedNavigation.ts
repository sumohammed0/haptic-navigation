/**
 * Step-Based Navigation Hook with Direction Validation
 * 
 * This hook provides step-count-based navigation with direction validation.
 * Navigation only advances when:
 * 1. The required number of steps for the current segment is reached
 * 2. The user is moving in the correct direction (based on device orientation)
 * 
 * Features:
 * - Monitors step count from navigation state
 * - Continuously validates device orientation/compass heading
 * - Triggers feedback when user deviates from correct direction
 * - Advances to next segment when both conditions are met
 * - Provides navigation status and validation state
 * 
 * Usage:
 * - Initialize with alignment threshold (degrees)
 * - Hook automatically uses active navigation state from AppContext
 * - Provides step count progress and direction validation status
 * - Handles automatic segment progression when conditions are met
 */

import { useApp } from '@/context/AppContext';
import * as Location from 'expo-location';
import { useEffect, useRef, useState, useCallback } from 'react';

export type StepBasedNavigationStatus = {
  /** Current waypoint/segment index */
  segmentIndex: number;
  /** Total number of segments */
  totalSegments: number;
  /** Current step count for this segment */
  currentStepCount: number;
  /** Required step count for this segment */
  requiredStepCount: number | null;
  /** Progress percentage (0-100) */
  stepProgress: number;
  /** Current device heading in degrees (0-360) */
  currentHeading: number | null;
  /** Target heading for this segment in degrees (0-360) */
  targetHeading: number | null;
  /** Alignment error in degrees (-180 to 180), positive means turn right */
  alignmentError: number | null;
  /** Absolute alignment error in degrees (0 to 180) */
  absoluteError: number | null;
  /** Whether user is aligned within threshold */
  isAligned: boolean;
  /** Whether navigation is active */
  isActive: boolean;
  /** Whether this is the final segment */
  isFinalSegment: boolean;
  /** Whether both conditions are met (steps + direction) */
  canAdvance: boolean;
  /** Direction instruction for current segment */
  direction: string;
};

const DEFAULT_ALIGNMENT_THRESHOLD = 15; // degrees - how close user needs to be to target heading
const DIRECTION_CHECK_INTERVAL = 200; // ms - how often to check direction
const DEVIATION_THRESHOLD = 20; // degrees - threshold for off-course feedback

/**
 * Hook for step-based navigation with direction validation
 */
export function useStepBasedNavigation(
  alignmentThresholdDeg: number = DEFAULT_ALIGNMENT_THRESHOLD
): StepBasedNavigationStatus {
  const {
    navigationState,
    getCurrentWaypoint,
    getRoute,
    advanceToNextWaypoint,
  } = useApp();

  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastCheckRef = useRef<number>(0);

  // Request permissions and start heading updates
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status === 'granted' && navigationState.isActive) {
        // Start heading updates for compass/compass-based navigation
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          const value = h.trueHeading ?? h.magHeading ?? null;
          setHeading(value);
        });
      }
    })();
    return () => {
      if (headingSubRef.current) {
        headingSubRef.current.remove();
        headingSubRef.current = null;
      }
    };
  }, [navigationState.isActive]);

  // Get current waypoint and route
  const currentWaypoint = getCurrentWaypoint();
  const route = navigationState.routeId ? getRoute(navigationState.routeId) : undefined;

  // Calculate navigation status
  const calculateStatus = useCallback((): StepBasedNavigationStatus => {
    if (!navigationState.isActive || !currentWaypoint || !route) {
      return {
        segmentIndex: 0,
        totalSegments: 0,
        currentStepCount: 0,
        requiredStepCount: null,
        stepProgress: 0,
        currentHeading: null,
        targetHeading: null,
        alignmentError: null,
        absoluteError: null,
        isAligned: false,
        isActive: false,
        isFinalSegment: false,
        canAdvance: false,
        direction: '',
      };
    }

    const requiredStepCount = currentWaypoint.stepCountToNext ?? null;
    const currentStepCount = navigationState.currentStepCount;
    const stepProgress = requiredStepCount !== null && requiredStepCount > 0
      ? Math.min(100, (currentStepCount / requiredStepCount) * 100)
      : 0;

    const targetHeading = currentWaypoint.targetHeading ?? null;
    const currentHeading = heading;
    
    let alignmentError: number | null = null;
    let absoluteError: number | null = null;
    let isAligned = false;

    if (targetHeading !== null && currentHeading !== null) {
      alignmentError = normalizeAngleDiff(currentHeading, targetHeading);
      absoluteError = Math.abs(alignmentError);
      isAligned = absoluteError <= alignmentThresholdDeg;
    } else if (targetHeading === null) {
      // No target heading specified - consider aligned (direction-based only)
      isAligned = true;
    }

    // Can advance when: steps reached AND direction is correct
    const hasRequiredSteps = requiredStepCount !== null && currentStepCount >= requiredStepCount;
    const canAdvance = hasRequiredSteps && isAligned;

    return {
      segmentIndex: navigationState.currentWaypointIndex,
      totalSegments: route.waypoints.length,
      currentStepCount,
      requiredStepCount,
      stepProgress,
      currentHeading,
      targetHeading,
      alignmentError,
      absoluteError,
      isAligned,
      isActive: true,
      isFinalSegment: navigationState.currentWaypointIndex === route.waypoints.length - 1,
      canAdvance,
      direction: currentWaypoint.direction,
    };
  }, [
    navigationState,
    currentWaypoint,
    route,
    heading,
    alignmentThresholdDeg,
    getCurrentWaypoint,
    getRoute,
  ]);

  const status = calculateStatus();

  // Auto-advance when both conditions are met
  useEffect(() => {
    if (!navigationState.isActive || !status.isActive || status.isFinalSegment) {
      return;
    }

    // Check periodically to avoid excessive updates
    const now = Date.now();
    if (now - lastCheckRef.current < DIRECTION_CHECK_INTERVAL) {
      return;
    }
    lastCheckRef.current = now;

    // Re-check status (step count might have changed)
    const currentStatus = calculateStatus();

    if (currentStatus.canAdvance) {
      // Both conditions met: advance to next segment
      advanceToNextWaypoint();
    }
  }, [
    status.canAdvance,
    status.isFinalSegment,
    navigationState.isActive,
    status.isActive,
    calculateStatus,
    advanceToNextWaypoint,
  ]);

  return status;
}

/**
 * Normalize angle difference to range [-180, 180]
 * Positive value means turn right (clockwise), negative means turn left
 */
function normalizeAngleDiff(currentDeg: number, targetDeg: number): number {
  let diff = targetDeg - currentDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Check if user is significantly off-course (for feedback)
 */
export function isOffCourse(
  alignmentError: number | null,
  threshold: number = DEVIATION_THRESHOLD
): boolean {
  if (alignmentError === null) return false;
  return Math.abs(alignmentError) > threshold;
}

