export const CHILE_TIMEZONE = 'America/Santiago';

const chileDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const chileDateLabelFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIMEZONE,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const chileTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const isValidDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const toChileDateKey = (value: string | Date) => {
  const parts = chileDateKeyFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

export const formatChileDateLabel = (dateKey: string) => {
  const utcNoonDate = new Date(`${dateKey}T12:00:00Z`);
  const label = chileDateLabelFormatter.format(utcNoonDate);
  return label.replace(/^\w/, (char) => char.toUpperCase());
};

export const formatChileTime = (value: string | Date) => chileTimeFormatter.format(new Date(value));
