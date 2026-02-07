/* global Buffer, process */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const KATHMANDU_TIMEZONE = 'Asia/Kathmandu';

interface ApiRequest {
  method?: string;
  headers: {
    authorization?: string;
  };
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
}

function getKathmanduIsoDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KATHMANDU_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    return '';
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token.trim();
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const cronSecret = getRequiredEnv('CRON_SECRET');
    const token = getBearerToken(req.headers.authorization);

    if (!token || !timingSafeEqual(token, cronSecret)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) is not configured.');
    }

    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const localDate = getKathmanduIsoDate();
    const { data, error } = await supabase.rpc('schedule_in_app_notifications_for_kathmandu', {
      p_target_date: localDate,
    });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      timezone: KATHMANDU_TIMEZONE,
      localDate,
      result: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return res.status(500).json({ ok: false, error: message });
  }
}
