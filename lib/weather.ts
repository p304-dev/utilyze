const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

async function getTemperatureFromOpenMeteo(lat: number, lon: number): Promise<number> {
  const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`
  const res = await fetch(url, { next: { revalidate: 0 } })

  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  if (!data.current_weather?.temperature) {
    throw new Error('Open-Meteo response missing current_weather.temperature')
  }

  return data.current_weather.temperature as number
}

// Returns current temperature in Fahrenheit for the given coordinates.
// Provider is swappable via WEATHER_PROVIDER env var — add a new case below to support others.
export async function getCurrentTemperatureF(lat: number, lon: number): Promise<number> {
  const provider = process.env.WEATHER_PROVIDER ?? 'open_meteo'

  switch (provider) {
    case 'open_meteo':
      return getTemperatureFromOpenMeteo(lat, lon)
    default:
      throw new Error(`Unknown weather provider: ${provider}`)
  }
}
