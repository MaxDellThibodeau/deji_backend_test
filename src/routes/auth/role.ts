import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser } from '../../middleware/auth'
import { validateRole } from '../../middleware/validation'

const router = Router()

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type UserRole = 'attendee' | 'dj' | 'venue'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    [key: string]: any
  }
}

/**
 * GET /api/role
 * Get the current user's role
 */
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
    }

    // Check each role table for the user
    const tables = ['attendee', 'dj', 'venue'] as const
    let userRole: UserRole | null = null
    let profileData: any = null

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', userId)
        .single()

      if (data && !error) {
        userRole = table as UserRole
        profileData = data
        break
      }
    }

    if (!userRole) {
      return res.status(404).json({
        success: false,
        error: 'User role not found',
        isNewUser: true,
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        role: userRole,
        profile: profileData,
        isNewUser: false,
      },
    })

  } catch (error) {
    console.error('Get role error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * POST /api/role
 * Set the user's role (for first-time users)
 */
router.post('/', authenticateUser, validateRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const userEmail = req.user?.email
    const { role, profileData } = req.body

    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
    }

    if (!role || !['attendee', 'dj', 'venue'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role specified',
      })
    }

    // Check if user already has a role
    const existingRole = await getUserRole(userId)
    if (existingRole) {
      return res.status(409).json({
        success: false,
        error: 'User already has a role assigned',
        currentRole: existingRole,
      })
    }

    // Prepare the role data
    const roleData = {
      id: userId,
      email: userEmail,
      name: profileData?.name || req.user?.name || 'User',
      avatar_url: profileData?.avatar_url || req.user?.avatar_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...getDefaultProfileData(role),
      ...profileData, // Override defaults with provided data
    }

    // Insert into the appropriate role table
    const { data, error } = await supabase
      .from(role)
      .insert([roleData])
      .select()
      .single()

    if (error) {
      console.error(`Set ${role} role error:`, error)
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to set role',
      })
    }

    return res.status(201).json({
      success: true,
      data: {
        role,
        profile: data,
        message: `Successfully set role as ${role}`,
      },
    })

  } catch (error) {
    console.error('Set role error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * PUT /api/role
 * Update the user's role profile
 */
router.put('/', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const { profileData } = req.body

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
    }

    // Get the user's current role
    const currentRole = await getUserRole(userId)
    if (!currentRole) {
      return res.status(404).json({
        success: false,
        error: 'User role not found',
      })
    }

    // Update the profile data
    const updateData = {
      ...profileData,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from(currentRole)
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error(`Update ${currentRole} profile error:`, error)
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to update profile',
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        role: currentRole,
        profile: data,
        message: 'Profile updated successfully',
      },
    })

  } catch (error) {
    console.error('Update role error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * DELETE /api/role
 * Delete the user's role (careful operation)
 */
router.delete('/', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
    }

    // Get the user's current role
    const currentRole = await getUserRole(userId)
    if (!currentRole) {
      return res.status(404).json({
        success: false,
        error: 'User role not found',
      })
    }

    // Delete the role record
    const { error } = await supabase
      .from(currentRole)
      .delete()
      .eq('id', userId)

    if (error) {
      console.error(`Delete ${currentRole} role error:`, error)
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to delete role',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    })

  } catch (error) {
    console.error('Delete role error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// Helper function to get user role
async function getUserRole(userId: string): Promise<UserRole | null> {
  const tables = ['attendee', 'dj', 'venue'] as const
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('id', userId)
      .single()

    if (data && !error) {
      return table as UserRole
    }
  }

  return null
}

// Helper function to get default profile data for each role
function getDefaultProfileData(role: UserRole): Record<string, any> {
  const defaults = {
    attendee: {
      favorite_genres: [],
      preferred_venues: [],
      followed_djs: [],
      notification_preferences: {
        email: true,
        push: true,
        sms: false,
      },
      privacy_settings: {
        profile_visibility: 'public',
        location_sharing: 'friends',
      },
    },
    dj: {
      genres: [],
      years_experience: 0,
      equipment_list: [],
      availability_schedule: {},
      performance_history: [],
      ratings_average: 0.0,
      ratings_count: 0,
      is_verified: false,
      verification_documents: {},
    },
    venue: {
      music_genres: [],
      amenities: [],
      equipment_available: [],
      operating_hours: {},
      booking_info: {},
      social_media: {},
      images: [],
      is_verified: false,
      ratings_average: 0.0,
      ratings_count: 0,
    },
  }

  return defaults[role] || {}
}

export default router 