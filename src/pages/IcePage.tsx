import { Add, DeleteOutlined, ArrowBack, ArrowForward, CheckCircle, Warning } from '@mui/icons-material';
import {
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api, socket } from '../services/api';
import type { CreateGuardianPayload, Schedule, Guardian } from '../types';
import { isValidDateKey, toChileDateKey, formatChileDateLabel, formatChileTime } from '../utils/datetime';
import { hasRepetitiveSpam } from '../utils/name';
import { getEmailSuggestion } from '../utils/email';
import { enterAdmission, formatEtaLabel, getAdmissionStatus, leaveAdmission, submitAdmission } from '../utils/admission';
import { isAllSoldOut } from '../utils/schedules';
import fondoImage from '../assets/Fondo.jpg';
import iceWebHeader from '../assets/Hielo.png';
import institutionalLogos from '../assets/logos.png';
import '../styles/selva-page.css';
import '../styles/spot-selector.css';

const MAX_DEPENDENTS = 3;
const SHOE_SIZES = Array.from({ length: 47 - 25 + 1 }, (_, i) => 25 + i); // [25, 26, ..., 47]
const MIN_DEPENDENT_AGE = 5;
const MAX_DEPENDENT_AGE = 17;

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
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const EVENT_TYPE = 'patines';

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
  const expectedDvStr = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : String(expectedDv);

  return dv === expectedDvStr;
}

function getDuplicateRut(values: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    const trimmedValue = value.trim();
    if (!trimmedValue) continue;

    const normalizedValue = normalizeRut(trimmedValue);
    if (seen.has(normalizedValue)) {
      return trimmedValue;
    }

    seen.add(normalizedValue);
  }

  return null;
}

function formatCountdownLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getCountdownColor(totalSeconds: number) {
  if (totalSeconds <= 10) return 'error.main';
  if (totalSeconds <= 20) return 'warning.main';
  return 'success.main';
}

function getCountdownBackground(totalSeconds: number) {
  if (totalSeconds <= 10) return 'rgba(220, 38, 38, 0.12)';
  if (totalSeconds <= 20) return 'rgba(217, 119, 6, 0.12)';
  return 'rgba(5, 150, 105, 0.12)';
}

function getCountdownBorder(totalSeconds: number) {
  if (totalSeconds <= 10) return 'rgba(220, 38, 38, 0.35)';
  if (totalSeconds <= 20) return 'rgba(217, 119, 6, 0.35)';
  return 'rgba(5, 150, 105, 0.35)';
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
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [loadedRut, setLoadedRut] = useState('');
  const [loadedEmail, setLoadedEmail] = useState('');
  const [loadedPhone, setLoadedPhone] = useState('');

  const clearForm = () => {
    setLoadedRut('');
    setLoadedEmail('');
    setLoadedPhone('');
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCommune('');
    setVilla('');
    setEmergencyName('');
    setEmergencyPhone('');
    setAdultWantsToSkate('');
    setAdultShoeSize('');
    setDependents([{ ...EMPTY_DEPENDENT }]);
    setIsAccompanied(false);
  };

  // Schedules state (Step 2)
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validatingRuts, setValidatingRuts] = useState(false);
  const [admissionSessionId, setAdmissionSessionId] = useState<string | null>(null);
  const [admissionRemainingSec, setAdmissionRemainingSec] = useState<number | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const hasShownNoParticipantsWarningRef = useRef(false);
  const hasShownYoungDependentWarningRef = useRef(false);
  const hasShownAdultNoWarningRef = useRef(false);
  const lastDuplicateRutAlertRef = useRef<string | null>(null);
  const soldOutShownRef = useRef(false);

  const preferredDateParam = searchParams.get('date') ?? '';
  const preferredDateKey = isValidDateKey(preferredDateParam) ? preferredDateParam : undefined;

  const showSoldOutModal = useCallback(async () => {
    if (soldOutShownRef.current) return;
    soldOutShownRef.current = true;
    await Swal.fire({
      icon: 'warning',
      title: 'Sin disponibilidad',
      text: 'Todos los cupos para este evento están agotados. Vuelve a intentarlo más tarde.',
      confirmButtonColor: '#0f766e',
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
    navigate('/home');
  }, [navigate]);

  // Real-time updates via WebSocket
  useEffect(() => {
    socket.connect();
    const onSpotsUpdated = (payload: { scheduleId: string; remaining: number }) => {
      setSchedules((prev) => {
        const next = prev.map((schedule) =>
          schedule._id === payload.scheduleId
            ? { ...schedule, availableSpots: payload.remaining }
            : schedule,
        );
        if (isAllSoldOut(next)) {
          void showSoldOutModal();
        }
        return next;
      });
    };
    socket.on('spots_updated', onSpotsUpdated);
    return () => {
      socket.off('spots_updated', onSpotsUpdated);
      socket.disconnect();
    };
  }, [showSoldOutModal]);

  useEffect(() => {
    let cancelled = false;

    const ensureAdmission = async () => {
      if (step !== 1 || !rulesAccepted || admissionSessionId) {
        return;
      }

      try {
        const enterResponse = await enterAdmission(EVENT_TYPE);
        if (cancelled) return;

        if (enterResponse.admitted) {
          setAdmissionSessionId(enterResponse.sessionId);
          const remainingSec = Math.max(
            0,
            Math.ceil((new Date(enterResponse.expiresAt).getTime() - Date.now()) / 1000),
          );
          setAdmissionRemainingSec(remainingSec);
          return;
        }

        const modalPromise = Swal.fire({
          icon: 'info',
          title: 'Alta demanda',
          html: `
            <p style="margin-bottom:8px;">Estamos recibiendo muchas solicitudes.</p>
            <p id="admission-wait-message" style="margin:0;color:#475569;">Calculando tiempo de espera...</p>
          `,
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
        });

        let status = await getAdmissionStatus(EVENT_TYPE, enterResponse.sessionId);
        while (!cancelled) {
          if (status.status === 'WRITING') {
            Swal.close();
            await modalPromise;
            setAdmissionSessionId(enterResponse.sessionId);
            setAdmissionRemainingSec(status.remainingSec);
            return;
          }

          if (status.status === 'EXPIRED') {
            Swal.close();
            await modalPromise;
            await Swal.fire({
              icon: 'warning',
              title: 'Tiempo de espera agotado',
              text: 'Vuelve a ingresar para intentarlo nuevamente.\n.',
              confirmButtonColor: '#0f766e',
            });
            navigate('/home');
            return;
          }

          if (status.status === 'WAITING') {
            const etaText = formatEtaLabel(status.etaSec);
            Swal.update({
              html: `
                <p style="margin-bottom:8px;">Estamos recibiendo muchas solicitudes.</p>
                <p id="admission-wait-message" style="margin:0;color:#475569;">Posición #${status.position}. Espera sugerida: ${etaText}.</p>
                <p style="margin:8px 0 0;color:#64748b;font-size:0.9rem;">Personas completando formulario ahora: ${status.writersActive}</p>
              `,
            });
            await new Promise((resolve) => setTimeout(resolve, status.retryAfterSec * 1000));
            status = await getAdmissionStatus(EVENT_TYPE, enterResponse.sessionId);
            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          status = await getAdmissionStatus(EVENT_TYPE, enterResponse.sessionId);
        }

        Swal.close();
        await modalPromise;
      } catch (error) {
        if (cancelled) return;
        const waitlistFullError = error as { code?: string; message?: string };
        if (waitlistFullError?.code === 'WAITLIST_FULL') {
          await Swal.fire({
            icon: 'warning',
            title: 'Sin disponibilidad',
            text: waitlistFullError.message || 'Sitio sin disponibilidad, intenta más tarde.',
            confirmButtonColor: '#0f766e',
          });
          navigate('/home');
          return;
        }
        void Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No pudimos obtener un turno de ingreso. Recarga la pagina e intenta nuevamente.',
          confirmButtonColor: '#0f766e',
        });
      }
    };

    void ensureAdmission();

    return () => {
      cancelled = true;
    };
  }, [admissionSessionId, rulesAccepted, step]);

  useEffect(() => {
    if (!admissionSessionId || step > 3) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const status = await getAdmissionStatus(EVENT_TYPE, admissionSessionId);
        if (cancelled) return;
        if (status.status === 'EXPIRED') {
          cancelled = true;
          window.clearInterval(intervalId);
          setAdmissionRemainingSec(0);
          setAdmissionSessionId(null);
          await Swal.fire({
            icon: 'warning',
            title: 'Sesion expirada',
            text: 'Vuelve a ingresar para intentarlo nuevamente.',
            confirmButtonColor: '#0f766e',
          });
          navigate('/home');
          return;
        }
        if (status.status === 'WRITING') {
          setAdmissionRemainingSec(status.remainingSec);
        }
      } catch {
        // Silent retry on next tick
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [admissionSessionId, step]);

  useEffect(() => {
    return () => {
      if (admissionSessionId) {
        void leaveAdmission(EVENT_TYPE, admissionSessionId);
      }
    };
  }, [admissionSessionId]);

  useEffect(() => {
    if (!admissionSessionId) {
      setAdmissionRemainingSec(null);
    }
  }, [admissionSessionId]);

  useEffect(() => {
    const updateCurrentTimestamp = () => {
      setCurrentTimestamp(Date.now());
    };

    const timeoutId = window.setTimeout(updateCurrentTimestamp, 0);
    const intervalId = window.setInterval(updateCurrentTimestamp, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  // Alerta de normas obligatorias (Step 1)
  useEffect(() => {
    if (step === 1 && !rulesAccepted) {
      Swal.fire({
        title: 'Normas de Uso Obligatorias',
        html: `
          <style>
            .swal2-title {
              font-size: 1.4rem !important;
            }
            .swal2-icon {
              transform: scale(0.65) !important;
              margin: 10px auto -15px auto !important;
            }
            .swal2-popup {
              padding: 1rem 1.5rem 1.5rem 1.5rem !important;
              max-width: 460px !important;
            }
            .swal2-html-container {
              margin: 10px 0 0 0 !important;
            }
          </style>
          <div style="text-align: left; font-family: inherit; line-height: 1.5; color: #1e293b;">
            <p style="margin-bottom: 12px; font-size: 0.95rem;">
              Para inscribirse en la <strong>Pista de Hielo</strong>, es obligatorio leer y aceptar las siguientes normas de uso:
            </p>
            <div style="max-height: 250px; overflow-y: auto; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px; font-size: 0.85rem; color: #b45309; margin-bottom: 15px;">
              <ul style="margin: 0; padding-left: 15px; list-style-type: disc;">
                <li style="margin-bottom: 8px;"><strong>No está permitido el ingreso</strong> de niños y niñas menores de 5 años.</li>
                <li style="margin-bottom: 8px;">Los niños y niñas de <strong>5 a 7 años</strong> deben ingresar a la pista acompañados por un adulto responsable (mayor de 18 años).</li>
                <li style="margin-bottom: 8px;">Los niños y niñas de <strong>8 a 13 años</strong> deben asistir acompañados por un adulto responsable mayor de 18 años. No es necesario que el adulto responsable ingrese a patinar, pero sí que permanezca en el recinto durante la actividad.</li>
                <li style="margin-bottom: 8px;">Las <strong>mujeres embarazadas</strong> no pueden ingresar a la pista.</li>
                <li style="margin-bottom: 8px;">Para ingresar a la Pista de Hielo es <strong>obligatorio el uso de calcetines largos, pantalones largos y gruesos, y chaqueta o polerón de manga larga</strong>.</li>
                <li style="margin-bottom: 8px;">El <strong>uso de casco es obligatorio</strong> para niños, niñas y adultos.</li>
                <li style="margin-bottom: 8px;"><strong>No se permite ingresar a la Pista de Hielo con celulares, gorros, lentes de sol, cámaras, alimentos, bebidas, mochilas, carteras u otros objetos</strong>. Habrá casilleros disponibles para el resguardo de artículos personales.</li>
                <li style="margin-bottom: 0;">La organización no se responsabiliza por la pérdida, extravío o daño de objetos personales.</li>
              </ul>
            </div>
            <div style="margin-top: 15px; display: flex; align-items: flex-start; gap: 10px;">
              <input type="checkbox" id="rules-checkbox" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px; flex-shrink: 0;" />
              <label for="rules-checkbox" style="cursor: pointer; font-weight: 700; font-size: 0.85rem; color: #0f766e; user-select: none; line-height: 1.4;">
                Declaro haber leído y estar en conocimiento de las normas señaladas, comprometiéndome a cumplirlas.
              </label>
            </div>
          </div>
        `,
        icon: 'warning',
        confirmButtonText: 'Aceptar y Continuar',
        confirmButtonColor: '#0f766e',
        allowOutsideClick: false,
        allowEscapeKey: false,
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

    return () => {
      Swal.close();
    };
  }, [step, rulesAccepted]);

  // Fetch initial schedules for 'patines'
  useEffect(() => {
    const fetchGuardianByRut = async () => {
      const cleanRut = normalizeRut(rut);
      if (isValidChileanRut(rut)) {
        if (cleanRut === loadedRut) return;
        try {
          const { data } = await api.get<Guardian | null>(`/guardians/by-rut/${cleanRut}`);
          if (data) {
            setLoadedRut(cleanRut);
            const normalizedPhone = data.phone ? data.phone.replace(/^\+56\s?9/, '').replace(/^56\s?9/, '') : '';
            setLoadedEmail(data.email ?? '');
            setLoadedPhone(normalizedPhone);
            if (data.name) setName(data.name);
            if (data.email) setEmail(data.email);
            if (normalizedPhone) setPhone(normalizedPhone);
            if (data.address) setAddress(data.address);
            if (data.commune) setCommune(data.commune);
            if (data.villa) setVilla(data.villa);
            if (data.emergencyName) setEmergencyName(data.emergencyName);
            if (data.emergencyPhone) setEmergencyPhone(data.emergencyPhone.replace(/^\+56\s?9/, '').replace(/^56\s?9/, ''));
            
            if (data.dependents && data.dependents.length > 0) {
              const mappedDependents = data.dependents.map(dep => ({
                name: dep.name,
                rut: formatRut(dep.rut),
                age: String(dep.age ?? ''),
                shoeSize: ''
              }));
              setDependents(mappedDependents);
              setIsAccompanied(true);
            }
          } else {
            if (loadedRut) {
              clearForm();
            }
          }
        } catch (error) {
          console.error('Error fetching guardian by rut:', error);
        }
      } else if (loadedRut) {
        clearForm();
      }
    };
    fetchGuardianByRut();
  }, [rut, loadedRut]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoadingSchedules(true);
        const { data } = await api.get<Schedule[]>('/schedules?eventType=patines');
        console.log('[IcePage] Schedules:', data);
        setSchedules(data);
        if (isAllSoldOut(data)) {
          void showSoldOutModal();
        }
      } catch {
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
  }, [showSoldOutModal]);

  // Dependents validations
  const activeDependents = useMemo(() => {
    if (!isAccompanied) return [];
    return dependents.filter((dep) => dep.name.trim().length > 0 || dep.rut.trim().length > 0 || dep.age.trim().length > 0 || dep.shoeSize.trim().length > 0);
  }, [dependents, isAccompanied]);

  const areDependentsValid = useMemo(() => {
    if (!isAccompanied) return true;
    if (activeDependents.length === 0) return false;
    return activeDependents.every(
      (dep) =>
        dep.name.trim().length >= 2 &&
        NAME_REGEX.test(dep.name.trim()) &&
        !hasRepetitiveSpam(dep.name.trim()) &&
        isValidChileanRut(dep.rut) &&
        dep.age.trim().length > 0 &&
        !isNaN(Number(dep.age)) &&
        Number(dep.age) >= MIN_DEPENDENT_AGE &&
        Number(dep.age) <= MAX_DEPENDENT_AGE &&
        dep.shoeSize.trim().length > 0 &&
        !isNaN(Number(dep.shoeSize)) &&
        Number(dep.shoeSize) >= 25 &&
        Number(dep.shoeSize) <= 47,
    );
  }, [activeDependents, isAccompanied]);

  const hasYoungDependentRequiringAdult = useMemo(() => {
    return activeDependents.some((dep) => {
      const age = Number(dep.age);
      return !isNaN(age) && age >= MIN_DEPENDENT_AGE && age <= 7;
    });
  }, [activeDependents]);

  const duplicateRutInForm = useMemo(() => {
    return getDuplicateRut([rut, ...activeDependents.map((dep) => dep.rut)]);
  }, [rut, activeDependents]);

  useEffect(() => {
    if (step !== 1 || adultWantsToSkate !== 'no' || activeDependents.length > 0) {
      hasShownNoParticipantsWarningRef.current = false;
      return;
    }

    if (hasShownNoParticipantsWarningRef.current) return;

    hasShownNoParticipantsWarningRef.current = true;
    void Swal.fire({
      icon: 'warning',
      title: 'Participantes requeridos',
      text: 'Debe existir al menos un participante en la reserva.',
      confirmButtonColor: '#0f766e',
    });
  }, [activeDependents.length, adultWantsToSkate, step]);

  useEffect(() => {
    if (step !== 1 || adultWantsToSkate !== 'no' || !hasYoungDependentRequiringAdult) {
      hasShownYoungDependentWarningRef.current = false;
      return;
    }

    if (hasShownYoungDependentWarningRef.current) return;

    hasShownYoungDependentWarningRef.current = true;
    void Swal.fire({
      icon: 'warning',
      title: 'Acompañamiento obligatorio',
      text: 'Si inscribes menores entre 5 y 7 años, el adulto también debe patinar.',
      confirmButtonColor: '#0f766e',
    });
  }, [adultWantsToSkate, hasYoungDependentRequiringAdult, step]);

  useEffect(() => {
    if (step !== 1 || adultWantsToSkate !== 'no') {
      hasShownAdultNoWarningRef.current = false;
      return;
    }

    if (hasShownAdultNoWarningRef.current) return;

    hasShownAdultNoWarningRef.current = true;
    void Swal.fire({
      icon: 'warning',
      title: 'Participación del adulto',
      text: 'Solo se contabilizarán los menores inscritos como participantes.',
      confirmButtonColor: '#0f766e',
    });
  }, [adultWantsToSkate, step]);

  useEffect(() => {
    if (step !== 1 || !duplicateRutInForm) {
      lastDuplicateRutAlertRef.current = null;
      return;
    }

    if (lastDuplicateRutAlertRef.current === duplicateRutInForm) return;

    lastDuplicateRutAlertRef.current = duplicateRutInForm;
    void Swal.fire({
      icon: 'error',
      title: 'Límite de Reservas',
      text: `El RUT ${duplicateRutInForm} está repetido en esta inscripción. Te recordamos que cada persona puede participar solo una vez por evento.`,
      confirmButtonColor: '#0f766e',
    });
  }, [duplicateRutInForm, step]);

  // General step 1 validation
  const isGuardianNameValid = useMemo(() => {
    const trimmed = name.trim();
    if (!NAME_REGEX.test(trimmed)) return false;
    if (hasRepetitiveSpam(trimmed)) return false;
    const parts = trimmed.split(/\s+/);
    return parts.length >= 2 && parts.every((p) => p.length >= 2);
  }, [name]);

  const isGuardianRutValid = isValidChileanRut(rut);
  const isGuardianEmailValid = EMAIL_REGEX.test(email.trim());
  const isGuardianPhoneValid = CHILEAN_MOBILE_REGEX.test(phone.trim());
  const isEmergencyPhoneValid = CHILEAN_MOBILE_REGEX.test(emergencyPhone.trim());

  const emailSuggestion = useMemo(() => {
    return getEmailSuggestion(email);
  }, [email]);

  const isStep1Valid = useMemo(() => {
    if (!isGuardianNameValid) return false;
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
      const sizeStr = String(adultShoeSize).trim();
      if (sizeStr.length === 0 || isNaN(Number(sizeStr)) || Number(sizeStr) < 25 || Number(sizeStr) > 47) {
        return false;
      }
    }

    if (adultWantsToSkate === 'no' && activeDependents.length === 0) return false;
    if (hasYoungDependentRequiringAdult && adultWantsToSkate !== 'si') return false;
    if (!areDependentsValid) return false;
    if (duplicateRutInForm) return false;
    return true;
  }, [
    activeDependents.length,
    areDependentsValid, 
    isGuardianEmailValid, 
    isGuardianPhoneValid, 
    isGuardianRutValid, 
    isGuardianNameValid, 
    address, 
    commune, 
    emergencyName, 
    isEmergencyPhoneValid, 
    adultWantsToSkate, 
    adultShoeSize,
    hasYoungDependentRequiringAdult,
    duplicateRutInForm,
  ]);

  // Total attendees including guardian only if they choose to skate
  const totalAttendees = (adultWantsToSkate === 'si' ? 1 : 0) + activeDependents.length;

  // Date lists for selector (Step 2)
  const availableDateKeys = useMemo(() => {
    const uniqueDates = Array.from(
      new Set(
        schedules
          .filter((schedule) => new Date(schedule.startTime).getTime() > currentTimestamp)
          .map((schedule) => toChileDateKey(schedule.startTime)),
      ),
    );
    return uniqueDates.sort((a, b) => a.localeCompare(b));
  }, [currentTimestamp, schedules]);

  const resolvedSelectedDateKey = useMemo(() => {
    if (availableDateKeys.length === 0) return '';
    if (selectedDateKey && availableDateKeys.includes(selectedDateKey)) return selectedDateKey;
    if (preferredDateKey && availableDateKeys.includes(preferredDateKey)) return preferredDateKey;
    return availableDateKeys[0];
  }, [availableDateKeys, preferredDateKey, selectedDateKey]);

  // Filtered schedules based on active date selection
  const activeSchedulesForSelectedDate = useMemo(() => {
    if (!resolvedSelectedDateKey) return [];
    return schedules
      .filter(
        (schedule) =>
          toChileDateKey(schedule.startTime) === resolvedSelectedDateKey && new Date(schedule.startTime).getTime() > currentTimestamp,
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [currentTimestamp, resolvedSelectedDateKey, schedules]);

  const selectedSchedule = useMemo(() => {
    return activeSchedulesForSelectedDate.find((s) => s._id === selectedScheduleId) ?? null;
  }, [activeSchedulesForSelectedDate, selectedScheduleId]);

  const isStep2Valid = useMemo(() => {
    if (!selectedSchedule) return false;
    return selectedSchedule.availableSpots >= totalAttendees;
  }, [selectedSchedule, totalAttendees]);

  // Handlers for step 1 dependents
  const handleChangeDependent = (index: number, field: keyof DependentFormItem, value: string | number) => {
    const stringValue = String(value);
    let sanitizedValue = stringValue;
    if (field === 'name') {
      sanitizedValue = stringValue.replace(/\d/g, '');
    } else if (field === 'age') {
      sanitizedValue = stringValue.replace(/\D/g, '');
    } else if (field === 'shoeSize') {
      sanitizedValue = stringValue.replace(/\D/g, '');
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

  const handleGoToStep2 = async () => {
    if (!isStep1Valid) {
      console.warn('[IcePage] Cancelado: el paso 1 no es válido.');
      return;
    }

    if (duplicateRutInForm) {
      void Swal.fire({
        icon: 'error',
        title: 'Límite de Reservas',
        text: `El RUT ${duplicateRutInForm} está repetido en esta inscripción. Te recordamos que cada persona puede participar solo una vez por evento.`,
        confirmButtonColor: '#0f766e',
      });
      return;
    }

    try {
      setValidatingRuts(true);
      const cleanTutorRut = formatRut(rut).toUpperCase();
      const dependentRuts = activeDependents.map((d) => formatRut(d.rut).toUpperCase());
      const trimmedEmail = email.trim();
      const normalizedPhone = `+569${phone.trim()}`;

      const { data: precheck } = await api.post<{
        rutRegisteredByValue: Record<string, boolean>;
        emailAvailable: boolean;
        phoneAvailable: boolean;
      }>('/reservations/precheck', {
        eventType: EVENT_TYPE,
        ruts: [cleanTutorRut, ...dependentRuts],
        email: trimmedEmail,
        phone: normalizedPhone,
      });

      if (precheck.rutRegisteredByValue[cleanTutorRut]) {
        void Swal.fire({
          icon: 'error',
          title: 'Límite de Reservas',
          text: 'El RUT del inscrito ya cuenta con una reserva activa o concluida para esta actividad (como tutor o acompañante). Te recordamos que cada persona puede participar solo una vez por evento.',
          confirmButtonColor: '#0f766e',
        });
        setValidatingRuts(false);
        return;
      }

      for (const depRut of dependentRuts) {
        if (precheck.rutRegisteredByValue[depRut]) {
          void Swal.fire({
            icon: 'error',
            title: 'Límite de Reservas',
            text: `El acompañante con RUT ${depRut} ya cuenta con una reserva activa o concluida para esta actividad (como tutor o acompañante). Te recordamos que cada persona puede participar solo una vez por evento.`,
            confirmButtonColor: '#0f766e',
          });
          setValidatingRuts(false);
          return;
        }
      }

      if (trimmedEmail !== loadedEmail) {
        if (!precheck.emailAvailable) {
          void Swal.fire({
            icon: 'error',
            title: 'Datos en Uso',
            text: 'El correo ingresado ya pertenece a otra persona registrada. Por favor, utiliza otro correo.',
            confirmButtonColor: '#0f766e',
          });
          setValidatingRuts(false);
          return;
        }
      }

      if (phone.trim() !== loadedPhone) {
        if (!precheck.phoneAvailable) {
          void Swal.fire({
            icon: 'error',
            title: 'Datos en Uso',
            text: 'El teléfono ingresado ya pertenece a otra persona registrada. Por favor, utiliza otro teléfono.',
            confirmButtonColor: '#0f766e',
          });
          setValidatingRuts(false);
          return;
        }
      }

      if (!admissionSessionId) {
        setAdmissionRemainingSec(null);
        void Swal.fire({
          icon: 'warning',
          title: 'Espera tu turno',
          text: 'Aun no tienes cupo para continuar. Espera un momento e intenta nuevamente.',
          confirmButtonColor: '#0f766e',
        });
        return;
      }

      setStep(2);
    } catch (error) {
      console.error('Error validating RUTs:', error);
      void Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema. Por favor, inténtelo de nuevo.',
        confirmButtonColor: '#0f766e',
      });
    } finally {
      setValidatingRuts(false);
    }
  };

  // Main Submit handler (Step 3 Confirm)
  const handleSubmitEnrollment = async () => {
    if (!isStep1Valid || !isStep2Valid || !selectedSchedule) return;

    try {
      setSubmitting(true);

      if (!admissionSessionId) {
        await Swal.fire({
          icon: 'warning',
          title: 'Tiempo agotado',
          text: 'Tu turno en el formulario expiró 💣. Debes volver a ingresar.',
          confirmButtonColor: '#0f766e',
        });
        navigate('/home');
        return;
      }

      const submitResult = await submitAdmission(EVENT_TYPE, admissionSessionId);
      if (!submitResult.success) {
        setAdmissionSessionId(null);
        setAdmissionRemainingSec(null);
        await Swal.fire({
          icon: 'warning',
          title: 'Tiempo agotado',
          text: 'Tu turno en el formulario expiró 💣. Debes volver a ingresar.',
          confirmButtonColor: '#0f766e',
        });
        navigate('/home');
        return;
      }

      await leaveAdmission(EVENT_TYPE, admissionSessionId);
      setAdmissionSessionId(null);
      setAdmissionRemainingSec(null);

      // 1. Create guardian (sin dependientes en su ficha)
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
        acceptMarketing,
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

      // 3. Create reservation immediately (guardando aquí los dependientes con edad)
      const reservationPayload = {
        scheduleId: selectedSchedule._id,
        guardianId: createdGuardian._id,
        guardianParticipates: adultWantsToSkate === 'si',
        attendingDependents: activeDependents.map((dep) => ({
          name: dep.name.trim(),
          rut: dep.rut.trim(),
          age: Number(dep.age),
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
        } catch {
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
                <Typography className={`selva-step-label ${step === 1 ? 'active' : ''}`}>Datos Inscrito</Typography>
                <Typography className={`selva-step-label ${step === 2 ? 'active' : ''}`}>Elegir horario</Typography>
                <Typography className={`selva-step-label ${step === 3 ? 'active' : ''}`}>Confirmar</Typography>
              </Box>
            </Box>
          )}

          {step <= 3 && <Divider className="selva-step-divider" />}

          {step <= 3 && admissionSessionId && admissionRemainingSec !== null && (
            <Box
              sx={{
                mt: 0.25,
                mb: 1.2,
                px: 1.2,
                py: 0.45,
                minHeight: '44px',
                width: '100%',
                maxWidth: '320px',
                mx: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.78rem',
                letterSpacing: '0.01em',
                color: getCountdownColor(admissionRemainingSec),
                backgroundColor: getCountdownBackground(admissionRemainingSec),
                border: `1px solid ${getCountdownBorder(admissionRemainingSec)}`,
              }}
            >
              Tu turno expira en {formatCountdownLabel(admissionRemainingSec)}
            </Box>
          )}

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
                error={name.trim().length > 0 && !isGuardianNameValid}
                helperText={
                  name.trim().length > 0 && !isGuardianNameValid
                    ? hasRepetitiveSpam(name)
                      ? 'Por favor, evita repetir letras consecutivas de forma innecesaria en el nombre.'
                      : 'Ingresa Nombre y Apellido (mínimo dos palabras, solo letras).'
                    : ''
                }
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
                helperText={
                  email.trim().length > 0 && !isGuardianEmailValid
                    ? 'Ingresa un correo válido.'
                    : 'Ejemplo: nombre@correo.cl'
                }
                required
                fullWidth
              />

              {emailSuggestion && (
                <Typography
                  variant="caption"
                  color="primary"
                  style={{ cursor: 'pointer', display: 'block', marginTop: '-12px', marginBottom: '12px', fontWeight: 'bold' }}
                  onClick={() => setEmail(emailSuggestion)}
                >
                  ¿Quisiste decir <strong>{emailSuggestion}</strong>?
                </Typography>
              )}

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
                helperText={
                  phone.trim().length > 0 && !isGuardianPhoneValid
                    ? 'Deben ser 8 dígitos.'
                    : ''
                }
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
                    Registrar Acompañantes (Edades permitidas: 5 a 17 años)
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
                            error={dependent.name.trim().length > 0 && (!NAME_REGEX.test(dependent.name.trim()) || dependent.name.trim().length < 2 || hasRepetitiveSpam(dependent.name))}
                            helperText={
                              dependent.name.trim().length > 0 && (!NAME_REGEX.test(dependent.name.trim()) || dependent.name.trim().length < 2 || hasRepetitiveSpam(dependent.name))
                                ? hasRepetitiveSpam(dependent.name)
                                  ? 'Evita repetir letras consecutivas.'
                                  : 'Nombre inválido (solo letras)'
                                : ''
                            }
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
                             inputProps={{ inputMode: 'numeric', maxLength: 3 }}
                             error={dependent.age.trim().length > 0 && (isNaN(Number(dependent.age)) || Number(dependent.age) < MIN_DEPENDENT_AGE || Number(dependent.age) > MAX_DEPENDENT_AGE)}
                             helperText={
                               dependent.age.trim().length > 0 && (isNaN(Number(dependent.age)) || Number(dependent.age) < MIN_DEPENDENT_AGE || Number(dependent.age) > MAX_DEPENDENT_AGE)
                                 ? 'Edad permitida: 5 a 17 años'
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

              <Box
                className="selva-wizard-actions"
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 1,
                }}
              >
                {!admissionSessionId && rulesAccepted && (
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Esperando turno para continuar al siguiente paso...
                  </Typography>
                )}
                <Button
                  variant="contained"
                  onClick={handleGoToStep2}
                  disabled={!isStep1Valid || validatingRuts || !admissionSessionId}
                  className="selva-wizard-next-btn"
                  fullWidth
                  endIcon={validatingRuts ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                >
                  {validatingRuts ? 'Validando...' : !admissionSessionId ? 'Esperando turno...' : 'Continuar'}
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
                      value={resolvedSelectedDateKey}
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
                    {activeSchedulesForSelectedDate.map((schedule) => {
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

                    {activeSchedulesForSelectedDate.length === 0 && (
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
                  <Typography className="selva-summary-section-title">Inscrito</Typography>
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
                  label="Acepto que la Corporación me envíe información sobre actividades futuras" />
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
                <Typography variant="h6" className="selva-step-title centered" sx={{ m: 0, fontWeight: 700 }}>
                  ¡Tu solicitud fue recibida!
                </Typography>
              </Box>

              <Box className="selva-summary-container">
                {/* Detalle del Horario */}
                <Box className="selva-summary-section schedule-highlight" style={{ textAlign: 'center', padding: '16px 8px' }}>
                  <Typography variant="h6" sx={{ color: '#0f766e', fontWeight: 700, fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    🗓️ {createdReservation.dateLabel} - {createdReservation.timeLabel} horas
                  </Typography>
                </Box>

                <Divider />

                {/* Notas e Indicaciones */}
                <Box className="selva-summary-section">
                  <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                    <Box className="selva-confirmation-item warning-highlight" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(148, 163, 184, 0.25)', padding: '18px', borderRadius: '16px', display: 'flex', alignItems: 'flex-start', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.02)' }}>
                      <span className="selva-bullet-warning" style={{ color: '#d97706', marginTop: '2px', display: 'inline-flex' }}>
                        <Warning className="warning-icon" sx={{ fontSize: '24px' }} />
                      </span>
                      <Typography style={{ color: '#1e293b', fontWeight: 500, fontSize: '0.92rem', lineHeight: 1.5, marginLeft: '10px' }}>
                        Para completar el proceso, revisa tu correo electrónico y <strong style={{ color: '#dc2626' }}>confirma tu reserva</strong> <strong>dentro de los próximos 5 minutos</strong>.
                        <br /><br />
                        Si no confirmas en ese plazo, la solicitud se cancelará automáticamente.
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Box>

              <Box className="selva-confirmation-actions" style={{ justifyContent: 'center', alignItems: 'center', alignSelf: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={handleGoHome}
                  className="selva-volver-btn"
                  style={{ maxWidth: '200px', width: '100%', margin: '0 auto', flex: 'none' }}
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
