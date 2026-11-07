export interface M3UChannel {
  id: string;
  name: string;
  group: string;
  language: string;
  logo: string;
  url: string;
  userAgent: string;
  referrer: string;
  region?: string;
}

export interface GuideProgram {
  title: string;
  start: number;
  stop: number;
  /** Programme synopsis/description when the EPG source provides one. */
  desc?: string;
}

function findUnquotedComma(value: string): number {
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    else if (value[index] === ',' && !quoted) return index;
  }
  return -1;
}

function attribute(source: string, name: string): string {
  const match = source.match(new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}="([^"]*)"`, 'i'));
  return match?.[1]?.trim() ?? '';
}

export function parseM3U(text: string): M3UChannel[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const channels: M3UChannel[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith('#EXTINF:')) continue;
    const comma = findUnquotedComma(line);
    const metadata = comma < 0 ? line : line.slice(0, comma);
    const displayName = comma < 0 ? '' : line.slice(comma + 1).trim();
    let url = '';
    while (index + 1 < lines.length) {
      const candidate = lines[index + 1].trim();
      if (!candidate) {
        index += 1;
        continue;
      }
      if (candidate.startsWith('#')) {
        index += 1;
        continue;
      }
      url = candidate;
      index += 1;
      break;
    }

    if (!url || !/^(https?|rtsp|rtmp|udp|plugin):\/\//i.test(url)) continue;
    const id = attribute(metadata, 'tvg-id');
    channels.push({
      id,
      name: attribute(metadata, 'tvg-name') || displayName || id || 'Unnamed channel',
      group: attribute(metadata, 'group-title'),
      language: attribute(metadata, 'tvg-language') || attribute(metadata, 'language'),
      logo: attribute(metadata, 'tvg-logo'),
      url,
      userAgent: attribute(metadata, 'http-user-agent'),
      referrer: attribute(metadata, 'http-referrer'),
    });
  }
  return channels;
}

function xmlAttribute(source: string, name: string): string {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match?.[1] ?? '';
}

function decodeXml(value: string): string {
  const decodeCodePoint = (value: string, radix: number) => {
    const codePoint = Number.parseInt(value, radix);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : '';
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => decodeCodePoint(code, 16))
    .replace(/&#(\d+);/g, (_, code: string) => decodeCodePoint(code, 10))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseXmltvTime(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const offset = sign
    ? (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === '+' ? 1 : -1)
    : 0;
  return timestamp - offset * 60_000;
}

export function parseXMLTV(text: string): Map<string, GuideProgram[]> {
  const programs = new Map<string, GuideProgram[]>();
  const matches = text.replace(/^\uFEFF/, '').matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi);
  for (const [, attributes, body] of matches) {
    const channelId = xmlAttribute(attributes, 'channel');
    const titleMatch = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = body.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i);
    const start = parseXmltvTime(xmlAttribute(attributes, 'start'));
    const stop = parseXmltvTime(xmlAttribute(attributes, 'stop'));
    if (!channelId || !titleMatch || start === null || stop === null || stop <= start) continue;
    const entries = programs.get(channelId) ?? [];
    entries.push({
      title: decodeXml(titleMatch[1].trim()),
      start,
      stop,
      desc: descMatch ? decodeXml(descMatch[1].trim()) : undefined,
    });
    programs.set(channelId, entries);
  }
  for (const entries of programs.values()) entries.sort((left, right) => left.start - right.start);
  return programs;
}
