import { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'

export type UserRole = 'attendee' | 'dj' | 'venue'

/**
 * Validation middleware for role assignment
 */
export const validateRole = [
  body('role')
    .isIn(['attendee', 'dj', 'venue'])
    .withMessage('Role must be one of: attendee, dj, venue'),
  
  body('profileData')
    .optional()
    .isObject()
    .withMessage('Profile data must be an object'),

  body('profileData.name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('profileData.avatar_url')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),

  body('profileData.bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must be less than 1000 characters'),

  body('profileData.location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),

  body('profileData.phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Phone must be a valid phone number'),

  // DJ-specific validations
  body('profileData.stage_name')
    .if(body('role').equals('dj'))
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Stage name must be between 1 and 100 characters'),

  body('profileData.genres')
    .if(body('role').equals('dj'))
    .optional()
    .isArray()
    .withMessage('Genres must be an array'),

  body('profileData.years_experience')
    .if(body('role').equals('dj'))
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Years of experience must be between 0 and 100'),

  body('profileData.hourly_rate')
    .if(body('role').equals('dj'))
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number'),

  body('profileData.spotify_id')
    .if(body('role').equals('dj'))
    .optional()
    .isString()
    .trim()
    .withMessage('Spotify ID must be a string'),

  body('profileData.soundcloud_url')
    .if(body('role').equals('dj'))
    .optional()
    .isURL()
    .withMessage('SoundCloud URL must be a valid URL'),

  body('profileData.instagram_handle')
    .if(body('role').equals('dj'))
    .optional()
    .matches(/^[a-zA-Z0-9._]{1,30}$/)
    .withMessage('Instagram handle must be valid (1-30 characters, letters, numbers, dots, underscores only)'),

  body('profileData.website_url')
    .if(body('role').equals('dj'))
    .optional()
    .isURL()
    .withMessage('Website URL must be a valid URL'),

  // Venue-specific validations
  body('profileData.venue_name')
    .if(body('role').equals('venue'))
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Venue name must be between 1 and 255 characters'),

  body('profileData.address')
    .if(body('role').equals('venue'))
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Address must be between 1 and 500 characters'),

  body('profileData.city')
    .if(body('role').equals('venue'))
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City must be between 1 and 100 characters'),

  body('profileData.capacity')
    .if(body('role').equals('venue'))
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Capacity must be between 1 and 100,000'),

  body('profileData.venue_type')
    .if(body('role').equals('venue'))
    .optional()
    .isIn(['club', 'bar', 'restaurant', 'concert_hall', 'outdoor', 'private'])
    .withMessage('Venue type must be one of: club, bar, restaurant, concert_hall, outdoor, private'),

  body('profileData.latitude')
    .if(body('role').equals('venue'))
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('profileData.longitude')
    .if(body('role').equals('venue'))
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  // Attendee-specific validations
  body('profileData.username')
    .if(body('role').equals('attendee'))
    .optional()
    .matches(/^[a-zA-Z0-9._]{3,50}$/)
    .withMessage('Username must be 3-50 characters (letters, numbers, dots, underscores only)'),

  body('profileData.favorite_genres')
    .if(body('role').equals('attendee'))
    .optional()
    .isArray()
    .withMessage('Favorite genres must be an array'),

  body('profileData.date_of_birth')
    .if(body('role').equals('attendee'))
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),

  // Generic validation error handler
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? (error as any).path : error.type,
          message: error.msg,
          value: error.type === 'field' ? (error as any).value : undefined,
        })),
      })
    }
    next()
  },
]

/**
 * Validation middleware for profile updates
 */
export const validateProfileUpdate = [
  body('profileData')
    .isObject()
    .withMessage('Profile data is required and must be an object'),

  // Allow most profile updates with basic validation
  body('profileData.name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('profileData.bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must be less than 1000 characters'),

  body('profileData.avatar_url')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),

  body('profileData.location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),

  body('profileData.phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Phone must be a valid phone number'),

  // Generic validation error handler
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? (error as any).path : error.type,
          message: error.msg,
          value: error.type === 'field' ? (error as any).value : undefined,
        })),
      })
    }
    next()
  },
]

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate role enum
 */
export const isValidRole = (role: string): role is UserRole => {
  return ['attendee', 'dj', 'venue'].includes(role)
}

/**
 * Sanitize string input
 */
export const sanitizeString = (input: string, maxLength: number = 255): string => {
  return input?.trim().substring(0, maxLength) || ''
}

/**
 * Validate and sanitize array input
 */
export const sanitizeArray = (input: any[], maxItems: number = 50): string[] => {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, maxItems)
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item, 100))
    .filter(item => item.length > 0)
} 