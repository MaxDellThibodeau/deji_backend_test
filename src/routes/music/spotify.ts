import { Router, Request, Response } from 'express'

const router = Router()

// Cache for Spotify access token
let spotifyToken: { token: string; expires: number } | null = null

// Helper function to get Spotify access token
async function getSpotifyToken(): Promise<string> {
  // Return cached token if still valid
  if (spotifyToken && spotifyToken.expires > Date.now()) {
    return spotifyToken.token
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured')
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

  // Cache the token
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in * 1000) - 60000, // Subtract 1 minute for safety
  }

  return data.access_token
}

// POST /api/music/spotify/token - Get Spotify access token
router.post('/token', async (req: Request, res: Response) => {
  try {
    const token = await getSpotifyToken()
    return res.json({ access_token: token })
  } catch (error) {
    console.error('Error getting Spotify token:', error)
    return res.status(500).json({
      error: 'Failed to get Spotify token'
    })
  }
})

// GET /api/music/spotify/search - Search Spotify tracks
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10, offset = 0 } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const token = await getSpotifyToken()

    const searchParams = new URLSearchParams({
      q: q,
      type: 'track',
      limit: limit.toString(),
      offset: offset.toString(),
      market: 'US'
    })

    const response = await fetch(`https://api.spotify.com/v1/search?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Spotify search failed: ${response.status}`)
    }

    const data = await response.json()

    // Transform Spotify response to our format
    const tracks = data.tracks.items.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || null,
      spotifyUrl: track.external_urls.spotify,
      popularity: track.popularity,
      duration: track.duration_ms,
      previewUrl: track.preview_url,
      source: 'spotify',
      // Add bidding fields with defaults
      tokens: 0,
      bidders: 0,
      trending: 'neutral'
    }))

    return res.json({
      tracks,
      total: data.tracks.total,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })
  } catch (error) {
    console.error('Error searching Spotify:', error)
    return res.status(500).json({
      error: 'Failed to search Spotify'
    })
  }
})

// GET /api/music/spotify/track/:id - Get track details
router.get('/track/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ error: 'Track ID is required' })
    }

    const token = await getSpotifyToken()

    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Track not found' })
      }
      throw new Error(`Spotify track request failed: ${response.status}`)
    }

    const track = await response.json()

    // Transform to our format
    const trackData = {
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || null,
      spotifyUrl: track.external_urls.spotify,
      popularity: track.popularity,
      duration: track.duration_ms,
      previewUrl: track.preview_url,
      source: 'spotify',
      // Add bidding fields with defaults
      tokens: 0,
      bidders: 0,
      trending: 'neutral'
    }

    return res.json(trackData)
  } catch (error) {
    console.error('Error getting Spotify track:', error)
    return res.status(500).json({
      error: 'Failed to get track details'
    })
  }
})

// GET /api/music/spotify/recommendations - Get track recommendations
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const { seed_tracks, seed_artists, seed_genres, limit = 10 } = req.query

    if (!seed_tracks && !seed_artists && !seed_genres) {
      return res.status(400).json({ 
        error: 'At least one seed parameter (seed_tracks, seed_artists, or seed_genres) is required' 
      })
    }

    const token = await getSpotifyToken()

    const params = new URLSearchParams({
      limit: limit.toString(),
      market: 'US'
    })

    if (seed_tracks) params.append('seed_tracks', seed_tracks.toString())
    if (seed_artists) params.append('seed_artists', seed_artists.toString())
    if (seed_genres) params.append('seed_genres', seed_genres.toString())

    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Spotify recommendations failed: ${response.status}`)
    }

    const data = await response.json()

    // Transform recommendations to our format
    const tracks = data.tracks.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || null,
      spotifyUrl: track.external_urls.spotify,
      popularity: track.popularity,
      duration: track.duration_ms,
      previewUrl: track.preview_url,
      source: 'spotify',
      // Add bidding fields with defaults
      tokens: 0,
      bidders: 0,
      trending: 'neutral'
    }))

    return res.json({ tracks })
  } catch (error) {
    console.error('Error getting Spotify recommendations:', error)
    return res.status(500).json({
      error: 'Failed to get recommendations'
    })
  }
})

export default router 