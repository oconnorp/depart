export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatTimeParts(hour: number, minute: number): string {
  return formatTime(new Date(2000, 0, 1, hour, minute, 0, 0));
}
