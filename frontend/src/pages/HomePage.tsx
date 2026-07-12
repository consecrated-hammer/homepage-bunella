import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import { GearIcon } from '../components/Icons'

type DisplayMode = 'single' | 'rotation'
type ImageFit = 'cover' | 'contain' | 'fill' | 'scale-down'
type RenderPosition = 'center' | 'east' | 'west' | 'north' | 'south' | 'northwest'
type TimerUnit = 'seconds' | 'minutes'
type AdvanceMode = 'random' | 'sequential' | 'shuffle'

interface Image {
  id: number
  filename: string
  original_name: string
  upload_date: number
  in_rotation: number
  width: number | null
  height: number | null
  file_size: number | null
  content_hash: string | null
  rotation_order: number | null
  favourite: number
}

interface PublicSettings {
  display_mode: DisplayMode
  single_image_id: number | null
  color_scheme: string
  page_title: string
  image_fit: ImageFit
  render_enabled: boolean
  render_width: number | null
  render_height: number | null
  render_position: RenderPosition
  slideshow_enabled: boolean
  slideshow_interval_value: number
  slideshow_interval_unit: TimerUnit
  slideshow_advance_mode: AdvanceMode
}

const COLOR_GRADIENTS: Record<string, string> = {
  teal: 'from-teal-600 to-teal-900',
  blue: 'from-blue-600 to-blue-900',
  purple: 'from-purple-600 to-purple-900',
  pink: 'from-pink-600 to-pink-900',
  green: 'from-emerald-600 to-emerald-900',
  orange: 'from-orange-500 to-orange-900',
  red: 'from-red-600 to-red-900',
}

const DEFAULT_SETTINGS: PublicSettings = {
  display_mode: 'rotation',
  single_image_id: null,
  color_scheme: 'teal',
  page_title: 'Home',
  image_fit: 'cover',
  render_enabled: false,
  render_width: 1872,
  render_height: 922,
  render_position: 'northwest',
  slideshow_enabled: false,
  slideshow_interval_value: 30,
  slideshow_interval_unit: 'seconds',
  slideshow_advance_mode: 'random',
}

const buildImageUrl = (image: Image, settings: PublicSettings) => {
  if (settings.render_enabled && settings.render_width && settings.render_height) {
    const params = new URLSearchParams({
      w: String(settings.render_width),
      h: String(settings.render_height),
      position: settings.render_position,
    })
    return `/api/images/${image.id}/render?${params.toString()}`
  }
  return `/images/${image.filename}`
}

const shuffleImages = (items: Image[]) => {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

const renderPositionToObjectPosition = (position: RenderPosition): string => {
  switch (position) {
    case 'northwest':
      return 'left top'
    case 'north':
      return 'center top'
    case 'south':
      return 'center bottom'
    case 'west':
      return 'left center'
    case 'east':
      return 'right center'
    default:
      return 'center center'
  }
}

function HomePage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_SETTINGS)
  const [currentImage, setCurrentImage] = useState<Image | null>(null)
  const [rotationImages, setRotationImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [shuffleQueue, setShuffleQueue] = useState<number[]>([])

  useEffect(() => {
    void fetchData()
  }, [])

  useEffect(() => {
    document.title = settings.page_title
  }, [settings.page_title])

  useEffect(() => {
    if (settings.display_mode !== 'rotation' || !settings.slideshow_enabled || rotationImages.length <= 1) {
      return
    }

    const multiplier = settings.slideshow_interval_unit === 'minutes' ? 60_000 : 1_000
    const intervalMs = Math.max(1, settings.slideshow_interval_value) * multiplier
    const timer = window.setInterval(() => {
      setCurrentImage((previous) => getNextImage(previous, rotationImages, settings.slideshow_advance_mode, shuffleQueue, setShuffleQueue))
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [rotationImages, settings.display_mode, settings.slideshow_advance_mode, settings.slideshow_enabled, settings.slideshow_interval_unit, settings.slideshow_interval_value, shuffleQueue])

  const fetchData = async () => {
    try {
      const [imageRes, settingsRes, rotationRes] = await Promise.all([
        fetch('/api/image'),
        fetch('/api/public-settings'),
        fetch('/api/rotation-images'),
      ])

      const settingsData = settingsRes.ok ? await settingsRes.json() : DEFAULT_SETTINGS
      const rotationData = rotationRes.ok ? await rotationRes.json() : []
      const imageData = imageRes.ok ? await imageRes.json() : null

      setSettings(settingsData)
      setRotationImages(rotationData)
      setCurrentImage(imageData)
      setShuffleQueue(shuffleImages(rotationData).map((item: Image) => item.id))
    } catch (error) {
      console.error('Error loading homepage:', error)
    } finally {
      setLoading(false)
    }
  }

  const gradientClass = COLOR_GRADIENTS[settings.color_scheme] || COLOR_GRADIENTS.teal
  const imageUrl = currentImage ? buildImageUrl(currentImage, settings) : null

  if (loading) {
    return <div className={`flex h-screen w-screen items-center justify-center bg-gradient-to-br ${gradientClass} text-2xl text-white`}>Loading…</div>
  }

  if (!currentImage || !imageUrl) {
    return (
      <div className={`flex h-screen w-screen items-center justify-center bg-gradient-to-br ${gradientClass}`}>
        <div className="text-center text-white">
          <div className="mb-4 text-2xl">No images available</div>
          <button onClick={() => navigate('/admin')} className="rounded-full bg-white px-6 py-3 font-medium text-slate-900 transition hover:bg-slate-100">Open admin</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-gradient-to-br ${gradientClass}`}>
      <img
        src={imageUrl}
        alt={currentImage.original_name}
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: settings.image_fit,
          objectPosition: renderPositionToObjectPosition(settings.render_position),
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-black/10" />

      <div className="absolute bottom-8 right-8 z-10">
        <button
          onClick={() => navigate('/admin')}
          aria-label="Admin settings"
          title="Admin settings"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 hover:rotate-45"
        >
          <GearIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function getNextImage(
  previous: Image | null,
  rotationImages: Image[],
  advanceMode: AdvanceMode,
  shuffleQueue: number[],
  setShuffleQueue: Dispatch<SetStateAction<number[]>>,
) {
  if (rotationImages.length === 0) return previous
  if (rotationImages.length === 1) return rotationImages[0]

  if (advanceMode === 'sequential') {
    if (!previous) return rotationImages[0]
    const index = rotationImages.findIndex((image) => image.id === previous.id)
    return rotationImages[(index + 1 + rotationImages.length) % rotationImages.length] ?? rotationImages[0]
  }

  if (advanceMode === 'shuffle') {
    let queue = shuffleQueue.filter((id) => rotationImages.some((image) => image.id === id))
    if (queue.length === 0) {
      queue = shuffleImages(rotationImages).map((image) => image.id)
      if (previous && queue[0] === previous.id && queue.length > 1) {
        queue.push(queue.shift()!)
      }
    }
    const nextId = queue[0]
    setShuffleQueue(queue.slice(1))
    return rotationImages.find((image) => image.id === nextId) ?? rotationImages[0]
  }

  const candidates = rotationImages.filter((image) => image.id !== previous?.id)
  return candidates[Math.floor(Math.random() * candidates.length)] ?? rotationImages[0]
}

export default HomePage
