import dotenv from 'dotenv'
dotenv.config()

import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const router = Router()

// Server-side Supabase client with service role
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Validation schemas
const profileUpdateSchema = z.object({
  bio: z.string().max(500).optional(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
})

const roleSpecificDataSchema = z.object({
  role: z.enum(['dj', 'venue', 'attendee']),
  data: z.record(z.any())
})

// Middleware: Verify JWT and extract user
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

// Middleware: Check admin privileges
const requireAdmin = async (req: Request, res: Response, next: any) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single()

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Admin privileges required' })
    }

    next()
  } catch (error) {
    return res.status(403).json({ error: 'Permission check failed' })
  }
}

// PUT /api/auth/profile - Update user profile (secure)
router.put('/profile', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = profileUpdateSchema.parse(req.body)
    
    // Update profile with server authority
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return res.status(500).json({ error: 'Failed to update profile' })
    }

    // Calculate updated completion status
    const completionStatus = await calculateProfileCompletion(req.user.id)

    return res.json({
      success: true,
      profile: data,
      completion: completionStatus
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      })
    }
    console.error('Profile update error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/profile/role-data - Update role-specific data
router.post('/profile/role-data', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { role, data } = roleSpecificDataSchema.parse(req.body)
    
    // Verify user has this role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile?.role !== role) {
      return res.status(403).json({ error: 'Role mismatch' })
    }

    // Update appropriate role-specific table
    let result
    switch (role) {
      case 'dj':
        result = await supabase
          .from('dj_profiles')
          .upsert({
            profile_id: req.user.id,
            ...data,
            updated_at: new Date().toISOString()
          })
        break

      case 'venue':
        result = await supabase
          .from('venue_profiles')
          .upsert({
            profile_id: req.user.id,
            ...data,
            updated_at: new Date().toISOString()
          })
        break

      case 'attendee':
        result = await supabase
          .from('attendee_profiles')
          .upsert({
            profile_id: req.user.id,
            ...data,
            updated_at: new Date().toISOString()
          })
        break
    }

    if (result?.error) {
      return res.status(500).json({ error: 'Failed to update role data' })
    }

    // Recalculate completion
    const completionStatus = await calculateProfileCompletion(req.user.id)

    return res.json({
      success: true,
      completion: completionStatus
    })

  } catch (error) {
    console.error('Role data update error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/auth/profile/completion - Get profile completion status
router.get('/profile/completion', authenticateUser, async (req: Request, res: Response) => {
  try {
    const completion = await calculateProfileCompletion(req.user.id)
    return res.json(completion)
  } catch (error) {
    console.error('Completion calculation error:', error)
    return res.status(500).json({ error: 'Failed to calculate completion' })
  }
})

// PUT /api/auth/admin/change-role - Admin-only role changes
router.put('/admin/change-role', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, newRole } = req.body

    if (!userId || !newRole) {
      return res.status(400).json({ error: 'userId and newRole required' })
    }

    // Update user role with admin authority
    const { error } = await supabase
      .from('profiles')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      return res.status(500).json({ error: 'Failed to update role' })
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user.id,
      action: 'role_change',
      target_user_id: userId,
      details: { old_role: req.body.oldRole, new_role: newRole },
      created_at: new Date().toISOString()
    })

    return res.json({ success: true })

  } catch (error) {
    console.error('Role change error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function: Calculate profile completion server-side
async function calculateProfileCompletion(userId: string) {
  try {
    // Get user profile and role-specific data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) {
      return { percentage: 0, missingFields: [], isComplete: false }
    }

    // Get role-specific data
    let roleData = null
    switch (profile.role) {
      case 'dj':
        const { data: djData } = await supabase
          .from('dj_profiles')
          .select('*')
          .eq('profile_id', userId)
          .single()
        roleData = djData
        break
      // ... other roles
    }

    // Server-side business logic for completion calculation
    const requiredFields = getRequiredFieldsForRole(profile.role)
    const completedFields = requiredFields.filter(field => {
      const value = profile[field] || roleData?.[field]
      return value && value.toString().trim() !== ''
    })

    const percentage = Math.round((completedFields.length / requiredFields.length) * 100)
    const missingFields = requiredFields.filter(field => !completedFields.includes(field))

    return {
      percentage,
      completedFields,
      missingFields,
      isComplete: percentage === 100,
      lastUpdated: new Date().toISOString()
    }

  } catch (error) {
    console.error('Completion calculation error:', error)
    return { percentage: 0, missingFields: [], isComplete: false }
  }
}

// Helper function: Get required fields (server-side business rules)
function getRequiredFieldsForRole(role: string): string[] {
  const roleRequirements = {
    dj: ['bio', 'location', 'stage_name', 'genres', 'experience_years', 'equipment_provided'],
    venue: ['bio', 'phone', 'location', 'venue_name', 'venue_type', 'capacity', 'address', 'booking_email'],
    attendee: ['bio', 'location', 'favorite_genres', 'music_discovery_preference']
  }
  
  return roleRequirements[role] || ['bio', 'location']
}

export default router 