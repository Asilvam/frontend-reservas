import { Add, DeleteOutlined } from '@mui/icons-material';
import { Box, Button, Container, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { api } from '../services/api';
import type { CreateGuardianPayload } from '../types';
import '../styles/register-guardian-page.css';

const MAX_DEPENDENTS = 3;

type DependentFormItem = {
  name: string;
  rut: string;
};

const EMPTY_DEPENDENT: DependentFormItem = { name: '', rut: '' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHILEAN_MOBILE_REGEX = /^\+569\d{8}$/;
const CHILEAN_RUT_FORMAT_REGEX = /^\d+-[\dK]$/i;

function normalizeRut(rawRut: string) {
  return rawRut.replace(/-/g, '').trim().toUpperCase();
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

export function RegisterGuardianPage() {
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dependents, setDependents] = useState<DependentFormItem[]>([{ ...EMPTY_DEPENDENT }]);
  const [submitting, setSubmitting] = useState(false);

  const canAddDependent = dependents.length < MAX_DEPENDENTS;

  const isGuardianRutValid = isValidChileanRut(rut);
  const isGuardianEmailValid = EMAIL_REGEX.test(email.trim());
  const isGuardianPhoneValid = CHILEAN_MOBILE_REGEX.test(phone.trim());
  const areDependentsValid = dependents.every(
    (dep) => dep.name.trim().length >= 2 && isValidChileanRut(dep.rut),
  );

  const isValid = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (!isGuardianRutValid) return false;
    if (!isGuardianEmailValid) return false;
    if (!isGuardianPhoneValid) return false;
    if (!areDependentsValid) return false;

    return dependents.length > 0;
  }, [areDependentsValid, dependents.length, isGuardianEmailValid, isGuardianPhoneValid, isGuardianRutValid, name]);

  const handleChangeDependent = (index: number, field: keyof DependentFormItem, value: string) => {
    setDependents((prev) =>
      prev.map((dep, i) => (i === index ? { ...dep, [field]: value } : dep)),
    );
  };

  const handleAddDependent = () => {
    if (!canAddDependent) return;
    setDependents((prev) => [...prev, { ...EMPTY_DEPENDENT }]);
  };

  const handleRemoveDependent = (index: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('accessToken');
      const payload: CreateGuardianPayload = {
        name: name.trim(),
        rut: rut.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dependents: dependents
          .map((dependent) => ({
            name: dependent.name.trim(),
            rut: dependent.rut.trim(),
          }))
          .filter((dependent) => dependent.name && dependent.rut),
      };

      await api.post('/guardians', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      void Swal.fire({
        icon: 'success',
        title: 'Apoderado registrado',
        text: 'El apoderado y sus cargas se crearon correctamente.',
        confirmButtonColor: '#1E3A8A',
      });

      setName('');
      setRut('');
      setEmail('');
      setPhone('');
      setDependents([{ ...EMPTY_DEPENDENT }]);
    } catch (error: unknown) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response?.status === 'number'
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      const backendMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : '';

      const duplicateRutMessage =
        status === 409 || (backendMessage ?? '').toLowerCase().includes('rut already exists');

      void Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar',
        text: duplicateRutMessage
          ? 'Ya existe un apoderado registrado con ese RUT.'
          : 'Revisa los datos e intenta nuevamente.',
        confirmButtonColor: '#1E3A8A',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" className="register-layout">
      <Paper elevation={2} className="register-card">
        <Typography variant="h5" className="register-title">
          Registrar apoderado
        </Typography>
        <Stack component="form" spacing={2} onSubmit={handleSubmit} className="register-form">
          <TextField
            label="Nombre del apoderado"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <TextField
            label="RUT del apoderado"
            value={rut}
            onChange={(event) => setRut(event.target.value)}
            placeholder="12345678-5"
            error={rut.trim().length > 0 && !isGuardianRutValid}
            helperText={rut.trim().length > 0 && !isGuardianRutValid ? 'RUT chileno invalido.' : 'Formato: 12345678-5'}
            required
          />

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={email.trim().length > 0 && !isGuardianEmailValid}
            helperText={email.trim().length > 0 && !isGuardianEmailValid ? 'Ingresa un correo valido.' : 'Ejemplo: nombre@correo.cl'}
            required
          />

          <TextField
            label="Telefono"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^+\d]/g, ''))}
            placeholder="+56912345678"
            slotProps={{ htmlInput: { inputMode: 'tel', pattern: '\\+569[0-9]{8}', maxLength: 12 } }}
            error={phone.trim().length > 0 && !isGuardianPhoneValid}
            helperText={
              phone.trim().length > 0 && !isGuardianPhoneValid
                ? 'Debe ser +569 seguido de 8 digitos.'
                : 'Formato obligatorio: +56912345678'
            }
            required
          />

          <Box>
            <Typography variant="subtitle1" className="register-section-title">
              Cargas
            </Typography>
            <Stack spacing={1.2} className="register-dependents-list">
              {dependents.map((dependent, index) => (
                <Box key={`dependent-${index}`} className="register-dependent-row">
                  <Box className="register-dependent-fields">
                    <TextField
                      fullWidth
                      label={`Nombre carga ${index + 1}`}
                      value={dependent.name}
                      onChange={(event) => handleChangeDependent(index, 'name', event.target.value)}
                    />
                    <TextField
                      fullWidth
                      label={`RUT carga ${index + 1}`}
                      value={dependent.rut}
                      onChange={(event) => handleChangeDependent(index, 'rut', event.target.value)}
                      placeholder="12345678-5"
                      error={dependent.rut.trim().length > 0 && !isValidChileanRut(dependent.rut)}
                      helperText={
                        dependent.rut.trim().length > 0 && !isValidChileanRut(dependent.rut)
                          ? 'RUT invalido'
                          : 'Formato: 12345678-5'
                      }
                    />
                  </Box>
                  <IconButton
                    color="error"
                    onClick={() => handleRemoveDependent(index)}
                    disabled={dependents.length === 1}
                    aria-label="Eliminar carga"
                  >
                    <DeleteOutlined />
                  </IconButton>
                </Box>
              ))}
            </Stack>

            <Box className="register-divider" />

            <Button
              type="button"
              variant="outlined"
              startIcon={<Add />}
              className="register-add-dependent-btn"
              disabled={!canAddDependent}
              onClick={handleAddDependent}
            >
              Agregar carga ({dependents.length}/{MAX_DEPENDENTS})
            </Button>
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || submitting}
            className="register-submit-btn"
          >
            {submitting ? 'Guardando...' : 'Crear apoderado'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export default RegisterGuardianPage;
