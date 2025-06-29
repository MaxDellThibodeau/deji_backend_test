import { Router } from 'express'

const router = Router()

// POST /api/music/spotify/token - Get Spotify access token
router.post('/token', async (req, res) => {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      res.status(500).json({
        error: 'Spotify credentials not configured'
      })
      return
    }

    // Get client credentials token
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      throw new Error(`Spotify token request failed: ${response.status}`)
    }

    const data = await response.json()

    return res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    })
  } catch (error) {
    console.error('Error getting Spotify token:', error)
    return res.status(500).json({
      error: 'Failed to get Spotify token'
    })
  }
})

export default router 