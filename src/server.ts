import express from 'express'
import cors from 'cors'  
import helmet from 'helmet'
import { createServer } from 'http'
import { Server } from 'socket.io'

// Import API routes
import spotifyRoutes from './routes/music/spotify'
import createIntentRoutes from './routes/payments/create-intent'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",  // djei-web dev
      "https://djei.com",       // djei-web prod
    ],
    methods: ["GET", "POST"]
  }
})

// Middleware
app.use(helmet())
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://djei.com"
  ],
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/music/spotify', spotifyRoutes)
app.use('/api/payments/create-intent', createIntentRoutes)

// Default API route
app.get('/api', (req, res) => {
  res.json({ message: 'DJEI Backend API', version: '1.0.0' })
})

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 DJEI Backend running on port ${PORT}`)
  console.log(`📡 WebSocket server ready`)
}) 