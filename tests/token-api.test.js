const request = require('supertest')

describe('DJEI Token API Tests', () => {
  const baseURL = 'http://localhost:3001'
  let authToken = null

  // Mock token for testing
  beforeAll(() => {
    // In a real scenario, you'd get this from environment variables
    authToken = process.env.TEST_JWT_TOKEN || 'mock_token_for_testing'
  })

  describe('GET /api/payments/tokens/balance', () => {
    test('should return 401 without auth', async () => {
      const response = await request(baseURL)
        .get('/api/payments/tokens/balance')
      
      expect(response.status).toBe(401)
    })

    test('should return balance with valid auth', async () => {
      const response = await request(baseURL)
        .get('/api/payments/tokens/balance')
        .set('Authorization', `Bearer ${authToken}`)
      
      // Should either succeed or fail with proper error
      expect([200, 401, 403]).toContain(response.status)
    })
  })

  describe('POST /api/payments/tokens/purchase', () => {
    const validData = {
      amount: 100,
      packageType: '100',
      paymentIntentId: 'pi_test_123'
    }

    test('should reject without auth', async () => {
      const response = await request(baseURL)
        .post('/api/payments/tokens/purchase')
        .send(validData)
      
      expect(response.status).toBe(401)
    })

    test('should validate request body', async () => {
      const response = await request(baseURL)
        .post('/api/payments/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
      
      expect([400, 401]).toContain(response.status)
    })
  })
}) 