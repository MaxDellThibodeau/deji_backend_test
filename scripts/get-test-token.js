#!/usr/bin/env node

/**
 * Helper script to get JWT tokens for API testing
 * Usage: node scripts/get-test-token.js <email> <password>
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function getTestToken(email, password) {
  try {
    console.log('🔐 Attempting to sign in...')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('❌ Authentication failed:', error.message)
      process.exit(1)
    }

    if (!data.session) {
      console.error('❌ No session returned')
      process.exit(1)
    }

    const token = data.session.access_token
    const user = data.user

    console.log('✅ Authentication successful!')
    console.log('\n📋 User Info:')
    console.log(`  ID: ${user.id}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Role: ${user.role || 'authenticated'}`)
    
    console.log('\n🔑 JWT Token:')
    console.log(token)
    
    console.log('\n📝 cURL Examples:')
    console.log('# Get token balance:')
    console.log(`curl -H "Authorization: Bearer ${token}" \\`)
    console.log('     http://localhost:3001/api/payments/tokens/balance')
    
    console.log('\n# Purchase tokens:')
    console.log(`curl -X POST \\`)
    console.log(`     -H "Authorization: Bearer ${token}" \\`)
    console.log(`     -H "Content-Type: application/json" \\`)
    console.log(`     -d '{"amount": 100, "packageType": "100", "paymentIntentId": "pi_test_123"}' \\`)
    console.log('     http://localhost:3001/api/payments/tokens/purchase')

    console.log('\n⏰ Token expires at:', new Date(data.session.expires_at * 1000).toISOString())
    
    return token

  } catch (error) {
    console.error('💥 Unexpected error:', error.message)
    process.exit(1)
  }
}

// CLI usage
if (require.main === module) {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: node get-test-token.js <email> <password>')
    console.error('Example: node get-test-token.js max@fatech369.com mypassword')
    process.exit(1)
  }

  getTestToken(email, password)
}

module.exports = { getTestToken } 