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
import Swal from 'sweetalert2';
import type { Guardian, ReservationPayload, Schedule } from '../types';
import '../styles/spot-selector.css';

type SpotSelectorProps = {
  schedules: Schedule[];
  guardian: Guardian;
  onSubmit: (payload: ReservationPayload) => void;
  submitting?: boolean;
};

export function SpotSelector({
  schedules,
  guardian,
  onSubmit,
  submitting = false,
}: SpotSelectorProps) {
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [guardianParticipates, setGuardianParticipates] = useState(true);
  const [selectedDependents, setSelectedDependents] = useState<string[]>([]);
  const totalSpotsByScheduleRef = useRef<Record<string, number>>({});

  const getDateKey = (startTime: string) => {
    const date = new Date(startTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date
      .toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      .replace(/^\w/, (char) => char.toUpperCase());
  };

  const availableDateKeys = useMemo(() => {
    const now = Date.now();
    const uniqueDates = Array.from(
      new Set(
        schedules
          .filter((schedule) => new Date(schedule.startTime).getTime() > now)
          .map((schedule) => getDateKey(schedule.startTime)),
      ),
    );
    return uniqueDates.sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    if (!selectedDateKey) return [];
    const now = Date.now();
    return schedules.filter(
      (schedule) =>
        getDateKey(schedule.startTime) === selectedDateKey && new Date(schedule.startTime).getTime() > now,
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

    if (!selectedDateKey || !availableDateKeys.includes(selectedDateKey)) {
      setSelectedDateKey(availableDateKeys[0]);
    }
  }, [availableDateKeys, selectedDateKey]);

  useEffect(() => {
    setSelectedScheduleId('');
    setSelectedDependents([]);
    setIsAttendanceModalOpen(false);
  }, [selectedDateKey]);

  const selectedSchedule = useMemo(
    () => filteredSchedules.find((schedule) => schedule._id === selectedScheduleId) ?? null,
    [filteredSchedules, selectedScheduleId],
  );

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

  const handleSubmit = () => {
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

    onSubmit({
      scheduleId: selectedSchedule._id,
      guardianId: guardian._id,
      guardianParticipates,
      attendingDependents: guardian.dependents
        .filter((dependent) => selectedDependents.includes(dependent._id))
        .map((dependent) => ({ name: dependent.name, rut: dependent.rut })),
    });

    setIsAttendanceModalOpen(false);
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
                {formatDateLabel(dateKey)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography color="text.secondary" className="spot-helper-text">
          Selecciona el horario que deseas.
        </Typography>
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
              disabled={isSoldOut}
              onClick={() => {
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
                    {date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
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

      {selectedSchedule ? (
        <Dialog
          open={isAttendanceModalOpen}
          onClose={submitting ? undefined : () => setIsAttendanceModalOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Selecciona quienes asisten.</DialogTitle>
          <DialogContent>
            <Box className="spot-attendance-box">
              {submitting ? (
                <Box className="spot-modal-loading-overlay">
                  <CircularProgress size={28} />
                  <Typography variant="body2">Confirmando reserva...</Typography>
                </Box>
              ) : null}

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
            <Button variant="contained" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Confirmando...' : 'Confirmar'}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Paper>
  );
}

export default SpotSelector;
