import { Add, DeleteOutlined } from '@mui/icons-material';
import { Box, Button, Checkbox, Container, FormControlLabel, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { api } from '../services/api';
import type { CreateGuardianPayload } from '../types';
import '../styles/register-guardian-page.css';

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

export function RegisterGuardianPage() {
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [isAccompanied, setIsAccompanied] = useState(false);
  const [dependents, setDependents] = useState<DependentFormItem[]>([{ ...EMPTY_DEPENDENT }]);
  const [submitting, setSubmitting] = useState(false);

  const canAddDependent = dependents.length < MAX_DEPENDENTS;

  const isGuardianRutValid = isValidChileanRut(rut);
  const isGuardianEmailValid = EMAIL_REGEX.test(email.trim());
  const isGuardianPhoneValid = CHILEAN_MOBILE_REGEX.test(phone.trim());

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

  const isValid = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (!isGuardianRutValid) return false;
    if (!isGuardianEmailValid) return false;
    if (!isGuardianPhoneValid) return false;
    if (address.trim().length < 2) return false;
    if (commune.trim().length < 2) return false;
    if (!areDependentsValid) return false;

    return true;
  }, [areDependentsValid, isGuardianEmailValid, isGuardianPhoneValid, isGuardianRutValid, name, address, commune]);

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
        phone: `+569${phone.trim()}`,
        address: address.trim(),
        commune: commune.trim(),
        dependents: activeDependents.map((dependent) => ({
          name: dependent.name.trim(),
          rut: dependent.rut.trim(),
          age: Number(dependent.age),
        })),
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
      setAddress('');
      setCommune('');
      setIsAccompanied(false);
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
          Registrar
        </Typography>
        <Stack component="form" spacing={2} onSubmit={handleSubmit} className="register-form">
          <TextField
            label="Nombre y Apellido"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <TextField
            label="RUT"
            value={rut}
            onChange={(event) => setRut(formatRut(event.target.value))}
            placeholder="12345678-5"
            error={rut.trim().length > 0 && !isGuardianRutValid}
            helperText={rut.trim().length > 0 && !isGuardianRutValid ? 'RUT chileno invalido.' : 'Sin Puntos y con guion'}
            required
          />

          <TextField
              label="Dirección"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Ejemplo: Av. Vitacura 1230, Depto 40"
              error={address.trim().length > 0 && address.trim().length < 2}
              helperText={address.trim().length > 0 && address.trim().length < 2 ? 'Dirección muy corta.' : ''}
              required
          />

          <TextField
              label="Comuna"
              value={commune}
              onChange={(event) => setCommune(event.target.value)}
              placeholder="Ejemplo: Santiago"
              error={commune.trim().length > 0 && commune.trim().length < 2}
              helperText={commune.trim().length > 0 && commune.trim().length < 2 ? 'Comuna muy corta.' : ''}
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
                ? 'Debe tener exactamente 8 digitos.'
                : 'Ejemplo: 12345678'
            }
            required
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

          {isAccompanied ? (
            <Box>
              <Typography variant="subtitle1" className="register-section-title">
                Acompañantes
              </Typography>
              <Stack spacing={1.2} className="register-dependents-list">
                {dependents.map((dependent, index) => (
                  <Box key={`dependent-${index}`} className="register-dependent-row">
                    <Box className="register-dependent-fields">
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
                            ? 'RUT invalido'
                            : ''
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
                            ? 'Edad invalida'
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
                {dependents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" style={{ fontStyle: 'italic', marginBlock: '0.5rem' }}>
                    Sin acompañantes agregados. Puedes agregar hasta 3 acompañantes opcionalmente.
                  </Typography>
                ) : null}
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
                Agregar Acompañante ({dependents.length}/{MAX_DEPENDENTS})
              </Button>
            </Box>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || submitting}
            className="register-submit-btn"
          >
            {submitting ? 'Guardando...' : 'Crear registro'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export default RegisterGuardianPage;
