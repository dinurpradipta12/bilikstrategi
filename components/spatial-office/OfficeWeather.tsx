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
  updatedAt: number;
};
type WeatherStatus = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'unsupported' | 'error';

type WeatherResponse = {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: number;
  };
};

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

function timezonePlace(timezone?: string) {
  const segment = timezone?.split('/').at(-1)?.replaceAll('_', ' ');
  return segment || 'Lokasi Anda';
}

export default function OfficeWeather() {
  const [status, setStatus] = useState<WeatherStatus>('idle');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    controllerRef.current?.abort();
  }, []);

  const loadWeather = useCallback(async (nextCoordinates: Coordinates) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    try {
      const params = new URLSearchParams({
        latitude: String(nextCoordinates.latitude),
        longitude: String(nextCoordinates.longitude),
        current: 'temperature_2m,apparent_temperature,weather_code,is_day',
        timezone: 'auto',
        forecast_days: '1',
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('weather-request-failed');
      const payload = await response.json() as WeatherResponse;
      const current = payload.current;
      if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code)) throw new Error('weather-data-invalid');
      if (!mountedRef.current) return;
      setWeather({
        temperature: current.temperature_2m as number,
        apparentTemperature: Number.isFinite(current.apparent_temperature) ? current.apparent_temperature as number : current.temperature_2m as number,
        code: current.weather_code as number,
        isDay: current.is_day !== 0,
        place: timezonePlace(payload.timezone),
        updatedAt: Date.now(),
      });
      setStatus('ready');
    } catch (error) {
      if (!mountedRef.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!coordinates) return;
    const timer = window.setInterval(() => void loadWeather(coordinates), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [coordinates, loadWeather]);

  const requestWeather = () => {
    if (coordinates) {
      void loadWeather(coordinates);
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
