export interface Schedule {
  _id: string;
  startTime: string;
  durationMinutes: number;
  availableSpots: number;
  maxDependentsPerReservation: number;
  totalCapacity: number;
}

export interface Dependent {
  _id: string;
  name: string;
  rut: string;
  age: number;
}

export interface Guardian {
  _id: string;
  name: string;
  rut: string;
  email: string;
  phone: string;
  address?: string;
  commune?: string;
  villa?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  dependents: Dependent[];
  acceptMarketing?: boolean;
  acceptDataTerms?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
}

export interface ReservationPayload {
  scheduleId: string;
  guardianId: string;
  guardianParticipates: boolean;
  attendingDependents: { name: string; rut: string }[];
}

export interface ReservationSummary {
  _id: string;
  scheduleId: string | { _id: string };
  reservationDay: string;
  guardianParticipates?: boolean;
  attendingDependents?: { name: string; rut: string }[];
}

export interface CreateGuardianPayload {
  name: string;
  rut: string;
  email: string;
  phone: string;
  address?: string;
  commune?: string;
  villa?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  dependents: { name: string; rut: string; age: number }[];
  acceptMarketing?: boolean;
  acceptDataTerms?: boolean;
}
