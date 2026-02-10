import { describe, it, expect } from 'vitest';
import { ENV } from './_core/env';

describe('Square API Credentials', () => {
  it('should have valid Square credentials configured', async () => {
    // Check that credentials are present
    expect(ENV.squareApplicationId).toBeDefined();
    expect(ENV.squareAccessToken).toBeDefined();
    expect(ENV.squareApplicationId).toMatch(/^sq0idp-/);
    
    // Test Square API connection with a lightweight endpoint (list locations)
    const response = await fetch('https://connect.squareup.com/v2/locations', {
      method: 'GET',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${ENV.squareAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('locations');
    expect(Array.isArray(data.locations)).toBe(true);
  }, 15000); // 15s timeout for API call
});
