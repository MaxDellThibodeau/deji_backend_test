const request = require('supertest')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Import your app
// const app = require('../../src/server') // Adjust path as needed

// Mock data for testing
const testUser = {
  email: process.env.TEST_USER_EMAIL || 'max@fatech369.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123'
}

let authToken = null
let testUserId = null

describe('DJEI Token API Integration Tests', () => {
  // Setup: Get auth token before running tests
  beforeAll(async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    const { data, error } = await supabase.auth.signInWithPassword(testUser)
    
    if (error) {
      throw new Error(`Authentication failed: ${error.message}`)
    }

    authToken = data.session.access_token
    testUserId = data.user.id
    
    console.log('✅ Test authentication successful')
  }, 30000) // 30 second timeout for auth

  // Helper function to make authenticated requests
  const authenticatedRequest = (method, endpoint) => {
    const req = request(`http://localhost:3001`)[method](endpoint)
    if (authToken) {
      req.set('Authorization', `Bearer ${authToken}`)
    }
    return req
  }

  describe('GET /api/payments/tokens/balance', () => {
    test('should return current token balance for authenticated user', async () => {
      const response = await authenticatedRequest('get', '/api/payments/tokens/balance')
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('balance')
      expect(typeof response.body.balance).toBe('number')
      expect(response.body.balance).toBeGreaterThanOrEqual(0)
    })

    test('should reject requests without auth token', async () => {
      const response = await request('http://localhost:3001')
        .get('/api/payments/tokens/balance')
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })

    test('should reject requests with invalid auth token', async () => {
      const response = await request('http://localhost:3001')
        .get('/api/payments/tokens/balance')
        .set('Authorization', 'Bearer invalid_token_123')
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/payments/tokens/purchase', () => {
    const validPurchaseData = {
      amount: 100,
      packageType: '100',
      paymentIntentId: `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    test('should successfully purchase tokens with valid data', async () => {
      const response = await authenticatedRequest('post', '/api/payments/tokens/purchase')
        .send(validPurchaseData)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('newBalance')
      expect(response.body).toHaveProperty('amountAdded', 100)
      expect(typeof response.body.newBalance).toBe('number')
    })

    test('should reject purchase with negative amount', async () => {
      const invalidData = {
        ...validPurchaseData,
        amount: -50
      }

      const response = await authenticatedRequest('post', '/api/payments/tokens/purchase')
        .send(invalidData)
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toMatch(/invalid.*amount/i)
    })

    test('should reject purchase with missing required fields', async () => {
      const incompleteData = {
        amount: 100
        // Missing packageType and paymentIntentId
      }

      const response = await authenticatedRequest('post', '/api/payments/tokens/purchase')
        .send(incompleteData)
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    test('should reject purchase with invalid package type', async () => {
      const invalidData = {
        ...validPurchaseData,
        packageType: 'invalid_package'
      }

      const response = await authenticatedRequest('post', '/api/payments/tokens/purchase')
        .send(invalidData)
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    test('should reject unauthenticated purchase requests', async () => {
      const response = await request('http://localhost:3001')
        .post('/api/payments/tokens/purchase')
        .send(validPurchaseData)
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/payments/tokens/bid', () => {
    const validBidData = {
      songId: `song_test_${Date.now()}`,
      bidAmount: 25,
      eventId: 'event_test_123'
    }

    test('should successfully place bid with sufficient tokens', async () => {
      // First ensure we have enough tokens
      await authenticatedRequest('post', '/api/payments/tokens/purchase')
        .send({
          amount: 100,
          packageType: '100',
          paymentIntentId: `pi_test_setup_${Date.now()}`
        })

      const response = await authenticatedRequest('post', '/api/payments/tokens/bid')
        .send(validBidData)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('newBalance')
      expect(response.body).toHaveProperty('bidAmount', 25)
      expect(response.body).toHaveProperty('songId', validBidData.songId)
    })

    test('should reject bid with insufficient tokens', async () => {
      const highBidData = {
        ...validBidData,
        bidAmount: 999999, // Impossibly high amount
        songId: `song_insufficient_${Date.now()}`
      }

      const response = await authenticatedRequest('post', '/api/payments/tokens/bid')
        .send(highBidData)
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toMatch(/insufficient.*tokens/i)
    })

    test('should reject bid with invalid bid amount', async () => {
      const invalidBidData = {
        ...validBidData,
        bidAmount: -10
      }

      const response = await authenticatedRequest('post', '/api/payments/tokens/bid')
        .send(invalidBidData)
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    test('should reject bid with missing required fields', async () => {
      const incompleteData = {
        bidAmount: 25
        // Missing songId
      }

      const response = await authenticatedRequest('post', '/api/payments/tokens/bid')
        .send(incompleteData)
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    test('should reject unauthenticated bid requests', async () => {
      const response = await request('http://localhost:3001')
        .post('/api/payments/tokens/bid')
        .send(validBidData)
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/payments/tokens/transactions', () => {
    test('should return transaction history for authenticated user', async () => {
      const response = await authenticatedRequest('get', '/api/payments/tokens/transactions')
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('transactions')
      expect(response.body).toHaveProperty('pagination')
      expect(Array.isArray(response.body.transactions)).toBe(true)
      
      // Check pagination structure
      expect(response.body.pagination).toHaveProperty('page')
      expect(response.body.pagination).toHaveProperty('limit')
      expect(response.body.pagination).toHaveProperty('hasMore')
    })

    test('should respect pagination parameters', async () => {
      const response = await authenticatedRequest('get', '/api/payments/tokens/transactions?page=1&limit=5')
      
      expect(response.status).toBe(200)
      expect(response.body.transactions.length).toBeLessThanOrEqual(5)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(5)
    })

    test('should reject unauthenticated transaction history requests', async () => {
      const response = await request('http://localhost:3001')
        .get('/api/payments/tokens/transactions')
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('Performance and reliability tests', () => {
    test('should respond to balance request within reasonable time', async () => {
      const startTime = Date.now()
      
      const response = await authenticatedRequest('get', '/api/payments/tokens/balance')
      
      const responseTime = Date.now() - startTime
      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(5000) // Should respond within 5 seconds
    })

    test('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill().map(() => 
        authenticatedRequest('get', '/api/payments/tokens/balance')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('balance')
      })
    })
  })

  // Cleanup after tests
  afterAll(async () => {
    console.log('🧹 Test cleanup completed')
  })
})

// Export for CI/CD usage
module.exports = {
  testUser,
  authenticatedRequest
} 