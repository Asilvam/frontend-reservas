import { api } from '../services/api';
import axios from 'axios';

export type AdmissionEnterResponse =
  | {
      admitted: true;
      eventType: string;
      sessionId: string;
      expiresAt: string;
      writersActive: number;
    }
  | {
      admitted: false;
      eventType: string;
      sessionId: string;
      position: number;
      etaSec: number;
      retryAfterSec: number;
      writersActive: number;
      queueSize: number;
    };

export type AdmissionStatusResponse =
  | {
      status: 'WRITING';
      eventType: string;
      sessionId: string;
      remainingSec: number;
      writersActive: number;
    }
  | {
      status: 'WAITING';
      eventType: string;
      sessionId: string;
      position: number;
      queueSize: number;
      etaSec: number;
      retryAfterSec: number;
      writersActive: number;
    }
  | {
      status: 'PROCESSING';
      eventType: string;
      sessionId: string;
    }
  | {
      status: 'EXPIRED';
      eventType: string;
      sessionId: string;
    };

export type AdmissionSubmitResponse =
  | {
      success: true;
      eventType: string;
      sessionId: string;
      writingDurationSec?: number;
      avgWritingSec?: number;
    }
  | {
      success: false;
      reason: 'SESSION_EXPIRED';
    };

export async function enterAdmission(eventType: string) {
  try {
    const { data } = await api.post<AdmissionEnterResponse>('/admission/enter', {
      eventType,
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      const payload = error.response.data as { code?: string; message?: string; retryAfterSec?: number } | undefined;
      if (payload?.code === 'WAITLIST_FULL') {
        const waitlistFullError = new Error(payload.message || 'Sitio sin disponibilidad, intenta más tarde.') as Error & {
          code: string;
          retryAfterSec?: number;
        };
        waitlistFullError.code = 'WAITLIST_FULL';
        waitlistFullError.retryAfterSec = payload.retryAfterSec;
        throw waitlistFullError;
      }
    }
    throw error;
  }
}

export async function getAdmissionStatus(eventType: string, sessionId: string) {
  const { data } = await api.get<AdmissionStatusResponse>('/admission/status', {
    params: {
      eventType,
      sessionId,
    },
  });
  return data;
}

export async function submitAdmission(eventType: string, sessionId: string) {
  const { data } = await api.post<AdmissionSubmitResponse>('/admission/submit', {
    eventType,
    sessionId,
  });
  return data;
}

export async function leaveAdmission(eventType: string, sessionId: string) {
  await api.post('/admission/leave', {
    eventType,
    sessionId,
  });
}

export function formatEtaLabel(etaSec: number) {
  if (etaSec < 60) return 'menos de 1 minuto';
  const minutes = Math.ceil(etaSec / 60);
  if (minutes >= 10) return '10+ minutos';
  return `~${minutes} minuto${minutes === 1 ? '' : 's'}`;
}
