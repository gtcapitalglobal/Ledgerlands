import { ENV } from './env';

const SQUARE_API_BASE = 'https://connect.squareup.com/v2';
const SQUARE_API_VERSION = '2024-12-18';

/**
 * Create a payment using Square Payments API (REST)
 */
export async function createSquarePayment(params: {
  sourceId: string; // Payment token from Square Web SDK
  amountCents: number; // Amount in cents (e.g., 1000 = $10.00)
  idempotencyKey: string; // Unique key to prevent duplicate payments
  note?: string; // Optional note
  buyerEmailAddress?: string; // Optional buyer email
}) {
  try {
    const response = await fetch(`${SQUARE_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_API_VERSION,
        'Authorization': `Bearer ${ENV.squareAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: params.sourceId,
        amount_money: {
          amount: params.amountCents,
          currency: 'USD',
        },
        idempotency_key: params.idempotencyKey,
        note: params.note,
        buyer_email_address: params.buyerEmailAddress,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Square] Payment creation failed:', data);
      return {
        success: false,
        error: data.errors?.[0]?.detail || 'Payment failed',
      };
    }

    return {
      success: true,
      payment: data.payment,
    };
  } catch (error) {
    console.error('[Square] Payment creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Square location ID (required for some operations)
 */
export async function getSquareLocationId(): Promise<string | null> {
  try {
    const response = await fetch(`${SQUARE_API_BASE}/locations`, {
      method: 'GET',
      headers: {
        'Square-Version': SQUARE_API_VERSION,
        'Authorization': `Bearer ${ENV.squareAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Square] Failed to get location:', data);
      return null;
    }

    const location = data.locations?.[0];
    return location?.id || null;
  } catch (error) {
    console.error('[Square] Failed to get location:', error);
    return null;
  }
}
