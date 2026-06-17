import { Add, DeleteOutlined, ArrowBack, ArrowForward, CheckCircle, Warning } from '@mui/icons-material';
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
import iceWebHeader from '../assets/Hielo.png';
import institutionalLogos from '../assets/logos.png';
import '../styles/selva-page.css';
import '../styles/spot-selector.css';

const MAX_DEPENDENTS = 3;
const SHOE_SIZES = Array.from({ length: 47 - 25 + 1 }, (_, i) => 25 + i); // [25, 26, ..., 47]

type DependentFormItem = {
  name: string;
  rut: string;
  age: string;
  shoeSize: string; // Talla de calzado para patines
};

const EMPTY_DEPENDENT: DependentFormItem = { name: '', rut: '', age: '', shoeSize: '' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHILEAN_MOBILE_REGEX = /^\d{8}$/;
const CHILEAN_RUT_FORMAT_REGEX = /^\d+-[\dK]$/i;

function normalizeRut(rawRut: string) {
  return rawRut.replace(/-/g, '').trim().toUpperCase();
}

function formatRut(value: string) {
  const clean = value.replace(/[^0-9kK]/g, '');
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  return `${body}-${dv}`;
}

function isValidChileanRut(rut: string) {
  if (!CHILEAN_RUT_FORMAT_REGEX.test(rut)) return false;
  const clean = normalizeRut(rut);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedDv = 11 - (sum % 11);
  let expectedDvStr = '';
  if (expectedDv === 11) expectedDvStr = '0';
  else if (expectedDv === 10) expectedDvStr = 'K';
  else expectedDvStr = String(expectedDv);

  return dv === expectedDvStr;
}

export function IcePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Wizard state (1: Form, 2: Schedules, 3: Summary, 4: Confirmed)
  const [step, setStep] = useState(1);
  const [createdReservation, setCreatedReservation] = useState<{
    id: string;
    dateLabel: string;
    timeLabel: string;
  } | null>(null);

  // Form states (Step 1)
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [villa, setVilla] = useState('');
  
  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  
  // Adult Skating choice
  const [adultWantsToSkate, setAdultWantsToSkate] = useState<'si' | 'no' | ''>('');
  const [adultShoeSize, setAdultShoeSize] = useState<string>('');

  const [isAccompanied, setIsAccompanied] = useState(false);
  const [dependents, setDependents] = useState<DependentFormItem[]>([{ ...EMPTY_DEPENDENT }]);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [acceptDataTerms, setAcceptDataTerms] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);

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

  // Alerta de normas obligatorias (Step 1)
  useEffect(() => {
    if (step === 1 && !rulesAccepted) {
      Swal.fire({
        title: 'Normas de Uso Obligatorias',
        html: `
          <div style="text-align: left; font-family: inherit; line-height: 1.5; color: #1e293b;">
            <p style="margin-bottom: 12px; font-size: 0.95rem;">
              Para inscribirse en la <strong>Pista de Hielo</strong>, es obligatorio leer y aceptar las siguientes normas de uso:
            </p>
            <div style="max-height: 250px; overflow-y: auto; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px; font-size: 0.85rem; color: #b45309; margin-bottom: 15px;">
              <ul style="margin: 0; padding-left: 15px; list-style-type: disc;">
                <li style="margin-bottom: 8px;"><strong>No está permitido el ingreso</strong> de niños y niñas menores de 5 años.</li>
                <li style="margin-bottom: 8px;">Los niños y niñas de <strong>5 a 7 años</strong> deben ingresar a la pista acompañados por un adulto responsable (mayor de 18 años).</li>
                <li style="margin-bottom: 8px;">Los niños y niñas de <strong>8 a 13 años</strong> deben permanecer acompañados por un adulto responsable dentro del recinto.</li>
                <li style="margin-bottom: 8px;">Las <strong>mujeres embarazadas</strong> no pueden ingresar a la pista.</li>
                <li style="margin-bottom: 0;">Para ingresar a la pista de hielo es <strong>obligatorio el uso de calcetines largos, pantalones largos y gruesos, y chaqueta o polerón de manga larga</strong>.</li>
              </ul>
            </div>
            <div style="margin-top: 15px; display: flex; align-items: flex-start; gap: 10px;">
              <input type="checkbox" id="rules-checkbox" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px; flex-shrink: 0;" />
              <label for="rules-checkbox" style="cursor: pointer; font-weight: 700; font-size: 0.85rem; color: #0f766e; user-select: none; line-height: 1.4;">
                Declaro haber leído y estar en conocimiento de las normas señaladas.
              </label>
            </div>
          </div>
        `,
        icon: 'warning',
        confirmButtonText: 'Aceptar y Continuar',
        confirmButtonColor: '#0f766e',
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        preConfirm: () => {
          const checkbox = document.getElementById('rules-checkbox') as HTMLInputElement;
          if (!checkbox || !checkbox.checked) {
            Swal.showValidationMessage('Debes declarar estar en conocimiento de las normas para continuar');
            return false;
          }
          return true;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          setRulesAccepted(true);
        }
      });
    }
  }, [step, rulesAccepted]);

  // Fetch initial schedules for 'patines'
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoadingSchedules(true);
        const { data } = await api.get<Schedule[]>('/schedules?eventType=patines');
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
    return dependents.filter((dep) => dep.name.trim().length > 0 || dep.rut.trim().length > 0 || dep.age.trim().length > 0 || dep.shoeSize.trim().length > 0);
  }, [dependents, isAccompanied]);

  const areDependentsValid = useMemo(() => {
    if (!isAccompanied) return true;
    if (dependents.length === 0) return false;
    return dependents.every(
      (dep) =>
        dep.name.trim().length >= 2 &&
        isValidChileanRut(dep.rut) &&
        dep.age.trim().length > 0 &&
        !isNaN(Number(dep.age)) &&
        Number(dep.age) >= 5 && // Mínimo 5 años para patines
        Number(dep.age) <= 130 &&
        dep.shoeSize.trim().length > 0 &&
        !isNaN(Number(dep.shoeSize)) &&
        Number(dep.shoeSize) >= 25 &&
        Number(dep.shoeSize) <= 47,
    );
  }, [dependents, isAccompanied]);

  // General step 1 validation
  const isGuardianRutValid = isValidChileanRut(rut);
  const isGuardianEmailValid = EMAIL_REGEX.test(email.trim());
  const isGuardianPhoneValid = CHILEAN_MOBILE_REGEX.test(phone.trim());
  const isEmergencyPhoneValid = CHILEAN_MOBILE_REGEX.test(emergencyPhone.trim());

  const isStep1Valid = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (!isGuardianRutValid) return false;
    if (!isGuardianEmailValid) return false;
    if (!isGuardianPhoneValid) return false;
    if (address.trim().length < 2) return false;
    if (commune.trim().length < 2) return false;
    
    // Emergency Contact
    if (emergencyName.trim().length < 2) return false;
    if (!isEmergencyPhoneValid) return false;
    
    // Adult skating choice validation
    if (adultWantsToSkate === '') return false;
    if (adultWantsToSkate === 'si') {
      if (adultShoeSize.trim().length === 0 || isNaN(Number(adultShoeSize)) || Number(adultShoeSize) < 25 || Number(adultShoeSize) > 47) {
        return false;
      }
    }

    if (!areDependentsValid) return false;
    return true;
  }, [
    areDependentsValid, 
    isGuardianEmailValid, 
    isGuardianPhoneValid, 
    isGuardianRutValid, 
    name, 
    address, 
    commune, 
    emergencyName, 
    emergencyPhone, 
    isEmergencyPhoneValid, 
    adultWantsToSkate, 
    adultShoeSize
  ]);

  // Total attendees including guardian only if they choose to skate
  const totalAttendees = (adultWantsToSkate === 'si' ? 1 : 0) + activeDependents.length;

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
    } else if (!selectedDateKey || !availableDateKeys.includes(selectedDateKey)) {
      if (preferredDateKey && availableDateKeys.includes(preferredDateKey)) {
        setSelectedDateKey(preferredDateKey);
      } else {
        setSelectedDateKey(availableDateKeys[0]);
      }
    }
  }, [availableDateKeys, selectedDateKey, preferredDateKey]);

  // Filtered schedules based on active date selection
  const activeSchedulesForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return schedules
      .filter((schedule) => toChileDateKey(schedule.startTime) === selectedDateKey)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules, selectedDateKey]);

  const selectedSchedule = useMemo(() => {
    return schedules.find((s) => s._id === selectedScheduleId);
  }, [schedules, selectedScheduleId]);

  const isStep2Valid = useMemo(() => {
    if (!selectedSchedule) return false;
    return selectedSchedule.availableSpots >= totalAttendees;
  }, [selectedSchedule, totalAttendees]);

  // Handlers for step 1 dependents
  const handleChangeDependent = (index: number, field: keyof DependentFormItem, value: string) => {
    let sanitizedValue = value;
    if (field === 'name') {
      sanitizedValue = value.replace(/\d/g, '');
    } else if (field === 'age') {
      sanitizedValue = value.replace(/\D/g, '');
    } else if (field === 'shoeSize') {
      sanitizedValue = value.replace(/\D/g, '');
    }
    setDependents((prev) =>
      prev.map((dep, i) => (i === index ? { ...dep, [field]: sanitizedValue } : dep)),
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
        villa: villa.trim() || undefined,
        emergencyName: emergencyName.trim(),
        emergencyPhone: `+569${emergencyPhone.trim()}`,
        dependents: activeDependents.map((dep) => ({
          name: dep.name.trim(),
          rut: dep.rut.trim(),
          age: Number(dep.age),
        })),
        acceptMarketing,
        acceptDataTerms,
      };

      const { data: createdGuardian } = await api.post<Guardian>('/guardians', guardianPayload);

      // 2. Map skating shoe sizes for metadata (including guardian if they skate)
      const patinesMetadata = activeDependents.map((dep) => ({
        rut: dep.rut.trim(),
        shoeSize: Number(dep.shoeSize),
      }));

      if (adultWantsToSkate === 'si') {
        patinesMetadata.push({
          rut: rut.trim(),
          shoeSize: Number(adultShoeSize),
        });
      }

      // 3. Create reservation immediately
      const reservationPayload = {
        scheduleId: selectedSchedule._id,
        guardianId: createdGuardian._id,
        guardianParticipates: adultWantsToSkate === 'si',
        attendingDependents: activeDependents.map((dep) => ({
          name: dep.name.trim(),
          rut: dep.rut.trim(),
        })),
        metadata: {
          eventType: 'patines',
          patines: patinesMetadata,
        },
      };

      await api.post('/reservations', reservationPayload);

      // Poll for the reservation to be created by the background queue
      let reservationId = '';
      const maxRetries = 15;
      const delayMs = 600;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { data: resData } = await api.get<{ _id: string }>(`/reservations/by-guardian/${createdGuardian._id}`);
          if (resData && resData._id) {
            reservationId = resData._id;
            break;
          }
        } catch (pollError) {
          // Ignore errors during polling, retry
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (!reservationId) {
        throw new Error('La reserva está tomando más tiempo de lo esperado en procesarse. Por favor verifica tu correo o contacta a soporte.');
      }

      const dateObj = new Date(selectedSchedule.startTime);
      const day = dateObj.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric' });
      const month = dateObj.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', month: 'long' });
      const dateLabel = `${day} de ${month.charAt(0).toUpperCase() + month.slice(1)}`;
      const timeLabel = formatChileTime(dateObj);

      setCreatedReservation({
        id: reservationId,
        dateLabel,
        timeLabel,
      });

      // Clear states & go to step 4 (confirmation)
      setName('');
      setRut('');
      setEmail('');
      setPhone('');
      setAddress('');
      setCommune('');
      setVilla('');
      setEmergencyName('');
      setEmergencyPhone('');
      setAdultWantsToSkate('');
      setAdultShoeSize('');
      setIsAccompanied(false);
      setDependents([{ ...EMPTY_DEPENDENT }]);
      setSelectedScheduleId('');
      setAcceptMarketing(false);
      setAcceptDataTerms(false);
      setStep(4);
    } catch (error: unknown) {
      const backendMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;

      void Swal.fire({
        icon: 'error',
        title: 'Error al procesar inscripción',
        text: backendMessage || 'Hubo un problema al procesar tu solicitud. Intenta nuevamente.',
        confirmButtonColor: '#0f766e',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQr = () => {
    if (!createdReservation) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3500';
    window.open(`${baseUrl}/reservations/${createdReservation.id}/qrcode`, '_blank');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <Box className="selva-layout" style={{ backgroundImage: `url(${fondoImage})` }}>
      <Box className="selva-content-wrap">
        <Box component="img" src={iceWebHeader} alt="Pista de Hielo" className="selva-header-image" />

        <Paper elevation={2} className="selva-wizard-card">
          {/* Stepper visual */}
          {step <= 3 && (
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
          )}

          {step <= 3 && <Divider className="selva-step-divider" />}

          {/* STEP 1: Formulario de datos */}
          {step === 1 && (
            <Stack spacing={2.5} className="selva-step-content">
              <Typography variant="h6" className="selva-step-title">
                Ingresa tus datos personales
              </Typography>
              
              <TextField
                label="Nombre y Apellido"
                value={name}
                onChange={(event) => setName(event.target.value.replace(/\d/g, ''))}
                required
                fullWidth
              />

              <TextField
                label="RUT"
                value={rut}
                onChange={(event) => setRut(formatRut(event.target.value))}
                placeholder="12345678-5"
                error={rut.trim().length > 0 && !isGuardianRutValid}
                helperText={
                  rut.trim().length > 0 && !isGuardianRutValid
                    ? 'RUT inválido'
                    : 'sin puntos y con guion'
                }
                required
                fullWidth
              />

              <TextField
                label="Dirección"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Ejemplo: Av. O’Higgins 281"
                error={address.trim().length > 0 && address.trim().length < 2}
                helperText={address.trim().length > 0 && address.trim().length < 2 ? 'Dirección muy corta.' : ''}
                required
                fullWidth
              />

              <TextField
                label="Comuna"
                value={commune}
                onChange={(event) => setCommune(event.target.value)}
                placeholder="Ejemplo: Quilicura"
                error={commune.trim().length > 0 && commune.trim().length < 2}
                helperText={commune.trim().length > 0 && commune.trim().length < 2 ? 'Comuna muy corta.' : ''}
                required
                fullWidth
              />

              <TextField
                label="Villa / Población"
                value={villa}
                onChange={(event) => setVilla(event.target.value)}
                placeholder="Ejemplo: Villa Las Flores"
                error={villa.trim().length > 0 && villa.trim().length < 2}
                helperText={villa.trim().length > 0 && villa.trim().length < 2 ? 'Nombre muy corto.' : ''}
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
                label="Teléfono Celular"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">+56 9</InputAdornment>,
                  },
                  htmlInput: {
                    maxLength: 8,
                    inputMode: 'numeric',
                  },
                }}
                error={phone.trim().length > 0 && !isGuardianPhoneValid}
                helperText={phone.trim().length > 0 && !isGuardianPhoneValid ? 'Deben ser 8 dígitos.' : ''}
                required
                fullWidth
              />

              <Divider sx={{ my: 1 }}>Contacto de Emergencia</Divider>

              <TextField
                label="Nombre Contacto de Emergencia"
                value={emergencyName}
                onChange={(event) => setEmergencyName(event.target.value.replace(/\d/g, ''))}
                required
                fullWidth
              />

              <TextField
                label="Teléfono de Emergencia"
                value={emergencyPhone}
                onChange={(event) => setEmergencyPhone(event.target.value.replace(/\D/g, ''))}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">+56 9</InputAdornment>,
                  },
                  htmlInput: {
                    maxLength: 8,
                    inputMode: 'numeric',
                  },
                }}
                error={emergencyPhone.trim().length > 0 && !isEmergencyPhoneValid}
                helperText={emergencyPhone.trim().length > 0 && !isEmergencyPhoneValid ? 'Deben ser 8 dígitos.' : ''}
                required
                fullWidth
              />

              <Divider sx={{ my: 1 }}>Participación de Adulto</Divider>

              <FormControl fullWidth required>
                <InputLabel id="adult-skate-select-label">¿Usted va a patinar?</InputLabel>
                <Select
                  labelId="adult-skate-select-label"
                  label="¿Usted va a patinar?"
                  value={adultWantsToSkate}
                  onChange={(e) => {
                    const val = e.target.value as 'si' | 'no';
                    setAdultWantsToSkate(val);
                    if (val === 'no') setAdultShoeSize('');
                  }}
                >
                  <MenuItem value="si">Sí</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>

              {adultWantsToSkate === 'si' && (
                <FormControl fullWidth required>
                  <InputLabel id="adult-size-select-label">Talla de Calzado (Número de Patín)</InputLabel>
                  <Select
                    labelId="adult-size-select-label"
                    label="Talla de Calzado (Número de Patín)"
                    value={adultShoeSize}
                    onChange={(e) => setAdultShoeSize(e.target.value as string)}
                  >
                    {SHOE_SIZES.map((size) => (
                      <MenuItem key={size} value={size}>
                        N° {size}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {adultWantsToSkate === 'no' && (
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                  Solo se contabilizarán los menores inscritos como participantes.
                </Alert>
              )}

              <Divider sx={{ my: 1 }} />

              {/* Acompañantes toggle */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAccompanied}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsAccompanied(checked);
                      if (!checked) {
                        setDependents([{ ...EMPTY_DEPENDENT }]);
                      }
                    }}
                    className="selva-custom-checkbox"
                  />
                }
                label="¿Viene acompañado por menores de edad?"
                sx={{
                  '& .MuiTypography-root': { fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' },
                }}
              />

              {isAccompanied && (
                <Box className="selva-wizard-dependents">
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f766e', mb: 1 }}>
                    Registrar Acompañantes (Edad mínima: 5 años)
                  </Typography>

                  <Stack spacing={2.5}>
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
                            error={dependent.age.trim().length > 0 && (isNaN(Number(dependent.age)) || Number(dependent.age) < 5 || Number(dependent.age) > 130)}
                            helperText={
                              dependent.age.trim().length > 0 && (isNaN(Number(dependent.age)) || Number(dependent.age) < 5 || Number(dependent.age) > 130)
                                ? 'Mínimo 5 años'
                                : ''
                            }
                          />
                          <FormControl fullWidth required>
                            <InputLabel id={`dep-size-select-label-${index}`}>Talla de Calzado</InputLabel>
                            <Select
                              labelId={`dep-size-select-label-${index}`}
                              label="Talla de Calzado"
                              value={dependent.shoeSize}
                              onChange={(e) => handleChangeDependent(index, 'shoeSize', e.target.value as string)}
                            >
                              {SHOE_SIZES.map((size) => (
                                <MenuItem key={size} value={size}>
                                  N° {size}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveDependent(index)}
                          sx={{ alignSelf: 'center' }}
                        >
                          <DeleteOutlined />
                        </IconButton>
                      </Box>
                    ))}

                    {dependents.length === 0 && (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#64748b' }}>
                        No hay acompañantes agregados. Usa el botón inferior para añadir uno.
                      </Typography>
                    )}

                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      className="selva-add-dependent-btn"
                      disabled={dependents.length >= MAX_DEPENDENTS}
                      onClick={handleAddDependent}
                      fullWidth
                    >
                      Agregar Acompañante ({dependents.length}/{MAX_DEPENDENTS})
                    </Button>
                  </Stack>
                </Box>
              )}

              <Box className="selva-wizard-actions">
                <Button
                  variant="contained"
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className="selva-wizard-next-btn"
                  fullWidth
                  endIcon={<ArrowForward />}
                >
                  Continuar
                </Button>
              </Box>
            </Stack>
          )}

          {/* STEP 2: Selección de Horarios */}
          {step === 2 && (
            <Stack spacing={3} className="selva-step-content">
              <Typography variant="h6" className="selva-step-title centered">
                Selecciona la fecha y hora
              </Typography>

              {loadingSchedules ? (
                <Box className="selva-wizard-loading">
                  <CircularProgress size={40} />
                  <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
                    Cargando horarios disponibles...
                  </Typography>
                </Box>
              ) : schedules.length === 0 ? (
                <Box className="selva-wizard-empty">
                  <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f766e' }}>
                    No hay horarios disponibles en este momento.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Intenta consultar más tarde o ponte en contacto con administración.
                  </Typography>
                </Box>
              ) : (
                <Box className="selva-scheduler-wrapper">
                  {/* Selector de Fecha */}
                  <Box className="selva-date-tabs-container">
                    <Typography className="selva-scheduler-label">1. Selecciona el día</Typography>
                    <Box className="selva-date-tabs">
                      {availableDateKeys.map((dateKey) => (
                        <button
                          key={dateKey}
                          type="button"
                          className={`selva-date-tab-btn ${selectedDateKey === dateKey ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedDateKey(dateKey);
                            setSelectedScheduleId('');
                          }}
                        >
                          {formatChileDateLabel(dateKey)}
                        </button>
                      ))}
                    </Box>
                  </Box>

                  {/* Selector de Bloques de Hora */}
                  {selectedDateKey && (
                    <Box className="selva-time-slots-container">
                      <Typography className="selva-scheduler-label">2. Selecciona un bloque horario</Typography>
                      <Box className="selva-time-slots-grid">
                        {activeSchedulesForSelectedDate.map((schedule) => {
                          const spots = schedule.availableSpots;
                          const isFullyBooked = spots < totalAttendees;
                          const isSelected = selectedScheduleId === schedule._id;

                          return (
                            <button
                              key={schedule._id}
                              type="button"
                              disabled={isFullyBooked}
                              className={`spot-schedule-btn ${isSelected ? 'selected-slot' : ''} ${
                                isFullyBooked ? 'fully-booked' : ''
                              }`}
                              onClick={() => setSelectedScheduleId(schedule._id)}
                            >
                              <Typography className="spot-time-label">
                                {formatChileTime(new Date(schedule.startTime))} hrs
                              </Typography>
                              <Typography className="spot-capacity-label">
                                {isFullyBooked
                                  ? 'Sin cupos suf.'
                                  : `${spots} ${spots === 1 ? 'cupo' : 'cupos'} disp.`}
                              </Typography>
                            </button>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
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
                  onClick={() => setStep(3)}
                  disabled={!isStep2Valid}
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
                    {villa && <Box className="selva-summary-item"><span className="label">Villa:</span> <span className="value">{villa}</span></Box>}
                    <Box className="selva-summary-item"><span className="label">Dirección:</span> <span className="value">{address}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Email:</span> <span className="value">{email}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Whatsapp:</span> <span className="value">+569 {phone}</span></Box>
                    <Box className="selva-summary-item">
                      <span className="label">¿Patina?:</span> 
                      <span className="value" style={{ fontWeight: 700, color: adultWantsToSkate === 'si' ? '#0d9488' : '#e11d48' }}>
                        {adultWantsToSkate === 'si' ? `Sí (N° ${adultShoeSize})` : 'No'}
                      </span>
                    </Box>
                  </Box>
                </Box>

                <Divider />

                {/* Contacto Emergencia */}
                <Box className="selva-summary-section">
                  <Typography className="selva-summary-section-title">Contacto de Emergencia</Typography>
                  <Box className="selva-summary-grid">
                    <Box className="selva-summary-item"><span className="label">Nombre:</span> <span className="value">{emergencyName}</span></Box>
                    <Box className="selva-summary-item"><span className="label">Teléfono:</span> <span className="value">+569 {emergencyPhone}</span></Box>
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
                          <Typography className="dep-rut">RUT: {dep.rut} • Edad: {dep.age} años • Patines: N° {dep.shoeSize}</Typography>
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
                  label="Acepto que la Corporación me envíe información sobre actividades futuras"
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
                  label="Autorizo el tratamiento de mis datos personales"
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

          {/* STEP 4: Confirmación de reserva */}
          {step === 4 && createdReservation && (
            <Stack spacing={2.5} className="selva-step-content selva-confirmation-container">
              {/* Icono de éxito y título */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1, mb: 1 }}>
                <CheckCircle sx={{ fontSize: '3.5rem', color: '#0d9488', mb: 1.5 }} />
                <Typography variant="h6" className="selva-step-title centered" sx={{ m: 0 }}>
                  ¡Inscripción Exitosa!
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textAlign: 'center' }}>
                  Tu reserva ha sido procesada de manera correcta.
                </Typography>
              </Box>

              <Box className="selva-summary-container">
                {/* Código de Reserva */}
                <Box className="selva-summary-section" sx={{ alignItems: 'center', py: 0.5 }}>
                  <Typography className="selva-summary-section-title" sx={{ mb: 0.5 }}>Código de Reserva</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f766e', letterSpacing: '0.05em' }}>
                    SV-{createdReservation.id.slice(-5).toUpperCase()}
                  </Typography>
                </Box>

                <Divider />

                {/* Detalle del Horario */}
                <Box className="selva-summary-section schedule-highlight">
                  <Typography className="selva-summary-section-title">Horario Asignado</Typography>
                  <Box className="selva-summary-schedule-info">
                    <CheckCircle className="selva-summary-schedule-icon" />
                    <Box>
                      <Typography className="selva-summary-date">
                        {createdReservation.dateLabel}
                      </Typography>
                      <Typography className="selva-summary-time">
                        {createdReservation.timeLabel} hrs
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Divider />

                {/* Notas e Indicaciones */}
                <Box className="selva-summary-section">
                  <Typography className="selva-summary-section-title">Información Importante</Typography>
                  <Stack spacing={1.2} sx={{ mt: 0.5 }}>
                    <Box className="selva-confirmation-item warning-highlight">
                      <span className="selva-bullet-warning">
                        <Warning className="warning-icon" />
                      </span>
                      <Typography className="selva-item-text warning-text">
                        Debes presentarte 20 minutos antes de tu horario.
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: 1 }}>
                      <span className="selva-bullet-square"></span>
                      <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600 }}>
                        Hemos enviado la confirmación de tu reserva a tu correo electrónico.
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: 1 }}>
                      <span className="selva-bullet-square"></span>
                      <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600 }}>
                        Recibirás un mensaje de WhatsApp con tu código QR de acceso.
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Box>

              <Box className="selva-confirmation-actions">
                <Button
                  variant="contained"
                  onClick={handleDownloadQr}
                  className="selva-download-qr-btn"
                >
                  Descargar QR
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleGoHome}
                  className="selva-volver-btn"
                >
                  Cerrar
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

export default IcePage;
