/**
 * Unified Indoor Navigation Hook
 * 
 * This hook provides step-by-step indoor navigation logic that works with all feedback modes.
 * It manages waypoint progression, heading alignment, and automatic advancement.
 * 
 * Features:
 * - Monitors current waypoint and user heading
 * - Calculates alignment error for direction feedback
 * - Automatically advances to next waypoint when user is aligned and has moved forward
 * - Provides navigation status and callbacks
 * 
 * Usage:
 * - Initialize with feedback mode
 * - Hook automatically uses active navigation state from AppContext
 * - Provides alignment data for audio/haptic feedback
 * - Handles automatic waypoint progression
 */

import { useApp } from '@/context/AppContext';
import * as Location from 'expo-location';
import { useEffect, useRef, useState, useCallback } from 'react';

export type NavigationAlignment = {
  /** Current waypoint direction instruction */
  direction: string;
  /** Target heading in degrees (0-360), if available */
  targetHeading: number | null;
  /** Current user heading in degrees (0-360) */
  currentHeading: number | null;
  /** Alignment error in degrees (-180 to 180), positive means turn right */
  alignmentError: number | null;
  /** Absolute alignment error in degrees (0 to 180) */
  absoluteError: number | null;
  /** Whether user is aligned within threshold */
  isAligned: boolean;
  /** Current waypoint index */
  waypointIndex: number;
  /** Total number of waypoints */
  totalWaypoints: number;
  /** Whether navigation is active */
  isActive: boolean;
  /** Whether this is the final waypoint */
  isFinalWaypoint: boolean;
};

const DEFAULT_THRESHOLD = 15; // degrees - how close user needs to be to target heading
const ALIGNMENT_CHECK_INTERVAL = 200; // ms - how often to check alignment
const ADVANCE_CONFIRMATION_MS = 300; // Brief confirmation period (300ms) for stability - no time delay, just prevents false triggers
const HEADING_CHANGE_THRESHOLD = 20; // degrees - heading change to detect user has moved/reached position
const HEADING_STABLE_DURATION = 1500; // ms - heading must be stable for this duration after significant change

/**
 * Hook for indoor step-by-step navigation
 */
export function useIndoorNavigation(
  alignmentThresholdDeg: number = DEFAULT_THRESHOLD
): NavigationAlignment {
  const {
    navigationState,
    getCurrentWaypoint,
    getRoute,
    advanceToNextWaypoint,
    markWaypointReached,
  } = useApp();

  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const alignedStartTimeRef = useRef<number | null>(null);
  const lastAlignmentCheckRef = useRef<number>(0);
  const waypointStartTimeRef = useRef<number | null>(null);
  const lastWaypointIndexRef = useRef<number>(-1);
  const advanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // For direction-only waypoints: track heading changes to detect movement/position
  const initialHeadingRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const headingChangeDetectedRef = useRef<boolean>(false);
  const headingStableSinceRef = useRef<number | null>(null);

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

  // Calculate alignment
  const calculateAlignment = useCallback((): NavigationAlignment => {
    if (!navigationState.isActive || !currentWaypoint || !route) {
      return {
        direction: '',
        targetHeading: null,
        currentHeading: null,
        alignmentError: null,
        absoluteError: null,
        isAligned: false,
        waypointIndex: 0,
        totalWaypoints: 0,
        isActive: false,
        isFinalWaypoint: false,
      };
    }

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
      // This allows for routes that don't rely on heading alignment
      isAligned = true;
    }

    return {
      direction: currentWaypoint.direction,
      targetHeading,
      currentHeading,
      alignmentError,
      absoluteError,
      isAligned,
      waypointIndex: navigationState.currentWaypointIndex,
      totalWaypoints: route.waypoints.length,
      isActive: true,
      isFinalWaypoint: navigationState.currentWaypointIndex === route.waypoints.length - 1,
    };
  }, [navigationState, currentWaypoint, route, heading, alignmentThresholdDeg, getCurrentWaypoint, getRoute]);

  const alignment = calculateAlignment();

  // Track when waypoint changes to reset timers and heading tracking
  useEffect(() => {
    if (alignment.waypointIndex !== lastWaypointIndexRef.current) {
      // Waypoint changed - reset all timers and tracking
      waypointStartTimeRef.current = Date.now();
      alignedStartTimeRef.current = null;
      lastWaypointIndexRef.current = alignment.waypointIndex;
      // Reset heading change detection for direction-only waypoints
      initialHeadingRef.current = heading;
      lastHeadingRef.current = heading;
      headingChangeDetectedRef.current = false;
      headingStableSinceRef.current = null;
    }
  }, [alignment.waypointIndex, heading]);

  // Cleanup interval on unmount or when navigation stops
  useEffect(() => {
    return () => {
      if (advanceIntervalRef.current) {
        clearInterval(advanceIntervalRef.current);
        advanceIntervalRef.current = null;
      }
    };
  }, []);

  // Auto-advance logic: advance based on alignment (for waypoints with heading) or time (for direction-only waypoints)
  useEffect(() => {
    // Clear any existing interval
    if (advanceIntervalRef.current) {
      clearInterval(advanceIntervalRef.current);
      advanceIntervalRef.current = null;
    }

    if (!navigationState.isActive || !alignment.isActive || alignment.isFinalWaypoint) {
      alignedStartTimeRef.current = null;
      waypointStartTimeRef.current = null;
      return;
    }

    const now = Date.now();
    
    // Initialize waypoint start time if not set
    if (waypointStartTimeRef.current === null) {
      waypointStartTimeRef.current = now;
    }

    // Handle waypoints with target heading: use alignment-based advancement (immediate when aligned)
    if (alignment.targetHeading !== null) {
      // Use interval to check alignment periodically
      advanceIntervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        
        // Only check alignment periodically to avoid excessive updates
        if (currentTime - lastAlignmentCheckRef.current < ALIGNMENT_CHECK_INTERVAL) {
          return;
        }
        lastAlignmentCheckRef.current = currentTime;

        // Re-check alignment state (heading might have changed)
        const currentWaypoint = getCurrentWaypoint();
        if (!currentWaypoint) return;
        
        const targetHeading = currentWaypoint.targetHeading ?? null;
        const currentHeading = heading;
        
        let isAligned = false;
        if (targetHeading !== null && currentHeading !== null) {
          const alignmentError = normalizeAngleDiff(currentHeading, targetHeading);
          const absoluteError = Math.abs(alignmentError);
          isAligned = absoluteError <= alignmentThresholdDeg;
        }

        if (isAligned) {
          // User is aligned - track brief confirmation period for stability
          if (alignedStartTimeRef.current === null) {
            alignedStartTimeRef.current = currentTime;
          } else {
            const alignedDuration = currentTime - alignedStartTimeRef.current;
            // Advance immediately after brief confirmation (no time delay requirement)
            if (alignedDuration >= ADVANCE_CONFIRMATION_MS) {
              markWaypointReached();
              // Small delay before advancing to allow feedback to complete
              setTimeout(() => {
                advanceToNextWaypoint();
                alignedStartTimeRef.current = null;
                if (advanceIntervalRef.current) {
                  clearInterval(advanceIntervalRef.current);
                  advanceIntervalRef.current = null;
                }
              }, 300);
            }
          }
        } else {
          // User is not aligned - reset timer
          alignedStartTimeRef.current = null;
        }
      }, ALIGNMENT_CHECK_INTERVAL);
    } else {
      // Handle waypoints without target heading: use heading change detection
      // Detects when user has moved/reached position by tracking heading changes
      // When heading changes significantly and stabilizes, assume user reached waypoint
      if (initialHeadingRef.current === null && heading !== null) {
        initialHeadingRef.current = heading;
        lastHeadingRef.current = heading;
      }

      advanceIntervalRef.current = setInterval(() => {
        if (heading === null || lastHeadingRef.current === null) {
          return;
        }

        // Calculate heading change from initial heading when waypoint started
        const headingChange = initialHeadingRef.current !== null
          ? Math.abs(normalizeAngleDiff(heading, initialHeadingRef.current))
          : 0;

        // Calculate recent heading change (from last check)
        const recentChange = Math.abs(normalizeAngleDiff(heading, lastHeadingRef.current));

        // If heading has changed significantly, user may have reached waypoint and turned
        if (headingChange >= HEADING_CHANGE_THRESHOLD && !headingChangeDetectedRef.current) {
          headingChangeDetectedRef.current = true;
          headingStableSinceRef.current = Date.now();
        }

        // If significant change detected, wait for heading to stabilize
        if (headingChangeDetectedRef.current && headingStableSinceRef.current !== null) {
          // Check if heading is stable (not changing much)
          if (recentChange < 5) { // Heading change less than 5 degrees = stable
            const stableDuration = Date.now() - headingStableSinceRef.current;
            
            // After heading is stable for required duration, advance
            if (stableDuration >= HEADING_STABLE_DURATION) {
              markWaypointReached();
              setTimeout(() => {
                advanceToNextWaypoint();
                if (advanceIntervalRef.current) {
                  clearInterval(advanceIntervalRef.current);
                  advanceIntervalRef.current = null;
                }
              }, 300);
            }
          } else {
            // Heading still changing - reset stable timer
            headingStableSinceRef.current = Date.now();
          }
        }

        lastHeadingRef.current = heading;
      }, 300); // Check every 300ms for heading changes
    }

    // Cleanup interval when dependencies change
    return () => {
      if (advanceIntervalRef.current) {
        clearInterval(advanceIntervalRef.current);
        advanceIntervalRef.current = null;
      }
    };
  }, [
    alignment.isAligned,
    alignment.targetHeading,
    alignment.isFinalWaypoint,
    navigationState.isActive,
    alignment.isActive,
    alignment.waypointIndex,
    heading,
    alignmentThresholdDeg,
    markWaypointReached,
    advanceToNextWaypoint,
    getCurrentWaypoint,
    currentWaypoint,
  ]);

  return alignment;
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

