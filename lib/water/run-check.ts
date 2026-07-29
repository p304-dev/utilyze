import { runWaterCheck } from './leak-engine'

runWaterCheck()
  .then(result => {
    console.log('[WaterCheck] Complete:', result)
    process.exit(0)
  })
  .catch(err => {
    console.error('[WaterCheck] Failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
