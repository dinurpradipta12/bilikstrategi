'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, LoaderCircle, MapPin, MapPinOff, Moon, RefreshCw, Sun, type LucideIcon } from 'lucide-react';

type Coordinates = { latitude: number; longitude: number };
type Weather = {
  temperature: number;
  apparentTemperature: number;
  code: number;
  isDay: boolean;
  place: string;
  timezone: string;
  updatedAt: number;
};
type WeatherStatus = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'unsupported' | 'error';
export type OfficeLocation = Pick<Weather, 'place' | 'timezone'>;
type StoredWeather = { coordinates: Coordinates; weather?: Weather };

type WeatherResponse = {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: number;
  };
};

type ReverseGeocodeResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
};

const WEATHER_STORAGE_KEY = 'bilik-strategi:office-weather:v1';
const WEATHER_REFRESH_INTERVAL = 15 * 60 * 1000;

function weatherPresentation(code: number, isDay: boolean): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: 'Cerah', Icon: isDay ? Sun : Moon };
  if (code <= 3) return { label: code === 1 ? 'Cerah berawan' : 'Berawan', Icon: isDay ? CloudSun : CloudMoon };
  if (code === 45 || code === 48) return { label: 'Berkabut', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: 'Gerimis', Icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Hujan', Icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Bersalju', Icon: CloudSnow };
  if (code >= 95) return { label: 'Badai petir', Icon: CloudLightning };
  return { label: 'Berawan', Icon: Cloud };
}

function storedWeather(): StoredWeather | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(WEATHER_STORAGE_KEY) || 'null') as StoredWeather | null;
    if (!stored || !Number.isFinite(stored.coordinates?.latitude) || !Number.isFinite(stored.coordinates?.longitude)) return null;
    return stored;
  } catch {
    return null;
  }
}

export default function OfficeWeather({ onLocationChange }: { onLocationChange?: (location: OfficeLocation) => void }) {
  const [status, setStatus] = useState<WeatherStatus>('idle');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const loadWeather = useCallback(async (nextCoordinates: Coordinates, options?: { place?: string; keepExisting?: boolean }) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!options?.keepExisting) setStatus('loading');
    try {
      const params = new URLSearchParams({
        latitude: String(nextCoordinates.latitude),
        longitude: String(nextCoordinates.longitude),
        current: 'temperature_2m,apparent_temperature,weather_code,is_day',
        timezone: 'auto',
        forecast_days: '1',
      });
      const placeParams = new URLSearchParams({
        latitude: String(nextCoordinates.latitude),
        longitude: String(nextCoordinates.longitude),
        localityLanguage: 'id',
      });
      const [response, placeResponse] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal }),
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${placeParams}`, { signal: controller.signal }).catch(() => null),
      ]);
      if (!response.ok) throw new Error('weather-request-failed');
      const payload = await response.json() as WeatherResponse;
      const current = payload.current;
      if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code)) throw new Error('weather-data-invalid');
      let place = options?.place || 'Lokasi Anda';
      if (placeResponse?.ok) {
        const placePayload = await placeResponse.json() as ReverseGeocodeResponse;
        place = placePayload.city || placePayload.locality || placePayload.principalSubdivision || place;
      }
      if (!mountedRef.current) return;
      const nextWeather: Weather = {
        temperature: current.temperature_2m as number,
        apparentTemperature: Number.isFinite(current.apparent_temperature) ? current.apparent_temperature as number : current.temperature_2m as number,
        code: current.weather_code as number,
        isDay: current.is_day !== 0,
        place,
        timezone: payload.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar',
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ coordinates: nextCoordinates, weather: nextWeather } satisfies StoredWeather));
      setCoordinates(nextCoordinates);
      setWeather(nextWeather);
      setStatus('ready');
      onLocationChange?.({ place: nextWeather.place, timezone: nextWeather.timezone });
    } catch (error) {
      if (!mountedRef.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      setStatus(options?.keepExisting ? 'ready' : 'error');
    }
  }, [onLocationChange]);

  useEffect(() => {
    mountedRef.current = true;
    const hydrateTimer = window.setTimeout(() => {
      const stored = storedWeather();
      if (stored) {
        setCoordinates(stored.coordinates);
        if (stored.weather) {
          setWeather(stored.weather);
          setStatus('ready');
          onLocationChange?.({ place: stored.weather.place, timezone: stored.weather.timezone });
        }
        if (!stored.weather || Date.now() - stored.weather.updatedAt >= WEATHER_REFRESH_INTERVAL) {
          void loadWeather(stored.coordinates, { place: stored.weather?.place, keepExisting: Boolean(stored.weather) });
        }
      }
    }, 0);
    return () => {
      window.clearTimeout(hydrateTimer);
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [loadWeather, onLocationChange]);

  useEffect(() => {
    if (!coordinates) return;
    const timer = window.setInterval(() => void loadWeather(coordinates, { place: weather?.place, keepExisting: Boolean(weather) }), WEATHER_REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [coordinates, loadWeather, weather]);

  const requestWeather = () => {
    if (coordinates) {
      void loadWeather(coordinates, { place: weather?.place, keepExisting: Boolean(weather) });
      return;
    }
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(position => {
      if (!mountedRef.current) return;
      // Neighbourhood-level precision is sufficient for weather and avoids
      // sending raw GPS coordinates to the forecast provider.
      const nextCoordinates = {
        latitude: Math.round(position.coords.latitude * 100) / 100,
        longitude: Math.round(position.coords.longitude * 100) / 100,
      };
      window.localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ coordinates: nextCoordinates } satisfies StoredWeather));
      setCoordinates(nextCoordinates);
      void loadWeather(nextCoordinates);
    }, error => {
      if (!mountedRef.current) return;
      setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
    }, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60 * 1000 });
  };

  const presentation = weather ? weatherPresentation(weather.code, weather.isDay) : null;
  const Icon = status === 'locating' || status === 'loading' ? LoaderCircle : status === 'denied' ? MapPinOff : status === 'ready' && presentation ? presentation.Icon : status === 'error' ? RefreshCw : MapPin;
  const title = status === 'ready' && weather && presentation
    ? `${presentation.label} di ${weather.place}. ${Math.round(weather.temperature)}°C, terasa seperti ${Math.round(weather.apparentTemperature)}°C. Klik untuk memperbarui.`
    : status === 'denied' ? 'Izin lokasi ditolak. Aktifkan izin lokasi browser lalu coba lagi.'
      : status === 'unsupported' ? 'Browser ini tidak mendukung lokasi perangkat.'
        : status === 'error' ? 'Cuaca belum dapat dimuat. Klik untuk mencoba lagi.'
          : 'Tampilkan cuaca live berdasarkan lokasi perangkat Anda.';

  return <button type="button" className={`office-weather office-weather-${status}`} onClick={requestWeather} title={title} aria-label={title} disabled={status === 'locating' || status === 'loading'}>
    <Icon size={16} className={status === 'locating' || status === 'loading' ? 'office-weather-spin' : undefined} />
    <span className="office-weather-copy" aria-live="polite">
      <strong>{status === 'ready' && weather ? `${Math.round(weather.temperature)}°C` : status === 'locating' ? 'Mencari lokasi' : status === 'loading' ? 'Memuat cuaca' : status === 'denied' ? 'Lokasi ditolak' : status === 'unsupported' ? 'Tidak didukung' : status === 'error' ? 'Coba cuaca' : 'Cuaca lokal'}</strong>
      <small>{status === 'ready' && weather && presentation ? `${presentation.label} · ${weather.place}` : status === 'idle' ? 'Aktifkan lokasi' : status === 'denied' ? 'Ubah izin browser' : status === 'error' ? 'Klik untuk memuat ulang' : 'Hanya di perangkat ini'}</small>
    </span>
  </button>;
}
