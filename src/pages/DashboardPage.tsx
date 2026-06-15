import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Stack } from '@mui/material';
import Swal from 'sweetalert2';
import { SpotSelector } from '../components/SpotSelector';
import { api, socket } from '../services/api';
import type { Guardian, ReservationPayload, ReservationSummary, Schedule } from '../types';
import '../styles/dashboard-page.css';

export function DashboardPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservedDateKeys, setReservedDateKeys] = useState<string[]>([]);
  const [reservationsByDate, setReservationsByDate] = useState<Record<string, ReservationSummary>>({});

  const getDateKey = (dateValue: string | Date) => {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getBackendMessage = (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('response' in error)) return '';

    const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
    const rawMessage = data?.message;

    if (typeof rawMessage === 'string') return rawMessage;
    if (Array.isArray(rawMessage)) return rawMessage.filter((item) => typeof item === 'string').join(' ');

    return '';
  };

  const getStatusCode = (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;

    const status = (error as { response?: { status?: number } }).response?.status;
    return typeof status === 'number' ? status : undefined;
  };

  const getReservationErrorText = (error: unknown) => {
    const status = getStatusCode(error);
    const backendMessage = getBackendMessage(error);
    const normalizedMessage = backendMessage.toLowerCase();

    if (
      normalizedMessage.includes('ya tiene una reserva') ||
      normalizedMessage.includes('reserva para ese dia') ||
      normalizedMessage.includes('reserva para ese día')
    ) {
      return 'Ya tienes una reserva para este dia. Solo puedes reservar un horario por dia.';
    }

    if (normalizedMessage.includes('caducado') || normalizedMessage.includes('expir')) {
      return 'Este horario ya caduco. Selecciona otro horario disponible.';
    }

    if (normalizedMessage.includes('cupo') || normalizedMessage.includes('sobrecupo')) {
      return 'No quedan cupos suficientes para este horario. Actualiza y vuelve a intentar.';
    }

    if (status === 401 || status === 403) {
      return 'Tu sesion expiro. Inicia sesion nuevamente.';
    }

    if (status === 409) {
      return 'La reserva entro en conflicto con la disponibilidad actual. Intenta con otro horario.';
    }

    return backendMessage || 'No fue posible confirmar la reserva.';
  };

  useEffect(() => {
    const storedGuardian = localStorage.getItem('guardianProfile');
    if (storedGuardian) {
      try {
        setGuardian(JSON.parse(storedGuardian) as Guardian);
      } catch {
        localStorage.removeItem('guardianProfile');
      }
    }

    const fetchSchedules = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const [{ data: schedulesData }, { data: reservationsData }] = await Promise.all([
          api.get<Schedule[]>('/schedules', { headers }),
          api.get<ReservationSummary[]>('/reservations', { headers }),
        ]);

        setSchedules(schedulesData);

        const nextReservationsByDate = reservationsData.reduce<Record<string, ReservationSummary>>(
          (acc, reservation) => {
            const dateKey = getDateKey(reservation.reservationDay);
            acc[dateKey] = reservation;
            return acc;
          },
          {},
        );

        const nextReservedDateKeys = Object.keys(nextReservationsByDate);

        setReservedDateKeys(nextReservedDateKeys);
        setReservationsByDate(nextReservationsByDate);

      } catch (error: unknown) {
        const backendMessage = getBackendMessage(error);

        void Swal.fire({
          icon: 'error',
          title: 'Error',
          text: backendMessage || 'No se pudieron cargar los horarios.',
          confirmButtonColor: '#1E3A8A',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, []);

  useEffect(() => {
    socket.connect();

    const onSpotsUpdated = (payload: { scheduleId: string; remaining: number }) => {
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule._id === payload.scheduleId
            ? { ...schedule, availableSpots: payload.remaining }
            : schedule,
        ),
      );
    };

    socket.on('spots_updated', onSpotsUpdated);

    return () => {
      socket.off('spots_updated', onSpotsUpdated);
      socket.disconnect();
    };
  }, []);

  const handleReservationSubmit = async (payload: ReservationPayload): Promise<boolean> => {
    const selectedSchedule = schedules.find((schedule) => schedule._id === payload.scheduleId);
    if (selectedSchedule) {
      const selectedDateKey = getDateKey(selectedSchedule.startTime);
      if (reservedDateKeys.includes(selectedDateKey)) {
        void Swal.fire({
          icon: 'warning',
          title: 'Dia ya reservado',
          text: 'Ya tienes una reserva para ese dia. Selecciona otra fecha.',
          confirmButtonColor: '#1E3A8A',
        });
        return false;
      }
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('accessToken');

      await api.post('/reservations', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      void Swal.fire({
        icon: 'success',
        title: 'Reserva confirmada',
        text: 'Tu reserva se confirmo con exito.',
        confirmButtonColor: '#1E3A8A',
      });

      if (selectedSchedule) {
        const selectedDateKey = getDateKey(selectedSchedule.startTime);
        setReservedDateKeys((prev) => (prev.includes(selectedDateKey) ? prev : [...prev, selectedDateKey]));
        setReservationsByDate((prev) => ({
          ...prev,
          [selectedDateKey]: {
            _id: `temp-${selectedDateKey}`,
            scheduleId: payload.scheduleId,
            reservationDay: selectedDateKey,
          },
        }));
      }

      return true;
    } catch (error: unknown) {
      void Swal.fire({
        icon: 'error',
        title: 'Error al confirmar',
        text: getReservationErrorText(error),
        confirmButtonColor: '#1E3A8A',
      });

      return false;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box className="dashboard-loading">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" className="dashboard-layout">
      <Stack spacing={2}>
        {guardian ? (
          <SpotSelector
            schedules={schedules}
            guardian={guardian}
            onSubmit={handleReservationSubmit}
            submitting={submitting}
            reservedDateKeys={reservedDateKeys}
            reservationsByDate={reservationsByDate}
          />
        ) : (
          <Alert severity="warning">No se encontro perfil de apoderado. Inicia sesion nuevamente.</Alert>
        )}
      </Stack>
    </Container>
  );
}

export default DashboardPage;
