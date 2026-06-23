# Frontend Reservas

Frontend en React + TypeScript + Vite para gestionar reservas de actividades.

## Flujos principales

- `Selva Viva`: `src/pages/SelvaPage.tsx`
- `Pista de Hielo`: `src/pages/IcePage.tsx`
- `Login`: `src/pages/LoginPage.tsx`

## Requisitos

- Node `22.x`
- npm `10.x`

## Variables de entorno

Crear `.env` con al menos:

```env
VITE_API_URL=http://localhost:3500
```

Si no se define, el frontend usa `http://localhost:3500` por defecto.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run start
```

## Rutas principales

- `/home`
- `/login`
- `/selva`
- `/hielo`

## Validaciones implementadas

### Selva Viva

- RUT del inscrito valido
- RUT de acompanantes validos
- no repetir RUT dentro del mismo formulario
- no permitir RUT ya inscrito en el evento `selva`
- prevalidacion de email con `GET /guardians/check-email/:email`
- prevalidacion de telefono con `GET /guardians/check-phone/:phone`
- email y telefono ya registrados informados con `SweetAlert`
- advertencias y errores de validacion mostrados con `SweetAlert`
- proteccion para no marcar como duplicado el email o telefono del mismo guardian cargado por RUT
- solo se muestran horarios futuros

### Pista de Hielo

- RUT del inscrito valido
- RUT de acompanantes validos
- no repetir RUT dentro del mismo formulario
- no permitir RUT ya inscrito en el evento `patines`
- prevalidacion de email con `GET /guardians/check-email/:email`
- prevalidacion de telefono con `GET /guardians/check-phone/:phone`
- email y telefono ya registrados informados con `SweetAlert`
- advertencias y errores de validacion mostrados con `SweetAlert`
- no permitir reservas sin participante real
- acompanantes permitidos solo entre `5` y `17` anos
- si hay menores entre `5` y `7`, el adulto debe marcar que tambien patina
- solo se muestran horarios futuros

## Sesion y autenticacion

- el token se guarda en `localStorage` como `accessToken`
- existe cierre por inactividad en frontend despues de `2 minutos`
- al expirar por inactividad, el usuario vuelve a `/login`

## WebSocket

La actualizacion de cupos en tiempo real usa `socket.io-client` desde `src/services/api.ts`.

## Estado actual del lint

- `IcePage.tsx` y `SelvaPage.tsx` quedaron ajustados a las reglas actuales del proyecto
- el lint global del repo aun puede tener deuda tecnica en otros archivos no tocados

## Documentacion interna

Si se modifica `IcePage.tsx` o `SelvaPage.tsx`, actualizar tambien:

- `informe-funcionalidades-validacion.md`
- `informe-selvapage-validaciones.md` cuando el cambio afecte `SelvaPage`
