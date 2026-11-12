import { BlockList, isIP } from 'net';
import { lookup as dnsLookup, LookupAddress } from 'dns';
import { request as httpRequest, IncomingMessage } from 'http';
import { request as httpsRequest } from 'https';

/** How far ahead a calendar is read and published. */
export const HOTEL_ICAL_HORIZON_DAYS = 730;
const MAX_ICAL_BYTES = 2 * 1024 * 1024;
const MAX_ICAL_EVENTS = 5000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_UNITS_PER_NIGHT = 1000;

export class HotelIcalError extends Error {}

const day = (value: Date) => value.toISOString().slice(0, 10);
const addDays = (value: string, days: number) =>
  day(new Date(Date.parse(`${value}T00:00:00Z`) + days * 86400000));

// Addresses a calendar link must never reach: the server itself and private networks.
const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
  ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['2002::', 16],
] as const)
  blocked.addSubnet(network, prefix, 'ipv6');

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family) return false;
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return isPublicAddress(mapped[1]);
    return !blocked.check(address, 'ipv6');
  }
  return !blocked.check(address, 'ipv4');
}

/** Only plain web links to a public host are read. */
export function parseIcalUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(String(value).trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    throw new HotelIcalError('Lien de calendrier invalide.');
  }
  if (!['https:', 'http:'].includes(url.protocol))
    throw new HotelIcalError('Le lien du calendrier doit commencer par https://.');
  if (url.username || url.password)
    throw new HotelIcalError('Le lien du calendrier ne doit pas contenir d’identifiants.');
  if (url.port && !['80', '443'].includes(url.port))
    throw new HotelIcalError('Le lien du calendrier doit utiliser un port web standard.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) ? !isPublicAddress(host) : !host.includes('.') || /\.(local|internal|localhost)$/i.test(host) || host === 'localhost')
    throw new HotelIcalError('Le lien du calendrier doit pointer vers un site public.');
  if (url.toString().length > 2000) throw new HotelIcalError('Lien de calendrier trop long.');
  return url;
}

// Checked at connection time, so a name cannot resolve to a public address first and a
// private one when the request is sent.
function safeLookup(
  hostname: string,
  options: any,
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    const unsafe = addresses.find((entry) => !isPublicAddress(entry.address));
    if (!addresses.length || unsafe)
      return callback(Object.assign(new Error('blocked address'), { code: 'EPENCMIBLOCKED' }), '', 0);
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

function getOnce(url: URL): Promise<{ status: number; location?: string; body?: string }> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = send(
      url,
      {
        method: 'GET',
        lookup: safeLookup as any,
        timeout: FETCH_TIMEOUT_MS,
        headers: { accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1', 'user-agent': 'Pencmi-Calendar/1.0' },
      },
      (response: IncomingMessage) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          response.resume();
          return resolve({ status, location: response.headers.location });
        }
        if (status !== 200) {
          response.resume();
          return resolve({ status });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_ICAL_BYTES) {
            request.destroy();
            reject(new HotelIcalError('Le calendrier dépasse la taille autorisée (2 Mo).'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }));
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new HotelIcalError('Le site du calendrier ne répond pas.')));
    request.on('error', (error: any) =>
      reject(
        error instanceof HotelIcalError
          ? error
          : new HotelIcalError(
              error?.code === 'EPENCMIBLOCKED'
                ? 'Le lien du calendrier doit pointer vers un site public.'
                : 'Le calendrier est injoignable.',
            ),
      ),
    );
    request.end();
  });
}

/** Downloads a calendar, following a few redirects that are checked like the link itself. */
export async function fetchIcal(value: string, fetchOnce = getOnce): Promise<string> {
  let url = parseIcalUrl(value);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchOnce(url);
    if (response.location && response.status >= 300 && response.status < 400) {
      url = parseIcalUrl(new URL(response.location, url).toString());
      continue;
    }
    if (response.status === 404 || response.status === 410)
      throw new HotelIcalError('Le calendrier n’existe plus à cette adresse.');
    if (response.status === 401 || response.status === 403)
      throw new HotelIcalError('Le calendrier n’est pas accessible publiquement.');
    if (response.status !== 200 || response.body === undefined)
      throw new HotelIcalError(`Le site du calendrier a répondu par une erreur (${response.status}).`);
    return response.body;
  }
  throw new HotelIcalError('Le lien du calendrier redirige trop de fois.');
}

function icalDate(value: string | undefined) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value || '');
  if (!match) return null;
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isNaN(Date.parse(`${result}T00:00:00Z`)) ? null : result;
}

/**
 * Occupied units per night from a calendar: each event blocks the nights from its start
 * to the day before its end. Cancelled and "free" events are ignored. Recurring events
 * only block their first occurrence: booking calendars do not use them.
 */
export function parseIcalNights(
  text: string,
  options: { unitsPerEvent: number; today: Date },
): Map<string, number> {
  if (!/BEGIN:VCALENDAR/i.test(text))
    throw new HotelIcalError('Ce lien ne renvoie pas un calendrier iCal.');
  const from = day(options.today);
  const until = addDays(from, HOTEL_ICAL_HORIZON_DAYS);
  const nights = new Map<string, number>();
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  let event: Record<string, string> | null = null;
  let events = 0;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (event) {
        events += 1;
        if (events > MAX_ICAL_EVENTS)
          throw new HotelIcalError('Le calendrier contient trop d’événements.');
        const status = (event.STATUS || '').toUpperCase();
        const transparent = (event.TRANSP || '').toUpperCase() === 'TRANSPARENT';
        const start = icalDate(event.DTSTART);
        if (start && status !== 'CANCELLED' && !transparent) {
          let end = icalDate(event.DTEND);
          if (!end || end <= start) end = addDays(start, 1);
          let night = start < from ? from : start;
          const last = end < until ? end : until;
          while (night < last) {
            nights.set(night, Math.min(MAX_UNITS_PER_NIGHT, (nights.get(night) || 0) + options.unitsPerEvent));
            night = addDays(night, 1);
          }
        }
      }
      event = null;
      continue;
    }
    if (!event) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    if (!(name in event)) event[name] = line.slice(colon + 1).trim();
  }
  return nights;
}

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines are folded under 75 octets; 60 characters stay under it even with accents.
function fold(line: string) {
  const parts: string[] = [];
  for (let index = 0; index < line.length; index += 60) parts.push(line.slice(index, index + 60));
  return parts.join('\r\n ');
}

export type HotelIcalStay = { uid: string; start: string; end: string };

/**
 * The calendar the hotel software reads: one event per reserved unit, without any
 * information about the guest.
 */
export function buildIcal(calendarName: string, stays: HotelIcalStay[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pencmi//Calendrier hotel//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const stay of stays)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${stay.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${stay.start.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${stay.end.replace(/-/g, '')}`,
      'SUMMARY:Réservation Pencmi',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Groups the nights Pencmi holds for each reservation into stays: consecutive nights
 * with the same number of units, one event per unit.
 */
export function icalStaysFromAllocations(
  allocations: { requestId: string; date: Date; units: number }[],
): HotelIcalStay[] {
  const byRequest = new Map<string, { date: string; units: number }[]>();
  for (const allocation of allocations) {
    const list = byRequest.get(allocation.requestId) || [];
    list.push({ date: day(allocation.date), units: allocation.units });
    byRequest.set(allocation.requestId, list);
  }
  const stays: HotelIcalStay[] = [];
  for (const [requestId, nights] of byRequest) {
    nights.sort((a, b) => a.date.localeCompare(b.date));
    let run = 0;
    for (let index = 0; index < nights.length; index += 1) {
      const next = nights[index + 1];
      if (next && next.date === addDays(nights[index].date, 1) && next.units === nights[index].units) continue;
      const start = nights[run].date;
      const end = addDays(nights[index].date, 1);
      for (let unit = 1; unit <= nights[index].units; unit += 1)
        stays.push({ uid: `${requestId}-${start}-${unit}@pencmi`, start, end });
      run = index + 1;
    }
  }
  return stays;
}
