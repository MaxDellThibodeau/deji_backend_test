import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name?: string
    avatar_url?: string
    [key: string]: any
  }
}

/**
 * Middleware to authenticate users using Supabase JWT tokens
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the Authorization header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header missing or invalid format',
      })
    }

    // Extract the token
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token missing',
      })
    }

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.error('Token verification error:', error?.message)
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      })
    }

    // Add user information to the request object
    req.user = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || 
            user.user_metadata?.name || 
            user.email?.split('@')[0] || 
            'User',
      avatar_url: user.user_metadata?.avatar_url || 
                 user.user_metadata?.picture,
      ...user.user_metadata,
    }

    next()
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    })
  }
}

/**
 * Middleware to optionally authenticate users (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header, continue without user
      return next()
    }

    const token = authHeader.substring(7)
    
    if (!token) {
      return next()
    }

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || 
              user.user_metadata?.name || 
              user.email?.split('@')[0] || 
              'User',
        avatar_url: user.user_metadata?.avatar_url || 
                   user.user_metadata?.picture,
        ...user.user_metadata,
      }
    }

    next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    // Continue without user even if there's an error
    next()
  }
}

/**
 * Middleware to check if user has admin privileges
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Check if user has admin role in user metadata or a separate admin table
    const isAdmin = req.user?.role === 'admin' || 
                   req.user?.user_metadata?.role === 'admin' ||
                   req.user?.app_metadata?.role === 'admin'

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required',
      })
    }

    next()
  } catch (error) {
    console.error('Admin auth middleware error:', error)
    return res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    })
  }
}

/**
 * Utility function to generate API keys (for service-to-service communication)
 */
export const generateApiKey = (): string => {
  return 'djei_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Middleware to validate API keys for service endpoints
 */
export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || []

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
      })
    }

    if (!validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      })
    }

    next()
  } catch (error) {
    console.error('API key validation error:', error)
    return res.status(500).json({
      success: false,
      error: 'API key validation failed',
    })
  }
}

/**
 * Utility function to extract user ID from request
 */
export const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.user?.id || null
}

/**
 * Utility function to check if user owns a resource
 */
export const checkResourceOwnership = (
  resourceUserId: string,
  requestUserId: string
): boolean => {
  return resourceUserId === requestUserId
}

export default {
  authenticateUser,
  optionalAuth,
  requireAdmin,
  validateApiKey,
  getUserId,
  checkResourceOwnership,
  generateApiKey,
} 