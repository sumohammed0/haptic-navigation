import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Participant = {
  participantId: string;
  age?: number;
  gender?: string;
  visionStatus?: 'blind' | 'low_vision' | 'sighted_control';
  mobilityAid?: 'cane' | 'guide_dog' | 'none';
  createdAt: number;
};

export type FeedbackMode = 'audio' | 'static_haptic' | 'dynamic_haptic';

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
  settings: {
    useTrueNorth: boolean;
    alignThresholdDeg: number;
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
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
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
      responseId: String(uuid.v4()),
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
        ].join(',')
      );
    });
    return lines.join('\n');
  }, [sessions]);

  const value = useMemo<AppContextValue>(
    () => ({ participants, sessions, surveys, settings, addParticipant, addSession, updateSession, addSurvey, exportCsv, updateSettings }),
    [participants, sessions, surveys, settings, addParticipant, addSession, updateSession, addSurvey, exportCsv, updateSettings]
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


