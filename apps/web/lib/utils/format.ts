export function formatCurrency(amount: string, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
}

export function formatSignedCurrency(amount: string, currency: string): string {
  const value = Number(amount);
  const formatted = formatCurrency(String(Math.abs(value)), currency);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}
