import type { SmsSendResult } from '@/types'

async function sendViaTwilio(to: string, body: string): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken) {
    return { success: false, error: 'Twilio credentials not configured' }
  }

  if (!messagingServiceSid && !fromNumber) {
    return { success: false, error: 'Neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_FROM_NUMBER is set' }
  }

  const twilio = (await import('twilio')).default
  const client = twilio(accountSid, authToken)

  const message = await client.messages.create({
    body,
    to,
    ...(messagingServiceSid
      ? { messagingServiceSid }
      : { from: fromNumber }),
  })

  return { success: true, messageId: message.sid }
}

// Sends an SMS to the given phone number.
// If ALERT_TEST_MODE=true, logs the message to console instead of calling Twilio.
export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const testMode = process.env.ALERT_TEST_MODE === 'true'

  if (testMode) {
    console.log(`[SMS TEST MODE] To: ${to}\nBody: ${body}`)
    return { success: true, messageId: 'test-mode' }
  }

  try {
    return await sendViaTwilio(to, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[SMS] Failed to send to ${to}:`, message)
    return { success: false, error: message }
  }
}
