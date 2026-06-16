import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Swal from 'sweetalert2';
import type { Guardian, ReservationPayload, ReservationSummary, Schedule } from '../types';
import { formatChileDateLabel, formatChileTime, toChileDateKey } from '../utils/datetime';
import '../styles/spot-selector.css';

type SpotSelectorProps = {
  schedules: Schedule[];
  guardian: Guardian;
  onSubmit: (payload: ReservationPayload) => Promise<boolean>;
  submitting?: boolean;
  reservedDateKeys?: string[];
  reservationsByDate?: Record<string, ReservationSummary>;
  preferredDateKey?: string;
  readOnly?: boolean;
};

export function SpotSelector({
  schedules,
  guardian,
  onSubmit,
  submitting = false,
  reservedDateKeys = [],
  reservationsByDate = {},
  preferredDateKey,
  readOnly = false,
}: SpotSelectorProps) {
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [guardianParticipates, setGuardianParticipates] = useState(true);
  const [selectedDependents, setSelectedDependents] = useState<string[]>([]);
  const totalSpotsByScheduleRef = useRef<Record<string, number>>({});

  const availableDateKeys = useMemo(() => {
    const now = Date.now();
    const uniqueDates = Array.from(
      new Set(
        schedules
          .filter((schedule) => new Date(schedule.startTime).getTime() > now)
          .map((schedule) => toChileDateKey(schedule.startTime)),
      ),
    );
    return uniqueDates.sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    if (!selectedDateKey) return [];
    const now = Date.now();
    return schedules.filter(
      (schedule) =>
        toChileDateKey(schedule.startTime) === selectedDateKey && new Date(schedule.startTime).getTime() > now,
    );
  }, [schedules, selectedDateKey]);

  useEffect(() => {
    schedules.forEach((schedule) => {
      const trackedTotal = totalSpotsByScheduleRef.current[schedule._id];
      if (!trackedTotal || schedule.availableSpots > trackedTotal) {
        totalSpotsByScheduleRef.current[schedule._id] = schedule.availableSpots;
      }
    });
  }, [schedules]);

  useEffect(() => {
    if (availableDateKeys.length === 0) {
      setSelectedDateKey('');
      return;
    }

    if (preferredDateKey && availableDateKeys.includes(preferredDateKey)) {
      setSelectedDateKey(preferredDateKey);
      return;
    }

    if (!selectedDateKey || !availableDateKeys.includes(selectedDateKey)) {
      setSelectedDateKey(availableDateKeys[0]);
    }
  }, [availableDateKeys, preferredDateKey, selectedDateKey]);

  useEffect(() => {
    setSelectedScheduleId('');
    setSelectedDependents([]);
    setIsAttendanceModalOpen(false);
  }, [selectedDateKey]);

  const selectedSchedule = useMemo(
    () => filteredSchedules.find((schedule) => schedule._id === selectedScheduleId) ?? null,
    [filteredSchedules, selectedScheduleId],
  );

  const hasReservationForSelectedDate = Boolean(selectedDateKey && reservedDateKeys.includes(selectedDateKey));
  const reservedEntry = selectedDateKey ? reservationsByDate[selectedDateKey] : undefined;

  const reservedScheduleId =
    reservedEntry && typeof reservedEntry.scheduleId === 'object'
      ? reservedEntry.scheduleId?._id
      : reservedEntry?.scheduleId;

  const reservedSchedule = reservedScheduleId
    ? schedules.find((schedule) => schedule._id === reservedScheduleId)
    : undefined;

  const reservedTimeRange = reservedSchedule
    ? `${formatChileTime(reservedSchedule.startTime)}-${formatChileTime(
        new Date(new Date(reservedSchedule.startTime).getTime() + reservedSchedule.durationMinutes * 60_000),
      )}`
    : 'Horario ya confirmado';

  const companionNames = reservedEntry?.attendingDependents?.map((dependent) => dependent.name) ?? [];
  const companionLabel = companionNames.length > 0 ? companionNames.join(', ') : 'Sin acompanantes';
  const guardianLabel = reservedEntry?.guardianParticipates === false ? 'No participa' : guardian.name;

  const spotsToConsume = (guardianParticipates ? 1 : 0) + selectedDependents.length;
  const isOverCapacity = selectedSchedule ? spotsToConsume > selectedSchedule.availableSpots : false;
  const isZeroSelection = spotsToConsume === 0;

  const handleDependentToggle = (dependentId: string) => {
    if (!selectedSchedule) return;

    setSelectedDependents((prev) => {
      const isSelected = prev.includes(dependentId);
      if (isSelected) {
        return prev.filter((id) => id !== dependentId);
      }

      if (prev.length >= selectedSchedule.maxDependentsPerReservation) {
        return prev;
      }

      return [...prev, dependentId];
    });
  };

  const handleSubmit = async () => {
    if (submitting || readOnly) return;

    if (isZeroSelection) {
      void Swal.fire({
        icon: 'warning',
        title: 'Selección requerida',
        text: 'Debes seleccionar al menos un asistente.',
        confirmButtonColor: '#1E3A8A',
      });
      return;
    }

    if (isOverCapacity) {
      void Swal.fire({
        icon: 'error',
        title: 'Sobrecupo',
        text: 'No hay suficientes cupos disponibles para tu selección.',
        confirmButtonColor: '#1E3A8A',
      });
      return;
    }

    if (!selectedSchedule) {
      void Swal.fire({
        icon: 'warning',
        title: 'Horario no válido',
        text: 'Selecciona un horario válido para continuar.',
        confirmButtonColor: '#1E3A8A',
      });
      return;
    }

    if (hasReservationForSelectedDate) {
      void Swal.fire({
        icon: 'warning',
        title: 'Dia ya reservado',
        text: 'Ya tienes una reserva activa para este dia. Selecciona otra fecha.',
        confirmButtonColor: '#1E3A8A',
      });
      return;
    }

    const wasCreated = await onSubmit({
      scheduleId: selectedSchedule._id,
      guardianId: guardian._id,
      guardianParticipates,
      attendingDependents: guardian.dependents
        .filter((dependent) => selectedDependents.includes(dependent._id))
        .map((dependent) => ({ name: dependent.name, rut: dependent.rut })),
    });

    if (wasCreated) {
      setIsAttendanceModalOpen(false);
    }
  };

  return (
    <Paper elevation={2} className="spot-card">
      <Box className="spot-date-wrap">
        <FormControl fullWidth className="spot-date-control">
          <InputLabel id="schedule-date-label">Fecha de reserva</InputLabel>
          <Select
            labelId="schedule-date-label"
            value={selectedDateKey}
            label="Fecha de reserva"
            onChange={(event) => setSelectedDateKey(event.target.value)}
          >
            {availableDateKeys.map((dateKey) => (
              <MenuItem key={dateKey} value={dateKey}>
                 {formatChileDateLabel(dateKey)}
               </MenuItem>
             ))}
           </Select>
        </FormControl>

        {readOnly ? (
          <Box className="spot-active-reservation-banner spot-readonly-banner" role="status" aria-live="polite">
            <WarningAmberRoundedIcon className="spot-active-reservation-icon" />
            <Box>
              <Typography className="spot-active-reservation-title">
                Modo solo lectura: revisa horarios y cupos. Inicia sesion para reservar.
              </Typography>
            </Box>
          </Box>
        ) : null}
        <Typography color="text.secondary" className="spot-helper-text">
          Selecciona el horario que deseas.
        </Typography>

        {hasReservationForSelectedDate ? (
          <Box className="spot-active-reservation-banner spot-reserved-banner" role="status" aria-live="polite">
            <WarningAmberRoundedIcon className="spot-active-reservation-icon" />
            <Box>
              <Typography className="spot-active-reservation-title">iTienes una reserva activa!</Typography>
              <Typography className="spot-active-reservation-line">Fecha: {formatChileDateLabel(selectedDateKey)}</Typography>
              <Typography className="spot-active-reservation-line">Turno: {reservedTimeRange}</Typography>
              <Typography className="spot-active-reservation-line">Apoderado: {guardianLabel}</Typography>
              <Typography className="spot-active-reservation-line">Acompanantes: {companionLabel}</Typography>
            </Box>
          </Box>
        ) : null}
      </Box>

      <Box className="spot-schedule-grid">
        {filteredSchedules.map((schedule) => {
          const date = new Date(schedule.startTime);
          const isSoldOut = schedule.availableSpots <= 0;
          const isSelected = selectedScheduleId === schedule._id;
          const trackedTotalSpots = totalSpotsByScheduleRef.current[schedule._id] ?? schedule.availableSpots;
          const effectiveTotalCapacity =
            schedule.totalCapacity > 0 ? schedule.totalCapacity : trackedTotalSpots;
          const remainingRatio =
            effectiveTotalCapacity > 0 ? schedule.availableSpots / effectiveTotalCapacity : 0;

          let availabilityTone: 'high' | 'medium' | 'low' | 'soldout' = 'high';
          if (isSoldOut) {
            availabilityTone = 'soldout';
          } else if (remainingRatio <= 1 / 3) {
            availabilityTone = 'low';
          } else if (remainingRatio <= 2 / 3) {
            availabilityTone = 'medium';
          }

          return (
            <Button
              key={schedule._id}
               variant={isSelected ? 'contained' : 'outlined'}
               color={isSoldOut ? 'inherit' : 'primary'}
               disabled={isSoldOut || hasReservationForSelectedDate || readOnly}
               onClick={() => {
                 if (readOnly) return;
                 setSelectedScheduleId(schedule._id);
                 setGuardianParticipates(true);
                 setSelectedDependents(
                  guardian.dependents
                    .slice(0, schedule.maxDependentsPerReservation)
                    .map((dependent) => dependent._id),
                );
                setIsAttendanceModalOpen(true);
              }}
              className={`spot-schedule-btn ${isSoldOut ? 'spot-schedule-btn-soldout' : ''}`}
            >
              <Box className="spot-schedule-content">
                <Box className="spot-time-column">
                  <Typography variant="h6" component="span" className="spot-time-label">
                    {formatChileTime(date)}
                  </Typography>
                  {isSoldOut ? (
                    <Typography variant="caption" component="span" className="spot-soldout-label">
                      AGOTADO
                    </Typography>
                  ) : null}
                </Box>

                <Box className="spot-cupos-column">
                  <Box className={`spot-cupos-pill spot-cupos-pill-${availabilityTone}`}>
                    <Typography variant="caption" component="span" className="spot-cupos-title-in-pill">
                      Cupos
                    </Typography>
                    <span className="spot-cupos-value">{schedule.availableSpots}</span>
                  </Box>
                </Box>
              </Box>
            </Button>
          );
        })}
      </Box>

      {filteredSchedules.length === 0 ? (
        <Typography align="center" color="text.secondary">
          No hay horarios disponibles para la fecha seleccionada.
        </Typography>
      ) : null}

      {selectedSchedule && !readOnly ? (
        <Dialog
          open={isAttendanceModalOpen}
          onClose={submitting ? undefined : () => setIsAttendanceModalOpen(false)}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { className: 'spot-dialog-paper' } }}
        >
          {submitting ? (
            <Box className="spot-dialog-loading-overlay">
              <Box className="spot-dialog-loading-card">
                <CircularProgress size={40} />
                <Typography variant="body1">Confirmando reserva...</Typography>
              </Box>
            </Box>
          ) : null}

          <DialogTitle>Selecciona quienes asisten.</DialogTitle>
          <DialogContent>
            <Box className="spot-attendance-box">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={guardianParticipates}
                    onChange={(event) => setGuardianParticipates(event.target.checked)}
                  />
                }
                label={`Yo (${guardian.name})`}
              />

              <Divider className="spot-divider" />

              {guardian.dependents.map((dependent) => {
                const isSelected = selectedDependents.includes(dependent._id);
                const maxReached = selectedDependents.length >= selectedSchedule.maxDependentsPerReservation;

                return (
                  <FormControlLabel
                    key={dependent._id}
                    control={
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleDependentToggle(dependent._id)}
                        disabled={!isSelected && maxReached}
                      />
                    }
                    label={dependent.name}
                    className="spot-dependent-item"
                  />
                );
              })}

              {guardian.dependents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No tienes cargas registradas.
                </Typography>
              ) : null}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsAttendanceModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="contained" disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? 'Confirmando...' : 'Confirmar'}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Paper>
  );
}

export default SpotSelector;
