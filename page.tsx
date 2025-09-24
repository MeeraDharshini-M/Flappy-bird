"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, RotateCcw, Volume2, VolumeX } from "lucide-react"

interface Bird {
  x: number
  y: number
  velocity: number
  radius: number
}

interface Pipe {
  x: number
  topHeight: number
  bottomY: number
  width: number
  gap: number
  passed: boolean
}

interface GravityZone {
  x: number
  y: number
  width: number
  height: number
  gravity: number
  opacity: number
}

// Remove the getCanvasSize function and replace with fixed constants
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const BIRD_RADIUS = 18 // Slightly smaller bird
const PIPE_WIDTH = 80
const PIPE_GAP = 280 // Increased from 200 to 280 for easier passage
const PIPE_SPEED = 2 // Reduced from 3 to 2 for slower movement
const JUMP_FORCE = -10 // Reduced from -12 to -10 for gentler jumps
const BASE_GRAVITY = 0.4 // Reduced from 0.6 to 0.4 for slower falling

export default function FlappyBirdGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">("menu")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  // Remove: const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  // Game objects
  const birdRef = useRef<Bird>({
    x: 150,
    y: CANVAS_HEIGHT / 2,
    velocity: 0,
    radius: BIRD_RADIUS,
  })
  const pipesRef = useRef<Pipe[]>([])
  const gravityZonesRef = useRef<GravityZone[]>([])
  const currentGravityRef = useRef(BASE_GRAVITY)

  // Audio
  const flapSoundRef = useRef<HTMLAudioElement>()
  const collisionSoundRef = useRef<HTMLAudioElement>()

  // Initialize audio
  useEffect(() => {
    // Create simple audio using Web Audio API for better browser compatibility
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    const createBeep = (frequency: number, duration: number) => {
      return () => {
        if (!soundEnabled) return
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = "square"

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + duration)
      }
    }

    flapSoundRef.current = createBeep(400, 0.1) as any
    collisionSoundRef.current = createBeep(150, 0.3) as any

    // Load high score from localStorage
    const savedHighScore = localStorage.getItem("flappyBirdHighScore")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore))
    }
  }, [soundEnabled])

  // Remove the entire resize useEffect

  const playFlapSound = useCallback(() => {
    if (flapSoundRef.current && soundEnabled) {
      ;(flapSoundRef.current as any)()
    }
  }, [soundEnabled])

  const playCollisionSound = useCallback(() => {
    if (collisionSoundRef.current && soundEnabled) {
      ;(collisionSoundRef.current as any)()
    }
  }, [soundEnabled])

  const generatePipe = useCallback((): Pipe => {
    const topHeight = Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 100) + 50
    return {
      x: CANVAS_WIDTH,
      topHeight,
      bottomY: topHeight + PIPE_GAP,
      width: PIPE_WIDTH,
      gap: PIPE_GAP,
      passed: false,
    }
  }, [])

  const generateGravityZone = useCallback((): GravityZone => {
    return {
      x: CANVAS_WIDTH + Math.random() * 400,
      y: Math.random() * (CANVAS_HEIGHT - 150) + 50,
      width: 100 + Math.random() * 100,
      height: 80 + Math.random() * 80,
      gravity: BASE_GRAVITY * (0.5 + Math.random() * 1.0), // Reduced gravity variation (0.5x to 1.5x instead of 0.3x to 1.7x)
      opacity: 0.3 + Math.random() * 0.4,
    }
  }, [])

  const resetGame = useCallback(() => {
    birdRef.current = {
      x: 150,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      radius: BIRD_RADIUS,
    }
    pipesRef.current = [generatePipe()]
    gravityZonesRef.current = [generateGravityZone()]
    currentGravityRef.current = BASE_GRAVITY
    setScore(0)
  }, [generatePipe, generateGravityZone])

  const jump = useCallback(() => {
    if (gameState === "playing") {
      birdRef.current.velocity = JUMP_FORCE
      playFlapSound()
    }
  }, [gameState, playFlapSound])

  const checkCollision = useCallback((bird: Bird, pipes: Pipe[]): boolean => {
    // Check ground and ceiling collision
    if (bird.y - bird.radius <= 0 || bird.y + bird.radius >= CANVAS_HEIGHT) {
      return true
    }

    // Check pipe collision
    for (const pipe of pipes) {
      if (bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + pipe.width) {
        if (bird.y - bird.radius < pipe.topHeight || bird.y + bird.radius > pipe.bottomY) {
          return true
        }
      }
    }

    return false
  }, [])

  const updateGame = useCallback(() => {
    if (gameState !== "playing") return

    const bird = birdRef.current
    const pipes = pipesRef.current
    const gravityZones = gravityZonesRef.current

    // Check if bird is in any gravity zone
    let activeGravity = BASE_GRAVITY
    for (const zone of gravityZones) {
      if (bird.x > zone.x && bird.x < zone.x + zone.width && bird.y > zone.y && bird.y < zone.y + zone.height) {
        activeGravity = zone.gravity
        break
      }
    }
    currentGravityRef.current = activeGravity

    // Update bird physics
    bird.velocity += activeGravity
    bird.y += bird.velocity

    // Update pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i]
      pipe.x -= PIPE_SPEED

      // Check if bird passed pipe for scoring
      if (!pipe.passed && bird.x > pipe.x + pipe.width) {
        pipe.passed = true
        setScore((prev) => prev + 1)
      }

      // Remove pipes that are off screen
      if (pipe.x + pipe.width < 0) {
        pipes.splice(i, 1)
      }
    }

    // Add new pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < CANVAS_WIDTH - 250) {
      // Reduced from 300 to 250 for more frequent pipes but easier gaps
      pipes.push(generatePipe())
    }

    // Update gravity zones
    for (let i = gravityZones.length - 1; i >= 0; i--) {
      const zone = gravityZones[i]
      zone.x -= PIPE_SPEED * 0.7 // Move slightly slower than pipes

      // Remove zones that are off screen
      if (zone.x + zone.width < 0) {
        gravityZones.splice(i, 1)
      }
    }

    // Add new gravity zones
    if (gravityZones.length === 0 || gravityZones[gravityZones.length - 1].x < CANVAS_WIDTH - 400) {
      gravityZones.push(generateGravityZone())
    }

    // Check collision
    if (checkCollision(bird, pipes)) {
      playCollisionSound()
      setGameState("gameOver")

      // Update high score
      if (score > highScore) {
        setHighScore(score)
        localStorage.setItem("flappyBirdHighScore", score.toString())
      }
    }
  }, [gameState, score, highScore, generatePipe, generateGravityZone, checkCollision, playCollisionSound])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, "#87CEEB")
    gradient.addColorStop(1, "#98FB98")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw gravity zones
    gravityZonesRef.current.forEach((zone) => {
      ctx.save()
      ctx.globalAlpha = zone.opacity

      // Color based on gravity strength
      const intensity = (zone.gravity - BASE_GRAVITY * 0.3) / (BASE_GRAVITY * 1.4)
      const red = Math.floor(255 * intensity)
      const blue = Math.floor(255 * (1 - intensity))
      ctx.fillStyle = `rgb(${red}, 100, ${blue})`

      ctx.fillRect(zone.x, zone.y, zone.width, zone.height)

      // Add border
      ctx.strokeStyle = `rgb(${red}, 80, ${blue})`
      ctx.lineWidth = 2
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height)

      ctx.restore()
    })

    // Draw pipes
    ctx.fillStyle = "#228B22"
    pipesRef.current.forEach((pipe) => {
      // Top pipe
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight)
      // Bottom pipe
      ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, CANVAS_HEIGHT - pipe.bottomY)

      // Pipe borders
      ctx.strokeStyle = "#006400"
      ctx.lineWidth = 3
      ctx.strokeRect(pipe.x, 0, pipe.width, pipe.topHeight)
      ctx.strokeRect(pipe.x, pipe.bottomY, pipe.width, CANVAS_HEIGHT - pipe.bottomY)
    })

    // Draw bird
    const bird = birdRef.current
    ctx.save()
    ctx.translate(bird.x, bird.y)

    // Rotate bird based on velocity
    const rotation = Math.min(Math.max(bird.velocity * 0.05, -0.5), 0.5)
    ctx.rotate(rotation)

    // Bird body
    ctx.fillStyle = "#FFD700"
    ctx.beginPath()
    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2)
    ctx.fill()

    // Bird border
    ctx.strokeStyle = "#FFA500"
    ctx.lineWidth = 3
    ctx.stroke()

    // Bird eye
    ctx.fillStyle = "#000"
    ctx.beginPath()
    ctx.arc(5, -5, 4, 0, Math.PI * 2)
    ctx.fill()

    // Bird beak
    ctx.fillStyle = "#FF4500"
    ctx.beginPath()
    ctx.moveTo(bird.radius - 5, 0)
    ctx.lineTo(bird.radius + 10, -3)
    ctx.lineTo(bird.radius + 10, 3)
    ctx.closePath()
    ctx.fill()

    ctx.restore()

    // Draw current gravity indicator
    if (currentGravityRef.current !== BASE_GRAVITY) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
      ctx.font = "16px Arial"
      const gravityText = `Gravity: ${(currentGravityRef.current / BASE_GRAVITY).toFixed(1)}x`
      ctx.fillText(gravityText, 10, CANVAS_HEIGHT - 20)
    }
  }, [])

  const gameLoop = useCallback(() => {
    updateGame()
    draw()
    animationRef.current = requestAnimationFrame(gameLoop)
  }, [updateGame, draw])

  const startGame = useCallback(() => {
    resetGame()
    setGameState("playing")
  }, [resetGame])

  const restartGame = useCallback(() => {
    setGameState("menu")
  }, [])

  // Handle click/tap events
  useEffect(() => {
    const handleClick = () => {
      if (gameState === "playing") {
        jump()
      }
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("click", handleClick)
      canvas.addEventListener("touchstart", handleClick)

      return () => {
        canvas.removeEventListener("click", handleClick)
        canvas.removeEventListener("touchstart", handleClick)
      }
    }
  }, [gameState, jump])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault()
        jump()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [jump])

  // Game loop
  useEffect(() => {
    if (gameState === "playing") {
      animationRef.current = requestAnimationFrame(gameLoop)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState, gameLoop])

  // Draw static screen for menu and game over
  useEffect(() => {
    if (gameState !== "playing") {
      draw()
    }
  }, [gameState, draw])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 to-green-400 flex flex-col items-center justify-center p-4 relative">
      <div className="w-full max-w-6xl flex-1 flex flex-col">
        <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-2xl flex-1 flex flex-col">
          <div className="text-center mb-4">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-2">Flappy Bird</h1>
            <p className="text-sm md:text-base text-gray-600">
              Navigate through gravity zones! Click, tap, or press space to flap.
            </p>
          </div>

          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-blue-600">{score}</div>
                <div className="text-xs md:text-sm text-gray-600">Score</div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-purple-600">{highScore}</div>
                <div className="text-xs md:text-sm text-gray-600">High Score</div>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="border-4 border-gray-300 rounded-lg cursor-pointer shadow-lg w-full max-w-full h-auto"
                style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
              />

              {/* Centered Start Game Button */}
              {gameState === "menu" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="text-center text-white">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Fly?</h2>
                    <p className="text-base md:text-lg mb-2">Watch out for gravity zones!</p>
                    <p className="text-xs md:text-sm opacity-80 mb-6">
                      Red zones = stronger gravity, Blue zones = weaker gravity
                    </p>
                    <Button
                      onClick={startGame}
                      size="lg"
                      className="bg-green-500 hover:bg-green-600 text-white px-8 py-3"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Game
                    </Button>
                  </div>
                </div>
              )}

              {/* Centered Play Again Button */}
              {gameState === "gameOver" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="text-center text-white">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4">Game Over!</h2>
                    <p className="text-lg md:text-xl mb-2">Final Score: {score}</p>
                    {score === highScore && score > 0 && (
                      <p className="text-base md:text-lg text-yellow-300 mb-4">🎉 New High Score! 🎉</p>
                    )}
                    <Button
                      onClick={restartGame}
                      size="lg"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Play Again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-center text-xs md:text-sm text-gray-600">
            <p>Controls: Click, tap, or press Space/↑ to flap</p>
            <p className="mt-1">
              <span className="inline-block w-3 h-3 bg-red-400 rounded mr-1"></span>
              Strong Gravity Zones
              <span className="mx-2">•</span>
              <span className="inline-block w-3 h-3 bg-blue-400 rounded mr-1"></span>
              Weak Gravity Zones
            </p>
          </div>
        </Card>
      </div>

      {/* Project Credits */}
      <div className="absolute bottom-4 right-4 text-xs md:text-sm text-white/80 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
        Project By M. Meera Dharshini, Neha M K
      </div>
    </div>
  )
}
