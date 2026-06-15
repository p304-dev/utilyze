import { createServerSupabaseClient } from '@/lib/supabase'

const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'optout'])

// Public endpoint — Twilio posts here when a contact replies to an alert SMS.
// No auth check: Twilio can't send a session cookie. TODO: validate Twilio signature header.
export async function POST(req: Request) {
  const formData = await req.formData()
  const from = formData.get('From') as string | null
  const body = (formData.get('Body') as string | null)?.trim().toLowerCase()

  const twiml = '<?xml version="1.0"?><Response></Response>'
  const xmlResponse = new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })

  if (!from || !body) return xmlResponse

  if (OPT_OUT_KEYWORDS.has(body)) {
    const db = createServerSupabaseClient()

    const { data: contact } = await db
      .from('contacts')
      .select('id')
      .eq('phone_number', from)
      .maybeSingle()

    if (contact) {
      await db
        .from('contacts')
        .update({ opt_out_status: 'opted_out', receive_alerts: false })
        .eq('id', contact.id)

      console.log(`[Twilio Inbound] Opt-out recorded for ${from}`)
    }
  }

  // Always return TwiML 200 — Twilio expects this even if we took no action
  return xmlResponse
}
