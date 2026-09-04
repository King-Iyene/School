interface ICSEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_type: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location?: string | null;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toDateStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildVEvent(ev: ICSEvent, schoolName: string): string {
  const dateOnly = ev.event_date.replace(/-/g, '');
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${ev.id}@ogs-school`,
    `DTSTAMP:${toDateStamp(new Date())}`,
    `SUMMARY:${escapeICSText(ev.title)}`,
  ];

  if (ev.all_day || !ev.start_time) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly}`);
    lines.push(`DTEND;VALUE=DATE:${addDays(ev.event_date, 1).replace(/-/g, '')}`);
  } else {
    const start = ev.start_time.replace(':', '').padEnd(6, '0');
    const end = (ev.end_time || ev.start_time).replace(':', '').padEnd(6, '0');
    lines.push(`DTSTART:${dateOnly}T${start}`);
    lines.push(`DTEND:${dateOnly}T${end}`);
  }

  const descriptionParts = [ev.description, `Event type: ${ev.event_type}`, schoolName].filter(Boolean);
  lines.push(`DESCRIPTION:${escapeICSText(descriptionParts.join('\\n'))}`);
  if (ev.location) lines.push(`LOCATION:${escapeICSText(ev.location)}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function wrapCalendar(vevents: string[], calendarName: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OGS School//Events//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadEventICS(event: ICSEvent, schoolName = 'School') {
  const content = wrapCalendar([buildVEvent(event, schoolName)], event.title);
  downloadICS(`${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'event'}.ics`, content);
}

export function downloadEventsICS(events: ICSEvent[], calendarName = 'School Events') {
  const content = wrapCalendar(events.map(ev => buildVEvent(ev, calendarName)), calendarName);
  downloadICS(`${calendarName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'events'}.ics`, content);
}
