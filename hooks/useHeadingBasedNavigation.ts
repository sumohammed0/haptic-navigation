/**
 * Heading-Based Indoor Navigation Hook
 * 
 * Provides continuous directional guidance using compass heading only (no GPS).
 * Designed for indoor navigation where GPS is unreliable.
 * 
 * Features:
 * - Pure heading/compass-based navigation
 * - Movement detection via heading changes and accelerometer
 * - Continuous directional feedback
 * - No automatic waypoint advancement - researcher controls progression
 * - Works entirely without GPS
 * 
 * Usage:
 * - Initialize with alignment threshold
 * - Provides continuous heading alignment data
 * - Detects movement/turns to infer user progress
 * - Researcher manually advances waypoints when user reaches them
 */

import { useApp } from '@/context/AppContext';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState, useCallback } from 'react';

export type HeadingBasedNavigationStatus = {
  /** Current waypoint/target index */
  targetIndex: number;
  /** Total number of targets */
  totalTargets: number;
  /** Current device heading in degrees (0-360) */
  currentHeading: number | null;
  /** Target heading in degrees (0-360) */
  targetHeading: number | null;
  /** Alignment error in degrees (-180 to 180), positive means turn right */
  alignmentError: number | null;
  /** Absolute alignment error in degrees (0 to 180) */
  absoluteError: number | null;
  /** Whether user is facing the correct direction */
  isAligned: boolean;
  /** Whether navigation is active */
  isActive: boolean;
  /** Whether this is the final target */
  isFinalTarget: boolean;
  /** Direction instruction for current target */
  direction: string;
  /** Estimated movement detected (heading change + motion) */
  hasMoved: boolean;
  /** Movement confidence (0-1) based on heading stability and accelerometer */
  movementConfidence: number;
  /** Time user has been aligned and moving */
  alignedMovementTime: number;
};

const DEFAULT_ALIGNMENT_THRESHOLD = 15; // degrees
const HEADING_CHANGE_THRESHOLD = 30; // degrees - significant heading change indicates movement
const MOVEMENT_STABLE_TIME = 2000; // ms - heading stable for this duration after change suggests reached waypoint
const ACCELEROMETER_THRESHOLD = 0.1; // m/s² - acceleration threshold for movement detection

/**
 * Hook for heading-based indoor navigation (no GPS)
 */
export function useHeadingBasedNavigation(
  alignmentThresholdDeg: number = DEFAULT_ALIGNMENT_THRESHOLD
): HeadingBasedNavigationStatus {
  const {
    navigationState,
    getCurrentWaypoint,
    getRoute,
  } = useApp();

  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [accelerometerData, setAccelerometerData] = useState<{ x: number; y: number; z: number } | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const accelerometerSubRef = useRef<any>(null);
  
  // Movement detection state
  const initialHeadingRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const headingChangeDetectedRef = useRef<boolean>(false);
  const headingStableSinceRef = useRef<number | null>(null);
  const alignedStartTimeRef = useRef<number | null>(null);
  const lastAccelerometerRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // Request permissions and start heading/accelerometer updates
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      
      if (status === 'granted' && navigationState.isActive) {
        // Start heading updates
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          const value = h.trueHeading ?? h.magHeading ?? null;
          setHeading(value);
          
          // Track heading for movement detection
          if (value !== null) {
            if (lastHeadingRef.current === null) {
              lastHeadingRef.current = value;
              initialHeadingRef.current = value;
            } else {
              const headingChange = Math.abs(normalizeAngleDiff(value, lastHeadingRef.current));
              if (headingChange > HEADING_CHANGE_THRESHOLD) {
                headingChangeDetectedRef.current = true;
                headingStableSinceRef.current = Date.now();
              }
            }
            lastHeadingRef.current = value;
          }
        });

        // Start accelerometer for movement detection
        try {
          Accelerometer.setUpdateInterval(100);
          accelerometerSubRef.current = Accelerometer.addListener((data) => {
            setAccelerometerData(data);
            lastAccelerometerRef.current = data;
          });
        } catch (error) {
          console.warn('Accelerometer not available:', error);
        }
      }
    })();
    
    return () => {
      if (headingSubRef.current) {
        headingSubRef.current.remove();
        headingSubRef.current = null;
      }
      if (accelerometerSubRef.current) {
        accelerometerSubRef.current.remove();
        accelerometerSubRef.current = null;
      }
    };
  }, [navigationState.isActive]);

  // Reset movement detection when waypoint changes
  useEffect(() => {
    if (navigationState.isActive) {
      initialHeadingRef.current = heading;
      lastHeadingRef.current = heading;
      headingChangeDetectedRef.current = false;
      headingStableSinceRef.current = null;
      alignedStartTimeRef.current = null;
    }
  }, [navigationState.currentWaypointIndex, navigationState.isActive]);

  // Get current waypoint and route
  const currentWaypoint = getCurrentWaypoint();
  const route = navigationState.routeId ? getRoute(navigationState.routeId) : undefined;

  // Calculate navigation status
  const calculateStatus = useCallback((): HeadingBasedNavigationStatus => {
    if (!navigationState.isActive || !currentWaypoint || !route) {
      return {
        targetIndex: 0,
        totalTargets: 0,
        currentHeading: null,
        targetHeading: null,
        alignmentError: null,
        absoluteError: null,
        isAligned: false,
        isActive: false,
        isFinalTarget: false,
        direction: '',
        hasMoved: false,
        movementConfidence: 0,
        alignedMovementTime: 0,
      };
    }

    const targetHeading = currentWaypoint.targetHeading ?? null;
    
    let alignmentError: number | null = null;
    let absoluteError: number | null = null;
    let isAligned = false;

    if (targetHeading !== null && heading !== null) {
      alignmentError = normalizeAngleDiff(heading, targetHeading);
      absoluteError = Math.abs(alignmentError);
      isAligned = absoluteError <= alignmentThresholdDeg;
    } else if (targetHeading === null) {
      // No target heading specified - consider aligned (direction-based only)
      isAligned = true;
    }

    // Movement detection
    let hasMoved = false;
    let movementConfidence = 0;
    let alignedMovementTime = 0;

    if (heading !== null && lastHeadingRef.current !== null && initialHeadingRef.current !== null) {
      const headingChange = Math.abs(normalizeAngleDiff(heading, initialHeadingRef.current));
      
      // Detect significant heading change (user turned/moved)
      if (headingChange > HEADING_CHANGE_THRESHOLD) {
        hasMoved = true;
        
        // Check if heading has stabilized (user reached a waypoint/turned corner)
        if (headingStableSinceRef.current !== null) {
          const stableDuration = Date.now() - headingStableSinceRef.current;
          const recentChange = Math.abs(normalizeAngleDiff(heading, lastHeadingRef.current));
          
          if (recentChange < 5) { // Heading stable (changed less than 5 degrees)
            // User has moved and stopped - high confidence
            movementConfidence = Math.min(1, stableDuration / MOVEMENT_STABLE_TIME);
          } else {
            // Still moving
            movementConfidence = 0.3;
          }
        } else {
          movementConfidence = 0.2; // Just started moving
        }
      }

      // Check accelerometer for additional movement signal
      if (accelerometerData && lastAccelerometerRef.current) {
        const accelChange = Math.sqrt(
          Math.pow(accelerometerData.x - lastAccelerometerRef.current.x, 2) +
          Math.pow(accelerometerData.y - lastAccelerometerRef.current.y, 2) +
          Math.pow(accelerometerData.z - lastAccelerometerRef.current.z, 2)
        );
        
        if (accelChange > ACCELEROMETER_THRESHOLD) {
          movementConfidence = Math.max(movementConfidence, 0.4);
        }
      }
    }

    // Track time user has been aligned and moving
    if (isAligned && hasMoved) {
      if (alignedStartTimeRef.current === null) {
        alignedStartTimeRef.current = Date.now();
      }
      alignedMovementTime = Date.now() - alignedStartTimeRef.current;
    } else {
      alignedStartTimeRef.current = null;
    }

    return {
      targetIndex: navigationState.currentWaypointIndex,
      totalTargets: route.waypoints.length,
      currentHeading: heading,
      targetHeading,
      alignmentError,
      absoluteError,
      isAligned,
      isActive: true,
      isFinalTarget: navigationState.currentWaypointIndex === route.waypoints.length - 1,
      direction: currentWaypoint.direction,
      hasMoved,
      movementConfidence,
      alignedMovementTime,
    };
  }, [
    navigationState,
    currentWaypoint,
    route,
    heading,
    accelerometerData,
    alignmentThresholdDeg,
    getCurrentWaypoint,
    getRoute,
  ]);

  return calculateStatus();
}

/**
 * Normalize angle difference to range [-180, 180]
 */
function normalizeAngleDiff(currentDeg: number, targetDeg: number): number {
  let diff = targetDeg - currentDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

