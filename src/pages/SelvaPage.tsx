import { Add, DeleteOutlined, ArrowBack, ArrowForward, CheckCircle } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api, socket } from '../services/api';
import type { CreateGuardianPayload, Schedule, Guardian } from '../types';
import { isValidDateKey, toChileDateKey, formatChileDateLabel, formatChileTime } from '../utils/datetime';
import fondoImage from '../assets/Fondo.jpg';
import selvaWebHeader from '../assets/Selvaweb.png';
import institutionalLogos from '../assets/logos.png';
import '../styles/selva-page.css';
import '../styles/spot-selector.css';

const MAX_DEPENDENTS = 3;

type DependentFormItem = {
  name: string;
  rut: string;
  age: string;
};

const EMPTY_DEPENDENT: DependentFormItem = { name: '', rut: '', age: '' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHILEAN_MOBILE_REGEX = /^\d{8}$/;
const CHILEAN_RUT_FORMAT_REGEX = /^\d+-[\dK]$/i;

function normalizeRut(rawRut: string) {
  return rawRut.replace(/-/g, '').trim().toUpperCase();
}

function formatRut(value: string) {
  const clean = value.replace(/[^0-9kK]/g, '').slice(0, 9);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean.toUpperCase();
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  return `${body}-${dv}`;
}

function isValidChileanRut(rawRut: string) {
  const rutValue = rawRut.trim().toUpperCase();
  if (!CHILEAN_RUT_FORMAT_REGEX.test(rutValue)) return false;

  const cleanRut = normalizeRut(rutValue);
  if (!/^\d+[\dK]$/.test(cleanRut)) return false;

  const body = cleanRut.slice(0, -1);
  const providedDv = cleanRut.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  return providedDv === expectedDv;
}

export function SelvaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Wizard state
  const [step, setStep] = useState(1); // 1: Datos, 2: Horario, 3: Resumen

  // Form states (Step 1)
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [isAccompanied, setIsAccompanied] = useState(false);
  const [dependents, setDependents] = useState<DependentFormItem[]>([{ ...EMPTY_DEPENDENT }]);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [acceptDataTerms, setAcceptDataTerms] = useState(false);

  // Schedules state (Step 2)
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const preferredDateParam = searchParams.get('date') ?? '';
  const preferredDateKey = isValidDateKey(preferredDateParam) ? preferredDateParam : undefined;

  // Real-time updates via WebSocket
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

  // Fetch initial schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoadingSchedules(true);
        const { data } = await api.get<Schedule[]>('/schedules?eventType=selva');
        setSchedules(data);
      } catch (error) {
        void Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los horarios.',
          confirmButtonColor: '#0f766e',
        });
      } finally {
        setLoadingSchedules(false);
      }
    };
    fetchSchedules();
  }, []);

  // Dependents validations
  const activeDependents = useMemo(() => {
    if (!isAccompanied) return [];
    return dependents.filter((dep) => dep.name.trim().length > 0 || dep.rut.trim().length > 0 || dep.age.trim().length > 0);
  }, [dependents, isAccompanied]);

  const areDependentsValid = useMemo(() => {
    if (!isAccompanied) return true;
    if (activeDependents.length === 0) return false;
    return activeDependents.every(
      (dep) =>
        dep.name.trim().length >= 2 &&
        isValidChileanRut(dep.rut) &&
        dep.age.trim().length > 0 &&
        !isNaN(Number(dep.age)) &&
        Number(dep.age) >= 0 &&
        Number(dep.age) <= 130,
    );
  }, [activeDependents, isAccompanied]);

  // General step 1 validation
  const isGuardianRutValid = isValidChileanRut(rut);
  const isGuardianEmailValid = EMAIL_REGEX.test(email.trim());
  const isGuardianPhoneValid = CHILEAN_MOBILE_REGEX.test(phone.trim());

  const isStep1Valid = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (!isGuardianRutValid) return false;
    if (!isGuardianEmailValid) return false;
    if (!isGuardianPhoneValid) return false;
    if (address.trim().length < 2) return false;
    if (commune.trim().length < 2) return false;
    if (!areDependentsValid) return false;
    return true;
  }, [areDependentsValid, isGuardianEmailValid, isGuardianPhoneValid, isGuardianRutValid, name, address, commune]);

  // Date lists for selector (Step 2)
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

  // Pre-fill default date selection
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

  // Filter schedules by selected date
  const filteredSchedules = useMemo(() => {
    if (!selectedDateKey) return [];
    const now = Date.now();
    return schedules.filter(
      (schedule) =>
        toChileDateKey(schedule.startTime) === selectedDateKey && new Date(schedule.startTime).getTime() > now,
    );
  }, [schedules, selectedDateKey]);

  const selectedSchedule = useMemo(() => {
    return schedules.find((s) => s._id === selectedScheduleId) ?? null;
  }, [schedules, selectedScheduleId]);

  const totalAttendees = 1 + activeDependents.length;

  const isStep2Valid = useMemo(() => {
    if (!selectedSchedule) return false;
    return selectedSchedule.availableSpots >= totalAttendees;
  }, [selectedSchedule, totalAttendees]);

  // Handlers for step 1 dependents
  const handleChangeDependent = (index: number, field: keyof DependentFormItem, value: string) => {
    setDependents((prev) =>
      prev.map((dep, i) => (i === index ? { ...dep, [field]: value } : dep)),
    );
  };

  const handleAddDependent = () => {
    if (dependents.length < MAX_DEPENDENTS) {
      setDependents((prev) => [...prev, { ...EMPTY_DEPENDENT }]);
    }
  };

  const handleRemoveDependent = (index: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== index));
  };

  // Main Submit handler (Step 3 Confirm)
  const handleSubmitEnrollment = async () => {
    if (!isStep1Valid || !isStep2Valid || !selectedSchedule) return;

    try {
      setSubmitting(true);

      // 1. Create guardian & dependents
      const guardianPayload: CreateGuardianPayload = {
        name: name.trim(),
        rut: rut.trim(),
        email: email.trim(),
        phone: `+569${phone.trim()}`,
        address: address.trim(),
        commune: commune.trim(),
        dependents: activeDependents.map((dep) => ({
          name: dep.name.trim(),
          rut: dep.rut.trim(),
          age: Number(dep.age),
        })),
        acceptMarketing,
        acceptDataTerms,
      };

      const { data: createdGuardian } = await api.post<Guardian>('/guardians', guardianPayload);

      // 2. Create reservation immediately
      const reservationPayload = {
        scheduleId: selectedSchedule._id,
        guardianId: createdGuardian._id,
        guardianParticipates: true,
        attendingDependents: activeDependents.map((dep) => ({
          name: dep.name.trim(),
          rut: dep.rut.trim(),
        })),
      };

      await api.post('/reservations', reservationPayload);

      await Swal.fire({
        icon: 'success',
        title: 'Inscripción confirmada',
        text: 'Tu registro y reserva se completaron con éxito. Te esperamos.',
        confirmButtonColor: '#0f766e',
      });

      // Clear states & go home
      setName('');
      setRut('');
      setEmail('');
      setPhone('');
      setAddress('');
      setCommune('');
      setIsAccompanied(false);
      setDependents([{ ...EMPTY_DEPENDENT }]);
      setSelectedScheduleId('');
      setAcceptMarketing(false);
      setAcceptDataTerms(false);
      setStep(1);

      navigate('/home');
    } catch (error: unknown) {
      const backendMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : '';

      void Swal.fire({
        icon: 'error',
        title: 'Error al inscribir',
        text: backendMessage || 'Hubo un problema al procesar tu solicitud. Intenta nuevamente.',
        confirmButtonColor: '#0f766e',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="selva-layout" style={{ backgroundImage: `url(${fondoImage})` }}>
      <Box className="selva-header-wrap">
        <Box component="img" src={selvaWebHeader} alt="Selva Viva" className="selva-header-image" />
      </Box>

      <Box className="selva-content-wrap">
        <Paper elevation={2} className="selva-wizard-card">
          {/* Stepper visual */}
          <Box className="selva-stepper-container">
            <Box className="selva-stepper">
              <Box className={`selva-step-dot ${step >= 1 ? 'active' : ''}`}>1</Box>
              <Box className={`selva-step-line ${step >= 2 ? 'active' : ''}`} />
              <Box className={`selva-step-dot ${step >= 2 ? 'active' : ''}`}>2</Box>
              <Box className={`selva-step-line ${step >= 3 ? 'active' : ''}`} />
              <Box className={`selva-step-dot ${step >= 3 ? 'active' : ''}`}>3</Box>
            </Box>
            <Box className="selva-stepper-labels">
              <Typography className={`selva-step-label ${step === 1 ? 'active' : ''}`}>Datos apoderado</Typography>
              <Typography className={`selva-step-label ${step === 2 ? 'active' : ''}`}>Elegir horario</Typography>
              <Typography className={`selva-step-label ${step === 3 ? 'active' : ''}`}>Confirmar</Typography>
            </Box>
          </Box>

          <Divider className="selva-step-divider" />

          {/* STEP 1: Formulario de datos */}
          {step === 1 && (
            <Stack spacing={2} className="selva-step-content">
              <Typography variant="h6" className="selva-step-title">
                Ingresa tus datos personales
              </Typography>
              
              <TextField
                label="Nombre y Apellido"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                fullWidth
              />

              <TextField
                label="RUT"
                value={rut}
                onChange={(event) => setRut(formatRut(event.target.value))}
                placeholder="12345678-5"
                error={rut.trim().length > 0 && !isGuardianRutValid}
                helperText={rut.trim().length > 0 && !isGuardianRutValid ? 'RUT chileno inválido.' : 'Sin Puntos y con guion'}
                required
                fullWidth
              />

              <TextField
                label="Dirección"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Ejemplo: Av. Vitacura 1230, Depto 40"
                error={address.trim().length > 0 && address.trim().length < 2}
                helperText={address.trim().length > 0 && address.trim().length < 2 ? 'Dirección muy corta.' : ''}
                required
                fullWidth
              />

              <TextField
                label="Comuna"
                value={commune}
                onChange={(event) => setCommune(event.target.value)}
                placeholder="Ejemplo: Santiago"
                error={commune.trim().length > 0 && commune.trim().length < 2}
                helperText={commune.trim().length > 0 && commune.trim().length < 2 ? 'Comuna muy corta.' : ''}
                required
                fullWidth
              />

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={email.trim().length > 0 && !isGuardianEmailValid}
                helperText={email.trim().length > 0 && !isGuardianEmailValid ? 'Ingresa un correo válido.' : 'Ejemplo: nombre@correo.cl'}
                required
                fullWidth
              />

              <TextField
                label="Whatsapp"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">+569</InputAdornment>,
                  },
                  htmlInput: {
                    inputMode: 'numeric',
                    pattern: '[0-9]{8}',
                    maxLength: 8,
                  },
                }}
                error={phone.trim().length > 0 && !isGuardianPhoneValid}
                helperText={
                  phone.trim().length > 0 && !isGuardianPhoneValid
                    ? 'Debe tener exactamente 8 dígitos.'
                    : 'Ejemplo: 12345678'
                }
                required
                fullWidth
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAccompanied}
                    onChange={(event) => setIsAccompanied(event.target.checked)}
                  />
                }
                label="¿Viene acompañado?"
                style={{ alignSelf: 'flex-start', marginLeft: '2px' }}
              />

              {isAccompanied && (
                <Box className="selva-wizard-dependents">
                  <Typography variant="subtitle1" className="selva-wizard-section-title">
                    Acompañantes
                  </Typography>
                  <Stack spacing={1.5}>
                    {dependents.map((dependent, index) => (
                      <Box key={`dependent-${index}`} className="selva-wizard-dependent-row">
                        <Box className="selva-wizard-dependent-fields">
                          <TextField
                            fullWidth
                            label={`Nombre acompañante ${index + 1}`}
                            value={dependent.name}
                            onChange={(event) => handleChangeDependent(index, 'name', event.target.value)}
                          />
                          <TextField
                            fullWidth
                            label={`RUT acompañante ${index + 1}`}
                            value={dependent.rut}
                            onChange={(event) => handleChangeDependent(index, 'rut', formatRut(event.target.value))}
                            placeholder="12345678-5"
                            error={dependent.rut.trim().length > 0 && !isValidChileanRut(dependent.rut)}
                            helperText={
                              dependent.rut.trim().length > 0 && !isValidChileanRut(dependent.rut)
                                ? 'RUT inválido'
                                : 'sin puntos y con guion'
                            }
                          />
                          <TextField
                            fullWidth
                            label="Edad"
                            value={dependent.age}
                            onChange={(event) => handleChangeDependent(index, 'age', event.target.value.replace(/\D/g, ''))}
                            placeholder="Ej: 8"
                            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 3 } }}
                            error={dependent.age.trim().length > 0 && (isNaN(Number(dependent.age)) || Number(dependent.age) < 0 || Number(dependent.age) > 130)}
                            helperText={
                              dependent.age.trim().length > 0 && (isNaN(Number(dependent.age)) || Number(dependent.age) < 0 || Number(dependent.age) > 130)
                                ? 'Edad'
                                : ''
                            }
                          />
                        </Box>
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveDependent(index)}
                          aria-label="Eliminar acompañante"
                        >
                          <DeleteOutlined />
                        </IconButton>
                      </Box>
                    ))}
                    {dependents.length === 0 && (
                      <Typography variant="body2" color="text.secondary" style={{ fontStyle: 'italic', paddingBlock: '0.4rem' }}>
                        Sin acompañantes agregados. Puedes agregar hasta 3.
                      </Typography>
                    )}
                  </Stack>

                  <Box className="selva-wizard-divider" />

                  <Button
                    type="button"
                    variant="outlined"
                    startIcon={<Add />}
                    className="selva-wizard-add-btn"
                    disabled={dependents.length >= MAX_DEPENDENTS}
                    onClick={handleAddDependent}
                  >
                    Agregar Acompañante ({dependents.length}/{MAX_DEPENDENTS})
                  </Button>
                </Box>
              )}

              <Box className="selva-wizard-actions">
                <Button
                  variant="contained"
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className="selva-wizard-next-btn"
                  endIcon={<ArrowForward />}
                >
                  Siguiente
                </Button>
              </Box>
            </Stack>
          )}

          {/* STEP 2: Selección de Horario */}
          {step === 2 && (
            <Stack spacing={2} className="selva-step-content">
              <Typography variant="h6" className="selva-step-title">
                Selecciona la fecha y el horario
              </Typography>

              {loadingSchedules ? (
                <Box className="selva-wizard-loading">
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Cargando horarios disponibles...
                  </Typography>
                </Box>
              ) : (
                <>
                  <FormControl fullWidth className="selva-wizard-date-control">
                    <InputLabel id="selva-date-label">Fecha de reserva</InputLabel>
                    <Select
                      labelId="selva-date-label"
                      value={selectedDateKey}
                      label="Fecha de reserva"
                      onChange={(event) => {
                        setSelectedDateKey(event.target.value);
                        setSelectedScheduleId('');
                      }}
                    >
                      {availableDateKeys.map((dateKey) => (
                        <MenuItem key={dateKey} value={dateKey}>
                          {formatChileDateLabel(dateKey)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Cupos requeridos para tu grupo: <strong>{totalAttendees}</strong>
                  </Typography>

                  <Box className="selva-wizard-schedule-grid">
                    {filteredSchedules.map((schedule) => {
                      const date = new Date(schedule.startTime);
                      const isSoldOut = schedule.availableSpots <= 0;
                      const isSelected = selectedScheduleId === schedule._id;
                      const hasEnoughSpots = schedule.availableSpots >= totalAttendees;

                      const totalCapacity = schedule.totalCapacity > 0 ? schedule.totalCapacity : 30;
                      const remainingRatio = schedule.availableSpots / totalCapacity;
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
                          disabled={isSoldOut || !hasEnoughSpots}
                          onClick={() => setSelectedScheduleId(schedule._id)}
                          className={`spot-schedule-btn ${isSelected ? 'selected-slot' : ''} ${(!hasEnoughSpots || isSoldOut) ? 'spot-schedule-btn-soldout' : ''}`}
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

                    {filteredSchedules.length === 0 && (
                      <Typography align="center" color="text.secondary" sx={{ gridColumn: '1 / -1', py: 3 }}>
                        No hay horarios disponibles para la fecha seleccionada.
                      </Typography>
                    )}
                  </Box>
                </>
              )}

              <Box className="selva-wizard-actions space-between">
                <Button
                  variant="outlined"
                  onClick={() => setStep(1)}
                  className="selva-wizard-back-btn"
                  startIcon={<ArrowBack />}
                >
                  Atrás
                </Button>
                <Button
                  variant="contained"
                  disabled={!isStep2Valid}
                  onClick={() => setStep(3)}
                  className="selva-wizard-next-btn"
                  endIcon={<ArrowForward />}
                >
                  Siguiente
                </Button>
              </Box>
            </Stack>
          )}

          {/* STEP 3: Resumen y envío */}
          {step === 3 && (
            <Stack spacing={2.5} className="selva-step-content">
              <Typography variant="h6" className="selva-step-title centered">
                Resumen de inscripción
              </Typography>

              <Box className="selva-summary-container">
                {/* Datos Apoderado */}
                <Box className="selva-summary-section">
                  <Typography className="selva-summary-section-title">Apoderado</Typography>
                  <Box className="selva-summary-grid">
                    <Box className="selva-summary-item"><span className="label">Nombre:</span> <span className="value">{name}</span></Box>
                    <Box className="selva-summary-item"><span className="label">RUT:</span> <span className="value">{rut}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Comuna:</span> <span className="value">{commune}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Dirección:</span> <span className="value">{address}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Email:</span> <span className="value">{email}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Whatsapp:</span> <span className="value">+569 {phone}</span></Box>
                  </Box>
                </Box>

                <Divider />

                {/* Acompañantes */}
                <Box className="selva-summary-section">
                  <Typography className="selva-summary-section-title">Acompañantes ({activeDependents.length})</Typography>
                  {activeDependents.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {activeDependents.map((dep, idx) => (
                        <Box key={idx} className="selva-summary-dependent-row">
                          <Typography className="dep-name"><strong>{dep.name}</strong></Typography>
                          <Typography className="dep-rut">RUT: {dep.rut} • Edad: {dep.age} años</Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                      Sin acompañantes adicionales
                    </Typography>
                  )}
                </Box>

                <Divider />

                {/* Bloque de Horario */}
                {selectedSchedule && (
                  <Box className="selva-summary-section schedule-highlight">
                    <Typography className="selva-summary-section-title">Horario Seleccionado</Typography>
                    <Box className="selva-summary-schedule-info">
                      <CheckCircle className="selva-summary-schedule-icon" />
                      <Box>
                        <Typography className="selva-summary-date">
                          {formatChileDateLabel(toChileDateKey(selectedSchedule.startTime))}
                        </Typography>
                        <Typography className="selva-summary-time">
                          {formatChileTime(new Date(selectedSchedule.startTime))} hrs (Duración: {selectedSchedule.durationMinutes} minutos)
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Checkboxes de consentimiento */}
              <Stack spacing={1} className="selva-consent-container">
                <FormControlLabel
                  className="selva-checkbox-label"
                  control={
                    <Checkbox
                      checked={acceptMarketing}
                      onChange={(e) => setAcceptMarketing(e.target.checked)}
                      className="selva-custom-checkbox"
                    />
                  }
                  label="ACEPTO QUE LA CORPORACIÓN ME ENVIE INFORMACIÓN DE ACTIVIDADES FUTURAS"
                />
                <FormControlLabel
                  className="selva-checkbox-label"
                  control={
                    <Checkbox
                      checked={acceptDataTerms}
                      onChange={(e) => setAcceptDataTerms(e.target.checked)}
                      className="selva-custom-checkbox"
                    />
                  }
                  label="AUTORIZO TRATAMIENTO DE DATOS"
                />
              </Stack>

              {submitting && (
                <Box className="selva-wizard-submit-overlay">
                  <CircularProgress size={45} />
                  <Typography variant="body1" sx={{ mt: 1.5, fontWeight: 700, color: '#0f766e' }}>
                    Procesando tu inscripción...
                  </Typography>
                </Box>
              )}

              <Box className="selva-wizard-actions space-between">
                <Button
                  variant="outlined"
                  onClick={() => setStep(2)}
                  className="selva-wizard-back-btn"
                  disabled={submitting}
                  startIcon={<ArrowBack />}
                >
                  Atrás
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmitEnrollment}
                  disabled={submitting}
                  className="selva-wizard-confirm-btn"
                >
                  Inscribirse
                </Button>
              </Box>
            </Stack>
          )}
        </Paper>
      </Box>

      <Box className="selva-footer-wrap">
        <Box component="img" src={institutionalLogos} alt="Logos institucionales" className="selva-footer-logos" />
      </Box>
    </Box>
  );
}

export default SelvaPage;
