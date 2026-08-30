// Sends Web Push notifications for two triggers:
//  - { trigger: 'nudge', nudge_id } — fired immediately by an AFTER INSERT
//    trigger on `nudges` (see supabase/migrations), so the recipient gets a
//    push the moment their partner flags something.
//  - { trigger: 'cron' } — polled every 15 min by pg_cron, for tasks due
//    within the next hour that haven't been reminded about yet.
//
// Deployed with --no-verify-jwt since the only callers are the DB trigger
// and pg_cron, not end users — SUPABASE_SERVICE_ROLE_KEY is used instead to
// authenticate to the database directly (auto-injected by Supabase into
// every Edge Function's environment, no manual secret needed for it).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey)

interface PushPayload {
  title: string
  body: string
  url?: string
}

interface PushSubscriptionRow {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

async function sendToUser(userId: string, payload: PushPayload) {
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, keys').eq('user_id', userId)

  await Promise.all(
    ((subs ?? []) as PushSubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
        )
      } catch (err) {
        // 404/410 means the browser/OS dropped this subscription — clean it
        // up so future sends don't keep failing on it.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }),
  )
}

async function handleNudge(nudgeId: string) {
  const { data: nudge } = await supabase
    .from('nudges')
    .select('id, to_user_id, from_user_id, item_type, item_id, message, push_sent_at')
    .eq('id', nudgeId)
    .single()
  if (!nudge || nudge.push_sent_at) return

  const { data: fromProfile } = await supabase.from('profiles').select('display_name').eq('id', nudge.from_user_id).single()
  const senderName = fromProfile?.display_name ?? 'Your partner'

  await sendToUser(nudge.to_user_id, {
    title: `${senderName} flagged a ${nudge.item_type} for you`,
    body: nudge.message ?? 'Take a look when you get a chance.',
    url: '/us',
  })

  await supabase.from('nudges').update({ push_sent_at: new Date().toISOString() }).eq('id', nudgeId)
}

async function handleCronSweep() {
  const now = new Date()
  const soon = new Date(now.getTime() + 60 * 60 * 1000)

  const { data: dueTasks } = await supabase
    .from('tasks')
    .select('id, title, owner_id, due_date')
    .is('completed_at', null)
    .is('reminder_sent_at', null)
    .gte('due_date', now.toISOString())
    .lte('due_date', soon.toISOString())

  for (const task of dueTasks ?? []) {
    await sendToUser(task.owner_id, {
      title: task.title,
      body: 'Due within the hour.',
      url: '/',
    })
    await supabase.from('tasks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', task.id)
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))

    if (body.trigger === 'nudge' && body.nudge_id) {
      await handleNudge(body.nudge_id)
    } else {
      await handleCronSweep()
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
