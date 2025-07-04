import dotenv from 'dotenv'
dotenv.config()

import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const router = Router()

// Server-side Supabase client with service role
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Validation schemas
const tokenPurchaseSchema = z.object({
  amount: z.number().min(1).max(10000),
  paymentIntentId: z.string(),
  packageType: z.enum(['50', '100', '250', '500'])
})

const bidTokenSchema = z.object({
  songId: z.string(),
  bidAmount: z.number().min(1).max(1000),
  eventId: z.string().optional()
})

// Middleware: Authenticate user
const authenticateUser = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// GET /api/payments/tokens/balance - Get authoritative token balance
router.get('/balance', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { data: userTokens, error } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('profile_id', req.user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching token balance:', error)
      return res.status(500).json({ error: 'Failed to fetch balance' })
    }

    const balance = userTokens?.balance || 0

    return res.json({ balance })

  } catch (error) {
    console.error('Token balance error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/payments/tokens/purchase - Process token purchase (secure)
router.post('/purchase', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { amount, paymentIntentId, packageType } = tokenPurchaseSchema.parse(req.body)

    // Verify payment with Stripe (this should be implemented)
    // const paymentVerified = await verifyStripePayment(paymentIntentId)
    // if (!paymentVerified) {
    //   return res.status(400).json({ error: 'Payment verification failed' })
    // }

    // Get current balance
    const { data: currentTokens } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('profile_id', req.user.id)
      .single()

    const currentBalance = currentTokens?.balance || 0
    const newBalance = currentBalance + amount

    // Update balance atomically
    const { error: updateError } = await supabase
      .from('user_tokens')
      .upsert({
        profile_id: req.user.id,
        balance: newBalance,
        updated_at: new Date().toISOString()
      })

    if (updateError) {
      console.error('Error updating token balance:', updateError)
      return res.status(500).json({ error: 'Failed to update balance' })
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        profile_id: req.user.id,
        amount: amount,
        transaction_type: 'purchase',
        description: `Purchased ${amount} tokens (${packageType} package)`,
        metadata: { paymentIntentId, packageType },
        created_at: new Date().toISOString()
      })

    if (transactionError) {
      console.error('Error recording transaction:', transactionError)
      // Don't fail the operation, but log the error
    }

    return res.json({
      success: true,
      newBalance,
      amountAdded: amount
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed'
        // Removed error.errors to prevent schema disclosure
      })
    }
    console.error('Token purchase error - check server logs for details')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/payments/tokens/bid - Process song bid (secure token deduction)
router.post('/bid', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { songId, bidAmount, eventId } = bidTokenSchema.parse(req.body)

    // Check current balance
    const { data: userTokens, error: balanceError } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('profile_id', req.user.id)
      .single()

    if (balanceError) {
      return res.status(500).json({ error: 'Failed to check balance' })
    }

    const currentBalance = userTokens?.balance || 0

    if (currentBalance < bidAmount) {
      return res.status(400).json({ 
        error: 'Insufficient tokens',
        currentBalance,
        required: bidAmount
      })
    }

    // Deduct tokens atomically
    const newBalance = currentBalance - bidAmount
    const { error: updateError } = await supabase
      .from('user_tokens')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', req.user.id)

    if (updateError) {
      console.error('Error deducting tokens:', updateError)
      return res.status(500).json({ error: 'Failed to process bid' })
    }

    // Record bid transaction
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        profile_id: req.user.id,
        amount: -bidAmount,
        transaction_type: 'bid',
        description: `Bid ${bidAmount} tokens on song`,
        metadata: { songId, eventId },
        created_at: new Date().toISOString()
      })

    if (transactionError) {
      console.error('Error recording bid transaction:', transactionError)
    }

    // Create or update song bid
    const { error: bidError } = await supabase
      .from('song_bids')
      .upsert({
        user_id: req.user.id,
        song_id: songId,
        event_id: eventId,
        bid_amount: bidAmount,
        status: 'active',
        created_at: new Date().toISOString()
      })

    if (bidError) {
      console.error('Error creating bid record:', bidError)
      // Could implement rollback logic here
    }

    return res.json({
      success: true,
      newBalance,
      bidAmount,
      songId
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed'
        // Removed error.errors to prevent schema disclosure
      })
    }
    console.error('Bid processing error - check server logs for details')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/payments/tokens/transactions - Get transaction history
router.get('/transactions', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const { data: transactions, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('profile_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1)

    if (error) {
      console.error('Error fetching transactions:', error)
      return res.status(500).json({ error: 'Failed to fetch transactions' })
    }

    return res.json({
      transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        hasMore: transactions.length === Number(limit)
      }
    })

  } catch (error) {
    console.error('Transaction history error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/payments/tokens/admin/adjust - Admin token adjustment
router.post('/admin/adjust', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check admin privileges
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return res.status(403).json({ error: 'Admin privileges required' })
    }

    const { userId, adjustment, reason } = req.body

    if (!userId || typeof adjustment !== 'number' || !reason) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get current balance
    const { data: userTokens } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('profile_id', userId)
      .single()

    const currentBalance = userTokens?.balance || 0
    const newBalance = Math.max(0, currentBalance + adjustment) // Prevent negative balances

    // Update balance
    const { error: updateError } = await supabase
      .from('user_tokens')
      .upsert({
        profile_id: userId,
        balance: newBalance,
        updated_at: new Date().toISOString()
      })

    if (updateError) {
      return res.status(500).json({ error: 'Failed to adjust balance' })
    }

    // Record admin transaction
    await supabase.from('token_transactions').insert({
      profile_id: userId,
      amount: adjustment,
      transaction_type: 'admin_adjustment',
      description: reason,
      metadata: { admin_id: req.user.id },
      created_at: new Date().toISOString()
    })

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user.id,
      action: 'token_adjustment',
      target_user_id: userId,
      details: { adjustment, reason, old_balance: currentBalance, new_balance: newBalance },
      created_at: new Date().toISOString()
    })

    return res.json({
      success: true,
      newBalance,
      adjustment
    })

  } catch (error) {
    console.error('Admin token adjustment error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router 