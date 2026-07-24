// Provider abstraction for water utility portals.
// Each utility gets its own file implementing WaterUtilityProvider.
// The leak engine calls fetchUsage() without knowing which utility it is.

export interface WaterUsageHour {
  date: string    // "YYYY-MM-DD"
  hour: number    // 0..23
  gallons: number
}

export interface WaterFetchResult {
  hours: WaterUsageHour[]
  capturedMeterId?: string      // populated on first run when meter_id was blank
  capturedMoveInDate?: string   // populated on first run when move_in_date was blank
}

export interface WaterUtilityProvider {
  providerKey: string  // must match water_customers.utility_provider value, e.g. 'SAWS'
  fetchUsage(args: {
    username: string
    password: string      // decrypted in memory — never log this
    meterId?: string      // blank on first run; auto-captured and saved back by leak engine
    moveInDate?: string   // blank on first run; auto-captured and saved back by leak engine
    startDate: string     // "MM/DD/YYYY"
    endDate: string       // "MM/DD/YYYY"
  }): Promise<WaterFetchResult>
}
