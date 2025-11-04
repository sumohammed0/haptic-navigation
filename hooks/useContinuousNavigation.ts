/**
 * Continuous Navigation Hook
 * 
 * Provides continuous directional guidance towards a target location or waypoint.
 * Unlike rigid waypoint-based navigation, this allows users to explore at their own pace
 * while receiving constant feedback about the correct direction.
 * 
 * Features:
 * - Continuous GPS-based direction calculation towards target
 * - Compass/heading alignment for directional guidance
 * - Distance calculation to target
 * - No automatic waypoint advancement - user navigates freely
 * - Works with target locations (GPS) or heading-based waypoints
 * 
 * Usage:
 * - Initialize with alignment threshold
 * - Provides continuous direction, distance, and alignment data
 * - User can explore environment while receiving guidance
 */

import { useApp } from '@/context/AppContext';
import * as Location from 'expo-location';
import { useEffect, useRef, useState, useCallback } from 'react';

export type ContinuousNavigationStatus = {
  /** Current waypoint/target index */
  targetIndex: number;
  /** Total number of targets */
  totalTargets: number;
  /** Current device location */
  currentLocation: { lat: number; lon: number } | null;
  /** Target location (GPS coordinates) */
  targetLocation: { lat: number; lon: number } | null;
  /** Distance to target in meters */
  distanceToTarget: number | null;
  /** Bearing to target in degrees (0-360) */
  bearingToTarget: number | null;
  /** Current device heading in degrees (0-360) */
  currentHeading: number | null;
  /** Target heading in degrees (0-360) - for heading-based waypoints */
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
  /** Whether user is close to target (within 5 meters) */
  isNearTarget: boolean;
};

const DEFAULT_ALIGNMENT_THRESHOLD = 15; // degrees
const LOCATION_UPDATE_INTERVAL = 500; // ms
const HEADING_UPDATE_INTERVAL = 200; // ms
const PROXIMITY_THRESHOLD = 5; // meters - consider "near" target

/**
 * Hook for continuous navigation towards target locations
 */
export function useContinuousNavigation(
  alignmentThresholdDeg: number = DEFAULT_ALIGNMENT_THRESHOLD
): ContinuousNavigationStatus {
  const {
    navigationState,
    getCurrentWaypoint,
    getRoute,
  } = useApp();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const lastHeadingUpdateRef = useRef<number>(0);

  // Request permissions and start location/heading updates
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted' && navigationState.isActive) {
        // Get initial location
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
        } catch (error) {
          console.warn('Could not get initial location:', error);
        }

        // Start location updates
        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_UPDATE_INTERVAL,
            distanceInterval: 1, // Update every meter
          },
          (loc) => {
            setLocation(loc);
            lastLocationUpdateRef.current = Date.now();
          }
        );

        // Start heading updates
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          const value = h.trueHeading ?? h.magHeading ?? null;
          setHeading(value);
          lastHeadingUpdateRef.current = Date.now();
        });
      }
    })();
    
    return () => {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
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
  const calculateStatus = useCallback((): ContinuousNavigationStatus => {
    if (!navigationState.isActive || !currentWaypoint || !route) {
      return {
        targetIndex: 0,
        totalTargets: 0,
        currentLocation: null,
        targetLocation: null,
        distanceToTarget: null,
        bearingToTarget: null,
        currentHeading: null,
        targetHeading: null,
        alignmentError: null,
        absoluteError: null,
        isAligned: false,
        isActive: false,
        isFinalTarget: false,
        direction: '',
        isNearTarget: false,
      };
    }

    const currentLoc = location?.coords
      ? { lat: location.coords.latitude, lon: location.coords.longitude }
      : null;

    // Check if waypoint has GPS coordinates
    const targetLoc = currentWaypoint.targetLatitude !== undefined && currentWaypoint.targetLongitude !== undefined
      ? { lat: currentWaypoint.targetLatitude, lon: currentWaypoint.targetLongitude }
      : null;

    // Calculate distance and bearing if we have both locations
    let distanceToTarget: number | null = null;
    let bearingToTarget: number | null = null;
    
    if (currentLoc && targetLoc) {
      distanceToTarget = calculateDistance(currentLoc, targetLoc);
      bearingToTarget = calculateBearing(currentLoc, targetLoc);
    }

    // Use target heading if available, otherwise use bearing to target
    const targetHeading = currentWaypoint.targetHeading ?? (bearingToTarget !== null ? bearingToTarget : null);
    
    let alignmentError: number | null = null;
    let absoluteError: number | null = null;
    let isAligned = false;

    if (targetHeading !== null && heading !== null) {
      alignmentError = normalizeAngleDiff(heading, targetHeading);
      absoluteError = Math.abs(alignmentError);
      isAligned = absoluteError <= alignmentThresholdDeg;
    } else if (targetHeading === null && targetLoc === null) {
      // No target heading or location - consider aligned (direction-based only)
      isAligned = true;
    }

    const isNearTarget = distanceToTarget !== null && distanceToTarget <= PROXIMITY_THRESHOLD;

    return {
      targetIndex: navigationState.currentWaypointIndex,
      totalTargets: route.waypoints.length,
      currentLocation: currentLoc,
      targetLocation: targetLoc,
      distanceToTarget,
      bearingToTarget,
      currentHeading: heading,
      targetHeading,
      alignmentError,
      absoluteError,
      isAligned,
      isActive: true,
      isFinalTarget: navigationState.currentWaypointIndex === route.waypoints.length - 1,
      direction: currentWaypoint.direction,
      isNearTarget,
    };
  }, [
    navigationState,
    currentWaypoint,
    route,
    location,
    heading,
    alignmentThresholdDeg,
    getCurrentWaypoint,
    getRoute,
  ]);

  return calculateStatus();
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing from one coordinate to another in degrees (0-360)
 */
function calculateBearing(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);
  return (bearing + 360) % 360;
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

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

