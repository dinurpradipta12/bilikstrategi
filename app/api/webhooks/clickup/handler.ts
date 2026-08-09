import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { verifyWebhookSignature } from '@/lib/clickup/webhooks';

// In-memory processed event tracker for idempotency
const processedEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature') || '';
    const webhookSecret = process.env.CLICKUP_WEBHOOK_SECRET || '';

    // Validate signature if secret exists
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.warn('[ClickUp Webhook] Signature verification failed.');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.webhook_id || payload.event_id || `evt_${Date.now()}`;

    // Idempotency check
    if (processedEvents.has(eventId)) {
      console.log(`[ClickUp Webhook] Duplicate event ${eventId} ignored.`);
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    processedEvents.add(eventId);

    // Activity log entry
    console.log(`[ClickUp Webhook Received] Event: ${payload.event}`, {
      task_id: payload.task_id,
      history_items: payload.history_items?.length,
    });

    return NextResponse.json({ success: true, event_id: eventId }, { status: 200 });
  } catch (error: any) {
    console.error('[ClickUp Webhook Error]', error);
    return NextResponse.json({ error: error.message || 'Webhook error' }, { status: 500 });
  }
}
