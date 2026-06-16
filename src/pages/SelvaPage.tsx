import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Stack } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { SpotSelector } from '../components/SpotSelector';
import { api, socket } from '../services/api';
import type { Guardian, ReservationPayload, ReservationSummary, Schedule } from '../types';
import { isValidDateKey, toChileDateKey } from '../utils/datetime';
import fondoImage from '../assets/Fondo.jpg';
import selvaWebHeader from '../assets/Selvaweb.png';
import institutionalLogos from '../assets/logos.png';
import '../styles/selva-page.css';

export function SelvaPage() {
  const [searchParams] = useSearchParams();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservedDateKeys, setReservedDateKeys] = useState<string[]>([]);
  const [reservationsByDate, setReservationsByDate] = useState<Record<string, ReservationSummary>>({});
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const isLoggedIn = Boolean(accessToken);
  const preferredDateParam = searchParams.get('date') ?? '';
  const preferredDateKey = isValidDateKey(preferredDateParam) ? preferredDateParam : undefined;

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
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
        const schedulesPromise = api.get<Schedule[]>('/schedules', { headers });
        const reservationsPromise = accessToken
          ? api.get<ReservationSummary[]>('/reservations', { headers })
          : Promise.resolve({ data: [] as ReservationSummary[] });

        const [{ data: schedulesData }, { data: reservationsData }] = await Promise.all([
          schedulesPromise,
          reservationsPromise,
        ]);

        setSchedules(schedulesData);

        const nextReservationsByDate = reservationsData.reduce<Record<string, ReservationSummary>>(
          (acc, reservation) => {
            const dateKey = toChileDateKey(reservation.reservationDay);
            acc[dateKey] = reservation;
            return acc;
          },
          {},
        );

        setReservedDateKeys(Object.keys(nextReservationsByDate));
        setReservationsByDate(nextReservationsByDate);
      } catch (error: unknown) {
        const status = getStatusCode(error);

        if ((status === 401 || status === 403) && accessToken) {
          try {
            const { data: publicSchedules } = await api.get<Schedule[]>('/schedules');
            setSchedules(publicSchedules);
            setReservedDateKeys([]);
            setReservationsByDate({});
            localStorage.removeItem('accessToken');
            setAccessToken(null);
            return;
          } catch {
            localStorage.removeItem('accessToken');
            setAccessToken(null);
            setSchedules([]);
            setReservedDateKeys([]);
            setReservationsByDate({});
            return;
          }
        }

        if ((status === 401 || status === 403) && !accessToken) {
          setSchedules([]);
          setReservedDateKeys([]);
          setReservationsByDate({});
          return;
        }

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
  }, [accessToken]);

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
      const selectedDateKey = toChileDateKey(selectedSchedule.startTime);
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
      await api.post('/reservations', payload, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      void Swal.fire({
        icon: 'success',
        title: 'Reserva confirmada',
        text: 'Tu reserva se confirmo con exito.',
        confirmButtonColor: '#1E3A8A',
      });

      if (selectedSchedule) {
        const selectedDateKey = toChileDateKey(selectedSchedule.startTime);
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

  const readOnlyGuardian: Guardian = {
    _id: 'guest',
    name: 'Invitado',
    rut: '',
    email: '',
    phone: '',
    dependents: [],
  };

  return (
    <Box className="selva-layout" style={{ backgroundImage: `url(${fondoImage})` }}>
      <Box className="selva-header-wrap">
        <Box component="img" src={selvaWebHeader} alt="Selva Viva" className="selva-header-image" />
      </Box>

      <Box className="selva-content-wrap">
        {loading ? (
          <Box className="selva-loading">
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {guardian || !isLoggedIn ? (
              <Box className="selva-selector-shell">
                <SpotSelector
                  schedules={schedules}
                  guardian={guardian ?? readOnlyGuardian}
                  onSubmit={handleReservationSubmit}
                  submitting={submitting}
                  reservedDateKeys={reservedDateKeys}
                  reservationsByDate={reservationsByDate}
                  preferredDateKey={preferredDateKey}
                  readOnly={!isLoggedIn}
                />
              </Box>
            ) : (
              <Alert severity="warning">No se encontro perfil de apoderado. Inicia sesion nuevamente.</Alert>
            )}
          </Stack>
        )}
      </Box>

      <Box className="selva-footer-wrap">
        <Box component="img" src={institutionalLogos} alt="Logos institucionales" className="selva-footer-logos" />
      </Box>
    </Box>
  );
}

export default SelvaPage;
