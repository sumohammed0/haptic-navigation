/**
 * Step Counter Hook
 * 
 * Tracks step count using device pedometer.
 * Uses expo-sensors Pedometer API for automatic step detection.
 */

import { useEffect, useState, useRef } from 'react';

export function useStepCounter(isActive: boolean): number {
  const [stepCount, setStepCount] = useState<number>(0);
  const initialStepCountRef = useRef<number | null>(null);
  const subscriptionRef = useRef<any>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Reset when not active
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      initialStepCountRef.current = null;
      setStepCount(0);
      return;
    }

    // Try to use Pedometer from expo-sensors
    const startStepTracking = async () => {
      try {
        const { Pedometer } = await import('expo-sensors');
        
        const isAvailable = await Pedometer.isAvailableAsync();
        if (!isAvailable) {
          console.warn('Pedometer not available on this device');
          setStepCount(0);
          return;
        }

        // Get initial step count from start of day
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        try {
          const startSteps = await Pedometer.getStepCountAsync(startDate, new Date());
          if (initialStepCountRef.current === null) {
            initialStepCountRef.current = startSteps.steps || 0;
          }
        } catch (error) {
          console.warn('Could not get initial step count:', error);
          initialStepCountRef.current = 0;
        }

        // Watch for step count updates
        subscriptionRef.current = Pedometer.watchStepCount((result) => {
          if (initialStepCountRef.current !== null) {
            // Calculate steps since tracking started
            const currentTotal = result.steps || 0;
            const stepsSinceStart = Math.max(0, currentTotal - initialStepCountRef.current);
            setStepCount(stepsSinceStart);
          }
        });

        // Also periodically check step count to ensure we stay updated
        checkIntervalRef.current = setInterval(async () => {
          try {
            const currentSteps = await Pedometer.getStepCountAsync(startDate, new Date());
            if (initialStepCountRef.current !== null) {
              const stepsSinceStart = Math.max(0, (currentSteps.steps || 0) - initialStepCountRef.current);
              setStepCount(stepsSinceStart);
            }
          } catch (error) {
            // Silently handle periodic check errors
          }
        }, 2000); // Check every 2 seconds
      } catch (error) {
        // If expo-sensors not installed or Pedometer not available, use 0
        console.warn('Pedometer not available:', error);
        setStepCount(0);
      }
    };

    startStepTracking();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isActive]);

  return stepCount;
}

