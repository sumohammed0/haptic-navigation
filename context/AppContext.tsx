import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Participant = {
  participantId: string;
  age?: number;
  gender?: string;
  visionStatus?: 'blind' | 'low_vision' | 'sighted_control';
  mobilityAid?: 'cane' | 'guide_dog' | 'none';
  createdAt: number;
};

export type FeedbackMode = 'audio' | 'static_haptic' | 'dynamic_haptic' | 'step_based';

/**
 * Indoor navigation waypoint/calibration point.
 * Researcher logs these during calibration by walking to key spots and recording
 * the direction instruction the user should follow from that location.
 */
export type NavigationWaypoint = {
  waypointId: string;
  /** Sequential order in the navigation path (0-based) */
  order: number;
  /** Descriptive name or location identifier */
  name?: string;
  /** The direction instruction for the user at this waypoint (e.g., "Turn left", "Go straight", "Turn right 90 degrees") */
  direction: string;
  /** Optional: Heading in degrees the user should face (0-360) */
  targetHeading?: number;
  /** Number of steps required to reach the next waypoint from this one */
  stepCountToNext?: number;
  /** Timestamp when waypoint was logged */
  createdAt: number;
};

/**
 * Navigation route consisting of a sequence of waypoints.
 * Created during calibration by the researcher.
 */
export type NavigationRoute = {
  routeId: string;
  routeName: string;
  waypoints: NavigationWaypoint[];
  /** Task this route is associated with */
  taskType?: 'red_dot' | 'object_search';
  createdAt: number;
  updatedAt: number;
};

/**
 * Active navigation session state.
 * Tracks current position in the waypoint sequence and navigation status.
 */
export type NavigationState = {
  /** ID of the active route */
  routeId?: string;
  /** Current waypoint index (0-based) */
  currentWaypointIndex: number;
  /** Whether navigation is currently active */
  isActive: boolean;
  /** Current feedback mode being used */
  feedbackMode?: FeedbackMode;
  /** Whether user has reached the current waypoint */
  reachedCurrentWaypoint: boolean;
  /** Current step count for the current segment */
  currentStepCount: number;
};

export type Session = {
  sessionId: string;
  participantId: string;
  feedbackMode: FeedbackMode;
  stage: 'red_dot' | 'object_search';
  startTime?: number;
  endTime?: number;
  completionStatus?: 'completed' | 'incomplete';
  completionTimeSeconds?: number;
  navigationErrors?: number;
  objectFound?: boolean;
  searchDurationSeconds?: number;
  /** Route ID used for this session */
  routeId?: string;
  createdAt: number;
};

export type SurveyResponse = {
  responseId: string;
  sessionId: string;
  easeOfUse: number;
  clarityOfGuidance: number;
  spatialConfidence: number;
  feedbackText?: string;
  createdAt: number;
};

type AppContextValue = {
  participants: Participant[];
  sessions: Session[];
  surveys: SurveyResponse[];
  /** Indoor navigation routes/calibrations */
  routes: NavigationRoute[];
  /** Current active navigation state */
  navigationState: NavigationState;
  settings: {
    useTrueNorth: boolean;
    alignThresholdDeg: number;
    /** Deprecated: kept for compatibility, but indoor navigation uses waypoints instead */
    targetLat?: number;
    targetLon?: number;
    hasCalibrated?: boolean;
    calibrationPrompted?: boolean;
  };
  addParticipant: (p: Omit<Participant, 'participantId' | 'createdAt'>) => Participant;
  addSession: (s: Omit<Session, 'sessionId' | 'createdAt'>) => Session;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  addSurvey: (r: Omit<SurveyResponse, 'responseId' | 'createdAt'>) => SurveyResponse;
  exportCsv: () => Promise<string>;
  updateSettings: (updates: Partial<AppContextValue['settings']>) => void;
  // Navigation route management
  addRoute: (r: Omit<NavigationRoute, 'routeId' | 'createdAt' | 'updatedAt'>) => NavigationRoute;
  updateRoute: (routeId: string, updates: Partial<NavigationRoute>) => void;
  deleteRoute: (routeId: string) => void;
  getRoute: (routeId: string) => NavigationRoute | undefined;
  // Navigation state management
  startNavigation: (routeId: string, feedbackMode: FeedbackMode) => void;
  stopNavigation: () => void;
  advanceToNextWaypoint: () => void;
  markWaypointReached: () => void;
  getCurrentWaypoint: () => NavigationWaypoint | undefined;
  incrementStepCount: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [routes, setRoutes] = useState<NavigationRoute[]>([]);
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentWaypointIndex: 0,
    isActive: false,
    reachedCurrentWaypoint: false,
    currentStepCount: 0,
  });
  const [settings, setSettings] = useState<{ useTrueNorth: boolean; alignThresholdDeg: number; targetLat?: number; targetLon?: number; hasCalibrated?: boolean; calibrationPrompted?: boolean }>({ useTrueNorth: true, alignThresholdDeg: 10, hasCalibrated: false, calibrationPrompted: false });

  const addParticipant: AppContextValue['addParticipant'] = useCallback((p) => {
    const newParticipant: Participant = {
      participantId: generateUuidV4(),
      createdAt: Date.now(),
      ...p,
    };
    setParticipants((prev) => [...prev, newParticipant]);
    return newParticipant;
  }, []);

  const addSession: AppContextValue['addSession'] = useCallback((s) => {
    const newSession: Session = {
      sessionId: generateUuidV4(),
      createdAt: Date.now(),
      ...s,
    };
    setSessions((prev) => [...prev, newSession]);
    return newSession;
  }, []);

  const updateSession: AppContextValue['updateSession'] = useCallback((sessionId, updates) => {
    setSessions((prev) => prev.map((s) => (s.sessionId === sessionId ? { ...s, ...updates } : s)));
  }, []);

  const addSurvey: AppContextValue['addSurvey'] = useCallback((r) => {
    const newResponse: SurveyResponse = {
      responseId: generateUuidV4(),
      createdAt: Date.now(),
      ...r,
    };
    setSurveys((prev) => [...prev, newResponse]);
    return newResponse;
  }, []);

  const updateSettings: AppContextValue['updateSettings'] = useCallback((updates) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const exportCsv = useCallback(async () => {
    const header = [
      'session_id',
      'participant_id',
      'feedback_mode',
      'stage',
      'start_time',
      'end_time',
      'completion_status',
      'completion_time_seconds',
      'navigation_errors',
      'object_found',
      'search_duration_seconds',
      'route_id',
    ];
    const lines = [header.join(',')];
    sessions.forEach((s) => {
      lines.push(
        [
          s.sessionId,
          s.participantId,
          s.feedbackMode,
          s.stage,
          s.startTime ?? '',
          s.endTime ?? '',
          s.completionStatus ?? '',
          s.completionTimeSeconds ?? '',
          s.navigationErrors ?? '',
          s.objectFound ?? '',
          s.searchDurationSeconds ?? '',
          s.routeId ?? '',
        ].join(',')
      );
    });
    return lines.join('\n');
  }, [sessions]);

  // Navigation route management
  const addRoute: AppContextValue['addRoute'] = useCallback((r) => {
    const now = Date.now();
    const newRoute: NavigationRoute = {
      routeId: generateUuidV4(),
      createdAt: now,
      updatedAt: now,
      ...r,
    };
    setRoutes((prev) => [...prev, newRoute]);
    return newRoute;
  }, []);

  const updateRoute: AppContextValue['updateRoute'] = useCallback((routeId, updates) => {
    setRoutes((prev) =>
      prev.map((r) =>
        r.routeId === routeId
          ? { ...r, ...updates, updatedAt: Date.now() }
          : r
      )
    );
  }, []);

  const deleteRoute: AppContextValue['deleteRoute'] = useCallback((routeId) => {
    setRoutes((prev) => prev.filter((r) => r.routeId !== routeId));
  }, []);

  const getRoute: AppContextValue['getRoute'] = useCallback(
    (routeId) => routes.find((r) => r.routeId === routeId),
    [routes]
  );

  // Navigation state management
  const startNavigation: AppContextValue['startNavigation'] = useCallback(
    (routeId, feedbackMode) => {
      const route = routes.find((r) => r.routeId === routeId);
      if (!route || route.waypoints.length === 0) {
        console.warn('Cannot start navigation: route not found or has no waypoints');
        return;
      }
      setNavigationState({
        routeId,
        currentWaypointIndex: 0,
        isActive: true,
        feedbackMode,
        reachedCurrentWaypoint: false,
        currentStepCount: 0,
      });
    },
    [routes]
  );

  const stopNavigation: AppContextValue['stopNavigation'] = useCallback(() => {
    setNavigationState((prev) => ({
      ...prev,
      isActive: false,
      reachedCurrentWaypoint: false,
      currentStepCount: 0,
    }));
  }, []);

  const advanceToNextWaypoint: AppContextValue['advanceToNextWaypoint'] = useCallback(() => {
    setNavigationState((prev) => {
      if (!prev.routeId) return prev;
      const route = routes.find((r) => r.routeId === prev.routeId);
      if (!route) return prev;
      const nextIndex = prev.currentWaypointIndex + 1;
      if (nextIndex >= route.waypoints.length) {
        // Reached end of route
        return {
          ...prev,
          isActive: false,
          reachedCurrentWaypoint: false,
        };
      }
      return {
        ...prev,
        currentWaypointIndex: nextIndex,
        reachedCurrentWaypoint: false,
        currentStepCount: 0,
      };
    });
  }, [routes]);

  const markWaypointReached: AppContextValue['markWaypointReached'] = useCallback(() => {
    setNavigationState((prev) => ({
      ...prev,
      reachedCurrentWaypoint: true,
    }));
  }, []);

  const getCurrentWaypoint: AppContextValue['getCurrentWaypoint'] = useCallback(() => {
    if (!navigationState.routeId || !navigationState.isActive) return undefined;
    const route = routes.find((r) => r.routeId === navigationState.routeId);
    if (!route) return undefined;
    return route.waypoints[navigationState.currentWaypointIndex];
  }, [navigationState, routes]);

  const incrementStepCount: AppContextValue['incrementStepCount'] = useCallback(() => {
    setNavigationState((prev) => ({
      ...prev,
      currentStepCount: prev.currentStepCount + 1,
    }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      participants,
      sessions,
      surveys,
      routes,
      navigationState,
      settings,
      addParticipant,
      addSession,
      updateSession,
      addSurvey,
      exportCsv,
      updateSettings,
      addRoute,
      updateRoute,
      deleteRoute,
      getRoute,
      startNavigation,
      stopNavigation,
      advanceToNextWaypoint,
      markWaypointReached,
      getCurrentWaypoint,
      incrementStepCount,
    }),
    [
      participants,
      sessions,
      surveys,
      routes,
      navigationState,
      settings,
      addParticipant,
      addSession,
      updateSession,
      addSurvey,
      exportCsv,
      updateSettings,
      addRoute,
      updateRoute,
      deleteRoute,
      getRoute,
      startNavigation,
      stopNavigation,
      advanceToNextWaypoint,
      markWaypointReached,
      getCurrentWaypoint,
      incrementStepCount,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

function generateUuidV4(): string {
  // RFC4122 version 4 compliant UUID generator without dependencies
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Set version and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = Array.from(bytes, toHex).join('');
  return (
    hex.substring(0, 8) +
    '-' +
    hex.substring(8, 12) +
    '-' +
    hex.substring(12, 16) +
    '-' +
    hex.substring(16, 20) +
    '-' +
    hex.substring(20)
  );
}


