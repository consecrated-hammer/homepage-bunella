import { useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ClockIcon,
  CropIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  EyeIcon,
  FilmIcon,
  GearIcon,
  GridIcon,
  HardDriveIcon,
  ImageIcon,
  KeyIcon,
  LayersIcon,
  LockIcon,
  LogOutIcon,
  MonitorIcon,
  PaletteIcon,
  PlusIcon,
  RectHorizontalIcon,
  RectVerticalIcon,
  RepeatIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  TextIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '../components/Icons'

type DisplayMode = 'single' | 'rotation'
type ImageFit = 'cover' | 'contain' | 'fill' | 'scale-down'
type RenderPosition = 'center' | 'east' | 'west' | 'north' | 'south' | 'northwest'
type TimerUnit = 'seconds' | 'minutes'
type AdvanceMode = 'random' | 'sequential' | 'shuffle'
type FilterMode = 'all' | 'rotation' | 'favourites' | 'landscape' | 'portrait' | 'recent'
type BulkAction = 'enable-rotation' | 'disable-rotation' | 'favourite' | 'unfavourite' | 'delete'

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

interface Settings {
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

interface UploadResult {
  uploaded: Image[]
  failed: Array<{ original_name: string; error: string }>
  duplicates: Array<{ original_name: string; matched_image_id: number; matched_filename: string }>
}

interface Stats {
  image_count: number
  variant_count: number
  total_original_size: number
  total_variant_size: number
}

interface UploadQueueItem {
  key: string
  name: string
  status: 'queued' | 'uploading' | 'uploaded' | 'failed'
  detail?: string
}

const COLOR_OPTIONS = [
  { name: 'Teal', value: 'teal', swatch: 'bg-teal-500' },
  { name: 'Blue', value: 'blue', swatch: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', swatch: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', swatch: 'bg-pink-500' },
  { name: 'Green', value: 'green', swatch: 'bg-green-500' },
  { name: 'Orange', value: 'orange', swatch: 'bg-orange-500' },
  { name: 'Red', value: 'red', swatch: 'bg-red-500' },
]

const COLOR_GRADIENTS: Record<string, string> = {
  teal: 'from-teal-600 to-teal-900',
  blue: 'from-blue-600 to-blue-900',
  purple: 'from-purple-600 to-purple-900',
  pink: 'from-pink-600 to-pink-900',
  green: 'from-emerald-600 to-emerald-900',
  orange: 'from-orange-500 to-orange-900',
  red: 'from-red-600 to-red-900',
}

const IMAGE_FIT_OPTIONS: Array<{ value: ImageFit; label: string }> = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Fill' },
  { value: 'scale-down', label: 'Scale down' },
]

const RENDER_POSITION_OPTIONS: Array<{ value: RenderPosition; label: string }> = [
  { value: 'center', label: 'Center' },
  { value: 'northwest', label: 'Top left' },
  { value: 'east', label: 'Right / East' },
  { value: 'west', label: 'Left / West' },
  { value: 'north', label: 'Top / North' },
  { value: 'south', label: 'Bottom / South' },
]

const FILTER_OPTIONS: Array<{ value: FilterMode; label: string; icon: (p: { className?: string }) => ReactNode }> = [
  { value: 'all', label: 'All', icon: GridIcon },
  { value: 'rotation', label: 'Slideshow', icon: RepeatIcon },
  { value: 'favourites', label: 'Favourites', icon: StarIcon },
  { value: 'landscape', label: 'Landscape', icon: RectHorizontalIcon },
  { value: 'portrait', label: 'Portrait', icon: RectVerticalIcon },
  { value: 'recent', label: 'Recent', icon: ClockIcon },
]

const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const buildImageUrl = (image: Image, settings: Settings) => {
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

const getNextPreviewImage = (
  previous: Image | null,
  rotationImages: Image[],
  advanceMode: AdvanceMode,
  shuffleQueue: number[],
): { image: Image | null; nextQueue: number[] } => {
  if (rotationImages.length === 0) return { image: previous, nextQueue: shuffleQueue }
  if (rotationImages.length === 1) return { image: rotationImages[0], nextQueue: shuffleQueue }

  if (advanceMode === 'sequential') {
    if (!previous) return { image: rotationImages[0], nextQueue: shuffleQueue }
    const index = rotationImages.findIndex((image) => image.id === previous.id)
    return {
      image: rotationImages[(index + 1 + rotationImages.length) % rotationImages.length] ?? rotationImages[0],
      nextQueue: shuffleQueue,
    }
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
    return {
      image: rotationImages.find((image) => image.id === nextId) ?? rotationImages[0],
      nextQueue: queue.slice(1),
    }
  }

  const candidates = rotationImages.filter((image) => image.id !== previous?.id)
  return {
    image: candidates[Math.floor(Math.random() * candidates.length)] ?? rotationImages[0],
    nextQueue: shuffleQueue,
  }
}

// Apple-style field base used by inline inputs (sits on an elevated grouped cell).
const fieldCls = 'rounded-lg bg-apple-bg3 px-3 py-1.5 text-[15px] text-apple-label placeholder:text-apple-label3 focus:outline-none focus:ring-2 focus:ring-apple-blue/60'

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

function AdminPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [images, setImages] = useState<Image[]>([])
  const [settings, setSettings] = useState<Settings>({
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
  })
  const [draftSettings, setDraftSettings] = useState<Settings>(settings)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [password, setPassword] = useState(() => sessionStorage.getItem('admin_password') || '')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [previewImageId, setPreviewImageId] = useState<number | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState<number[]>([])
  const [actionMessage, setActionMessage] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [currentPreviewedImageId, setCurrentPreviewedImageId] = useState<number | null>(null)

  const authHeaders = useMemo(() => ({
    Authorization: `Basic ${btoa(`admin:${password}`)}`,
  }), [password])

  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(draftSettings), [settings, draftSettings])

  useEffect(() => {
    if (password && !isAuthenticated) {
      void handleLogin()
    }
  }, [])

  useEffect(() => {
    setDraftSettings(settings)
  }, [settings])

  useEffect(() => {
    if (isAuthenticated) {
      void fetchData()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!actionMessage) return
    const timer = window.setTimeout(() => setActionMessage(''), 2800)
    return () => window.clearTimeout(timer)
  }, [actionMessage])

  // Auto-save: debounce edits to the draft and persist them. The timer resets
  // on every change, so rapid edits (typing, dragging) collapse into one save.
  useEffect(() => {
    if (!isAuthenticated || !isDirty) return
    const timer = window.setTimeout(() => { void saveSettings(undefined, { silent: true }) }, 700)
    return () => window.clearTimeout(timer)
  }, [draftSettings, isAuthenticated, isDirty])

  const handleLogin = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setAuthError('')

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        throw new Error('Invalid password')
      }

      sessionStorage.setItem('admin_password', password)
      setIsAuthenticated(true)
    } catch {
      sessionStorage.removeItem('admin_password')
      setAuthError('Invalid password')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [imagesRes, settingsRes, statsRes] = await Promise.all([
        fetch('/api/images', { headers: authHeaders }),
        fetch('/api/settings', { headers: authHeaders }),
        fetch('/api/stats', { headers: authHeaders }),
      ])

      if (imagesRes.status === 401 || settingsRes.status === 401) {
        setIsAuthenticated(false)
        sessionStorage.removeItem('admin_password')
        return
      }

      const [imagesData, settingsData, statsData] = await Promise.all([
        imagesRes.json(),
        settingsRes.json(),
        statsRes.ok ? statsRes.json() : Promise.resolve(null),
      ])

      setImages(imagesData)
      setSettings(settingsData)
      setStats(statsData)
      setPreviewImageId((current) => current ?? settingsData.single_image_id ?? imagesData[0]?.id ?? null)
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (partial?: Partial<Settings> & { new_password?: string }, options?: { silent?: boolean }) => {
    const nextSettings = partial ? { ...draftSettings, ...partial } : draftSettings
    setSavingSettings(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(partial ?? nextSettings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      const data = await response.json()
      setSettings(data)
      setDraftSettings(data)
      setSaveFailed(false)
      // Auto-saves stay quiet — the toolbar status conveys them. Explicit
      // actions (card "use as single", password change) still toast.
      if (!options?.silent) setActionMessage('Settings saved')
    } catch (error) {
      console.error(error)
      setSaveFailed(true)
      if (!options?.silent) setActionMessage('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const setQueueFromFiles = (files: File[]) => {
    setQueue(files.map((file) => ({ key: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, status: 'queued' })))
  }

  const handleUploadFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files)
    if (selectedFiles.length === 0) return

    setQueueFromFiles(selectedFiles)
    setUploadWarnings([])
    setUploading(true)

    const formData = new FormData()
    selectedFiles.forEach((file) => formData.append('images', file))

    setQueue((current) => current.map((item) => ({ ...item, status: 'uploading' })))

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })

      const result = (await response.json()) as UploadResult
      if (!response.ok) {
        throw new Error((result as any).error || 'Upload failed')
      }

      const uploadedIds = result.uploaded.map((image) => image.id)
      setUploadWarnings(result.duplicates.map((item) => `${item.original_name} matches existing image #${item.matched_image_id}`))
      setHighlightedIds(uploadedIds)
      setQueue((current) => current.map((item) => {
        const failed = result.failed.find((entry) => entry.original_name === item.name)
        if (failed) {
          return { ...item, status: 'failed', detail: failed.error }
        }
        return { ...item, status: 'uploaded' }
      }))
      await fetchData()
      setActionMessage(`Uploaded ${result.uploaded.length} image${result.uploaded.length === 1 ? '' : 's'}`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Upload failed'
      setQueue((current) => current.map((item) => ({ ...item, status: 'failed', detail })))
      setActionMessage(detail)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const selectAllFiltered = (items: Image[]) => {
    setSelectedIds(items.map((item) => item.id))
  }

  const clearSelection = () => setSelectedIds([])

  const toggleSelectedId = (imageId: number) => {
    setSelectedIds((current) => current.includes(imageId)
      ? current.filter((id) => id !== imageId)
      : [...current, imageId])
  }

  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase()
    return images.filter((image) => {
      if (query && !image.original_name.toLowerCase().includes(query)) {
        return false
      }
      switch (filter) {
        case 'rotation':
          return image.in_rotation === 1
        case 'favourites':
          return image.favourite === 1
        case 'landscape':
          return (image.width ?? 0) >= (image.height ?? 0)
        case 'portrait':
          return (image.height ?? 0) > (image.width ?? 0)
        case 'recent':
          return Date.now() - image.upload_date <= 1000 * 60 * 60 * 24 * 7
        default:
          return true
      }
    })
  }, [filter, images, search])

  const rotationImages = useMemo(
    () => [...images].filter((image) => image.in_rotation === 1).sort((a, b) => (a.rotation_order ?? 999999) - (b.rotation_order ?? 999999) || b.upload_date - a.upload_date),
    [images],
  )

  const previewImage = useMemo(() => {
    if (!images.length) return null
    if (draftSettings.display_mode === 'single' && draftSettings.single_image_id != null) {
      const selectedSingle = images.find((image) => image.id === draftSettings.single_image_id)
      if (selectedSingle) return selectedSingle
    }
    if (previewImageId != null) {
      const selectedPreview = images.find((image) => image.id === previewImageId)
      if (selectedPreview) return selectedPreview
    }
    if (draftSettings.display_mode === 'rotation' && draftSettings.slideshow_enabled) {
      return rotationImages[0] ?? images[0]
    }
    return rotationImages[0] ?? images[0]
  }, [draftSettings.display_mode, draftSettings.single_image_id, draftSettings.slideshow_enabled, images, previewImageId, rotationImages])

  const effectivePreviewImageId = previewImage?.id ?? null

  const singleImage = useMemo(
    () => images.find((image) => image.id === draftSettings.single_image_id) ?? null,
    [draftSettings.single_image_id, images],
  )

  const currentPreviewedImage = useMemo(
    () => images.find((image) => image.id === currentPreviewedImageId) ?? null,
    [currentPreviewedImageId, images],
  )

  const applyImagePatch = async (imageId: number, patch: { in_rotation?: boolean; favourite?: boolean; rotation_order?: number }) => {
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    })

    if (response.ok) {
      const updatedImage = await response.json() as Image
      setImages((current) => current.map((image) => image.id === imageId ? updatedImage : image))
    }
  }

  const setSingleImage = (imageId: number) => {
    setDraftSettings((current) => ({ ...current, single_image_id: imageId }))
    setPreviewImageId(imageId)
  }

  const handleDelete = async (imageId: number) => {
    const image = images.find((entry) => entry.id === imageId)
    const isActiveSingle = settings.single_image_id === imageId && settings.display_mode === 'single'
    const message = isActiveSingle
      ? `Delete ${image?.original_name}? This is the active single image.`
      : `Delete ${image?.original_name}?`

    if (!window.confirm(message)) return

    const response = await fetch(`/api/images/${imageId}`, {
      method: 'DELETE',
      headers: authHeaders,
    })

    if (response.ok) {
      await fetchData()
      setSelectedIds((current) => current.filter((id) => id !== imageId))
    }
  }

  const runBulkAction = async (action: BulkAction) => {
    if (!selectedIds.length) return
    if (action === 'delete' && !window.confirm(`Delete ${selectedIds.length} selected images?`)) return

    const response = await fetch('/api/images/bulk', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: selectedIds, action }),
    })

    if (response.ok) {
      clearSelection()
      await fetchData()
    }
  }

  const moveRotationImage = async (imageId: number, direction: -1 | 1) => {
    const index = rotationImages.findIndex((image) => image.id === imageId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= rotationImages.length) return

    const reordered = [...rotationImages]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(nextIndex, 0, moved)

    const response = await fetch('/api/images/order', {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderedIds: reordered.map((image) => image.id) }),
    })

    if (response.ok) {
      await fetchData()
    }
  }

  const clearVariantCache = async (imageIds?: number[]) => {
    const label = imageIds?.length ? `Clear cached variants for ${imageIds.length} image${imageIds.length === 1 ? '' : 's'}?` : 'Clear the entire variant cache?'
    if (!window.confirm(label)) return

    const response = await fetch('/api/cache/clear', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(imageIds?.length ? { imageIds } : {}),
    })

    if (response.ok) {
      const data = await response.json()
      setStats(data.stats)
      setActionMessage('Variant cache cleared')
    }
  }

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    await handleUploadFiles(event.dataTransfer.files)
  }

  const savePassword = async () => {
    if (!newPassword.trim()) return
    await saveSettings({ new_password: newPassword })
    setPassword(newPassword)
    sessionStorage.setItem('admin_password', newPassword)
    setNewPassword('')
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-apple-bg px-6 font-sf text-apple-label">
        <div className="w-full max-w-[400px] rounded-apple-xl bg-apple-bg2 p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-b from-apple-blue to-[#0066d6] text-white shadow-lg shadow-apple-blue/30">
              <ImageIcon className="h-8 w-8" />
            </span>
            <h1 className="mt-4 text-[22px] font-semibold">Background Manager</h1>
            <p className="mt-1 text-[14px] text-apple-label2">Sign in to manage the homepage library.</p>
          </div>
          <form onSubmit={handleLogin} className="mt-7 space-y-3">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-apple bg-apple-bg3 px-4 py-3 text-[15px] text-apple-label placeholder:text-apple-label3 focus:outline-none focus:ring-2 focus:ring-apple-blue/60"
              placeholder="Password"
              required
            />
            {authError && (
              <div className="flex items-center justify-center gap-2 text-[13px] text-apple-red">
                <AlertIcon className="h-4 w-4 shrink-0" />
                {authError}
              </div>
            )}
            <AppleButton type="submit" className="w-full">Sign In</AppleButton>
          </form>
          <button onClick={() => navigate('/')} className="mt-5 block w-full text-center text-[14px] text-apple-blue transition hover:opacity-70">
            Back to homepage
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-apple-bg font-sf text-apple-label">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-apple-blue" />
        <span className="text-[14px] text-apple-label2">Loading…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-apple-bg pb-16 font-sf text-apple-label">
      <AdminToolbar
        stats={stats}
        imageCount={images.length}
        savingSettings={savingSettings}
        isDirty={isDirty}
        saveFailed={saveFailed}
        onRetrySave={() => void saveSettings()}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        onSavePassword={() => void savePassword()}
        onClearCache={() => void clearVariantCache()}
        onOpenHome={() => window.open('/', '_blank', 'noopener')}
        onSignOut={() => { sessionStorage.removeItem('admin_password'); setIsAuthenticated(false) }}
      />

      <main className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(320px,30rem)_minmax(0,1fr)_22rem] xl:grid-cols-[minmax(360px,34rem)_minmax(0,1fr)_24rem]">
          <PreviewPane
            previewImage={previewImage}
            currentPreviewedImage={currentPreviewedImage ?? previewImage}
            rotationImages={rotationImages}
            draftSettings={draftSettings}
            onDisplayedImageChange={setCurrentPreviewedImageId}
            className="order-1 lg:order-2 lg:min-w-0"
          />

          <InspectorPane
            draftSettings={draftSettings}
            setDraftSettings={setDraftSettings}
            singleImage={singleImage}
            className="order-2 lg:order-3 lg:max-h-[calc(100vh-5.75rem)] lg:overflow-y-auto lg:pr-1"
          />

          <LibraryPane
            images={images}
            filteredImages={filteredImages}
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            selectedIds={selectedIds}
            previewImageId={currentPreviewedImageId ?? effectivePreviewImageId}
            highlightedIds={highlightedIds}
            draftSettings={draftSettings}
            queue={queue}
            uploadWarnings={uploadWarnings}
            uploading={uploading}
            dragActive={dragActive}
            fileInputRef={fileInputRef}
            className="order-3 lg:order-1 lg:max-h-[calc(100vh-5.75rem)] lg:overflow-y-auto lg:pr-1"
            onDrop={onDrop}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onFilesSelected={(files) => void handleUploadFiles(files)}
            onSelectAllFiltered={() => selectAllFiltered(filteredImages)}
            onClearSelection={clearSelection}
            onBulkAction={(action) => void runBulkAction(action)}
            onBulkClearCache={() => void clearVariantCache(selectedIds)}
            onToggleFavourite={(imageId, isFavourite) => void applyImagePatch(imageId, { favourite: !isFavourite })}
            onPreviewImage={setPreviewImageId}
            onToggleSelectedId={toggleSelectedId}
            onSetSingleImage={setSingleImage}
            onToggleRotation={(imageId, inRotation) => void applyImagePatch(imageId, { in_rotation: !inRotation })}
            onClearImageCache={(imageId) => void clearVariantCache([imageId])}
            onMoveRotationImage={(imageId, direction) => void moveRotationImage(imageId, direction)}
            onDeleteImage={(imageId) => void handleDelete(imageId)}
          />
        </div>
      </main>

      {actionMessage && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="rounded-full bg-apple-bg3/95 px-4 py-2 text-[13px] font-medium text-apple-label shadow-lg shadow-black/40 backdrop-blur">
            {actionMessage}
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Apple HIG components ----------------------------- */

function AdminToolbar({
  stats,
  imageCount,
  savingSettings,
  isDirty,
  saveFailed,
  onRetrySave,
  newPassword,
  setNewPassword,
  onSavePassword,
  onClearCache,
  onOpenHome,
  onSignOut,
}: {
  stats: Stats | null
  imageCount: number
  savingSettings: boolean
  isDirty: boolean
  saveFailed: boolean
  onRetrySave: () => void
  newPassword: string
  setNewPassword: (value: string) => void
  onSavePassword: () => void
  onClearCache: () => void
  onOpenHome: () => void
  onSignOut: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-apple-sep bg-apple-bg/72 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-gradient-to-b from-apple-blue to-[#0066d6] text-white shadow-sm">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <h1 className="text-[17px] font-semibold">Background</h1>
            <p className="text-[12px] text-apple-label2">Homepage manager</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-5 xl:flex">
            <StatItem icon={<ImageIcon className="h-4 w-4" />} value={String(stats?.image_count ?? imageCount)} label="Images" />
            <StatItem icon={<LayersIcon className="h-4 w-4" />} value={String(stats?.variant_count ?? 0)} label="Variants" />
            <StatItem icon={<HardDriveIcon className="h-4 w-4" />} value={formatBytes(stats?.total_original_size)} label="Originals" />
            <StatItem icon={<DatabaseIcon className="h-4 w-4" />} value={formatBytes(stats?.total_variant_size)} label="Cache" />
          </div>
          <div className="flex items-center gap-1.5 text-[13px]">
            {saveFailed ? (
              <button onClick={onRetrySave} className="inline-flex items-center gap-1.5 font-medium text-apple-red transition hover:opacity-80">
                <AlertIcon className="h-4 w-4" /> Save failed · Retry
              </button>
            ) : savingSettings || isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-apple-label2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/20 border-t-apple-blue" /> Saving…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-apple-label2">
                <CheckIcon className="h-4 w-4 text-apple-green" /> Saved
              </span>
            )}
          </div>
          <span className="hidden h-5 w-px bg-apple-sep sm:block" />
          <AccountMenu
            cacheLabel={formatBytes(stats?.total_variant_size)}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            onSavePassword={onSavePassword}
            onClearCache={onClearCache}
            onOpenHome={onOpenHome}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  )
}

function PreviewPane({
  previewImage,
  currentPreviewedImage,
  rotationImages,
  draftSettings,
  onDisplayedImageChange,
  className,
}: {
  previewImage: Image | null
  currentPreviewedImage: Image | null
  rotationImages: Image[]
  draftSettings: Settings
  onDisplayedImageChange: (imageId: number | null) => void
  className?: string
}) {
  return (
    <section className={className}>
      <div className="lg:sticky lg:top-[76px]">
        <PaneHeader
          eyebrow="Canvas"
          title="Live Preview"
          subtitle="The mock homepage updates immediately from your draft settings."
        />
        {previewImage ? (
          <div className="space-y-4">
            <BrowserPreview image={previewImage} rotationImages={rotationImages} settings={draftSettings} onDisplayedImageChange={onDisplayedImageChange} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetaPill icon={<ImageIcon className="h-4 w-4" />} label="Image" value={(currentPreviewedImage ?? previewImage).original_name} />
              <MetaPill
                icon={<RectHorizontalIcon className="h-4 w-4" />}
                label="Original"
                value={(currentPreviewedImage ?? previewImage).width && (currentPreviewedImage ?? previewImage).height ? `${(currentPreviewedImage ?? previewImage).width}×${(currentPreviewedImage ?? previewImage).height}` : 'Unknown'}
              />
              <MetaPill
                icon={<CropIcon className="h-4 w-4" />}
                label="Rendered"
                value={draftSettings.render_enabled && draftSettings.render_width && draftSettings.render_height
                  ? `${draftSettings.render_width}×${draftSettings.render_height}`
                  : 'Disabled'}
              />
              <MetaPill
                icon={<MonitorIcon className="h-4 w-4" />}
                label="Mode"
                value={draftSettings.display_mode === 'single' ? 'Single image' : 'Slideshow'}
              />
              <MetaPill
                icon={<ChevronUpDownIcon className="h-4 w-4" />}
                label="Crop"
                value={draftSettings.render_enabled ? draftSettings.render_position : 'Not used'}
              />
              <MetaPill
                icon={<ClockIcon className="h-4 w-4" />}
                label="Slideshow"
                value={draftSettings.display_mode === 'rotation' && draftSettings.slideshow_enabled
                  ? `${draftSettings.slideshow_interval_value} ${draftSettings.slideshow_interval_unit} · ${draftSettings.slideshow_advance_mode}`
                  : 'Off'}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-apple-lg bg-apple-bg2 p-8 text-center text-[14px] text-apple-label2">
            <ImageIcon className="h-7 w-7 text-apple-label3" />
            Upload images to enable preview.
          </div>
        )}
      </div>
    </section>
  )
}

function InspectorPane({
  draftSettings,
  setDraftSettings,
  singleImage,
  className,
}: {
  draftSettings: Settings
  setDraftSettings: Dispatch<SetStateAction<Settings>>
  singleImage: Image | null
  className?: string
}) {
  return (
    <section className={`space-y-5 ${className ?? ''}`}>
      <PaneHeader
        eyebrow="Inspector"
        title="Display Settings"
        subtitle="Tune mode, timing, render target, and accent without leaving the preview."
      />

      <ListGroup header="Mode">
        <ListBlock>
          <Segmented
            full
            value={draftSettings.display_mode}
            onChange={(value) => setDraftSettings((current) => ({ ...current, display_mode: value }))}
            options={[
              { value: 'rotation', label: 'Slideshow', icon: <RepeatIcon className="h-4 w-4" /> },
              { value: 'single', label: 'Single image', icon: <MonitorIcon className="h-4 w-4" /> },
            ]}
          />
        </ListBlock>
        {draftSettings.display_mode === 'single' && (
          <ListBlock title="Single image">
            <p className="mt-2 text-[12px] text-apple-label2">
              {singleImage
                ? `Showing “${singleImage.original_name}”. Choose another image from the library to replace it.`
                : 'Choose an image from the library. The per-image select action is only shown in single-image mode.'}
            </p>
          </ListBlock>
        )}
      </ListGroup>

      {draftSettings.display_mode === 'rotation' && (
        <ListGroup header="Slideshow">
          <ListRow
            icon={<FilmIcon className="h-[18px] w-[18px]" />}
            iconBg="bg-apple-orange"
            title="Enable slideshow"
            subtitle="Automatically change the background on a timer."
            trailing={<Switch checked={draftSettings.slideshow_enabled} onChange={(checked) => setDraftSettings((current) => ({ ...current, slideshow_enabled: checked }))} label="Slideshow" />}
          />
          {draftSettings.slideshow_enabled && (
            <>
              <ListRow
                title="Interval"
                trailing={(
                  <>
                    <input
                      type="number"
                      min={1}
                      value={draftSettings.slideshow_interval_value}
                      onChange={(event) => setDraftSettings((current) => ({ ...current, slideshow_interval_value: Math.max(1, Number(event.target.value) || 1) }))}
                      className={`${fieldCls} w-[72px] text-right`}
                    />
                    <PopupSelect
                      value={draftSettings.slideshow_interval_unit}
                      onChange={(event) => setDraftSettings((current) => ({ ...current, slideshow_interval_unit: event.target.value as TimerUnit }))}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                    </PopupSelect>
                  </>
                )}
              />
              <ListRow
                title="Advance mode"
                trailing={(
                  <PopupSelect
                    value={draftSettings.slideshow_advance_mode}
                    onChange={(event) => setDraftSettings((current) => ({ ...current, slideshow_advance_mode: event.target.value as AdvanceMode }))}
                  >
                    <option value="random">Random</option>
                    <option value="sequential">Sequential</option>
                    <option value="shuffle">Shuffle</option>
                  </PopupSelect>
                )}
              />
              <div className="px-4 pb-3 text-[12px] text-apple-label2">
                <span className="font-medium text-apple-label">Random</span> can repeat images before every image has been shown.{' '}
                <span className="font-medium text-apple-label">Shuffle</span> randomizes the full set, then walks through it once before reshuffling.
              </div>
            </>
          )}
        </ListGroup>
      )}

      <ListGroup header="Render">
        <ListRow
          icon={<CropIcon className="h-[18px] w-[18px]" />}
          iconBg="bg-apple-purple"
          title="Resize for the screen"
          subtitle="Serve a screen-sized copy instead of the full-size original."
          trailing={<Switch checked={draftSettings.render_enabled} onChange={(checked) => setDraftSettings((current) => ({ ...current, render_enabled: checked }))} label="Target-size rendering" />}
        />
        {draftSettings.render_enabled && (
          <>
            <ListRow
              title="Width"
              trailing={(
                <input
                  type="number"
                  min={1}
                  value={draftSettings.render_width ?? ''}
                  onChange={(event) => setDraftSettings((current) => ({ ...current, render_width: event.target.value ? Number(event.target.value) : null }))}
                  className={`${fieldCls} w-[96px] text-right`}
                />
              )}
            />
            <ListRow
              title="Height"
              trailing={(
                <input
                  type="number"
                  min={1}
                  value={draftSettings.render_height ?? ''}
                  onChange={(event) => setDraftSettings((current) => ({ ...current, render_height: event.target.value ? Number(event.target.value) : null }))}
                  className={`${fieldCls} w-[96px] text-right`}
                />
              )}
            />
            <ListRow
              title="Crop position"
              trailing={(
                <PopupSelect
                  value={draftSettings.render_position}
                  onChange={(event) => setDraftSettings((current) => ({ ...current, render_position: event.target.value as RenderPosition }))}
                >
                  {RENDER_POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </PopupSelect>
              )}
            />
          </>
        )}
      </ListGroup>

      <ListGroup header="Appearance">
        <ListRow
          icon={<TextIcon className="h-[18px] w-[18px]" />}
          iconBg="bg-apple-indigo"
          title="Page title"
          trailing={(
            <input
              type="text"
              value={draftSettings.page_title}
              onChange={(event) => setDraftSettings((current) => ({ ...current, page_title: event.target.value }))}
              className={`${fieldCls} w-[150px] text-right`}
            />
          )}
        />
        <ListRow
          icon={<RectHorizontalIcon className="h-[18px] w-[18px]" />}
          iconBg="bg-apple-teal"
          title="Image fit"
          trailing={(
            <PopupSelect
              value={draftSettings.image_fit}
              onChange={(event) => setDraftSettings((current) => ({ ...current, image_fit: event.target.value as ImageFit }))}
            >
              {IMAGE_FIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </PopupSelect>
          )}
        />
        <ListBlock title={<span className="inline-flex items-center gap-2"><PaletteIcon className="h-4 w-4 text-apple-label2" /> Homepage accent</span>}>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_OPTIONS.map((option) => {
              const active = draftSettings.color_scheme === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setDraftSettings((current) => ({ ...current, color_scheme: option.value }))}
                  title={option.name}
                  aria-label={option.name}
                  aria-pressed={active}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${active ? 'ring-2 ring-white ring-offset-2 ring-offset-apple-bg2' : 'hover:scale-105'}`}
                >
                  <span className={`h-7 w-7 rounded-full ${option.swatch}`} />
                  {active && <CheckIcon className="absolute h-4 w-4 text-white drop-shadow" />}
                </button>
              )
            })}
          </div>
        </ListBlock>
      </ListGroup>
    </section>
  )
}

function LibraryPane({
  images,
  filteredImages,
  filter,
  setFilter,
  search,
  setSearch,
  selectedIds,
  previewImageId,
  highlightedIds,
  draftSettings,
  queue,
  uploadWarnings,
  uploading,
  dragActive,
  fileInputRef,
  className,
  onDrop,
  onDragOver,
  onDragLeave,
  onFilesSelected,
  onSelectAllFiltered,
  onClearSelection,
  onBulkAction,
  onBulkClearCache,
  onToggleFavourite,
  onPreviewImage,
  onToggleSelectedId,
  onSetSingleImage,
  onToggleRotation,
  onClearImageCache,
  onMoveRotationImage,
  onDeleteImage,
}: {
  images: Image[]
  filteredImages: Image[]
  filter: FilterMode
  setFilter: (value: FilterMode) => void
  search: string
  setSearch: (value: string) => void
  selectedIds: number[]
  previewImageId: number | null
  highlightedIds: number[]
  draftSettings: Settings
  queue: UploadQueueItem[]
  uploadWarnings: string[]
  uploading: boolean
  dragActive: boolean
  fileInputRef: RefObject<HTMLInputElement>
  className?: string
  onDrop: (event: DragEvent<HTMLDivElement>) => void | Promise<void>
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onFilesSelected: (files: FileList) => void
  onSelectAllFiltered: () => void
  onClearSelection: () => void
  onBulkAction: (action: BulkAction) => void
  onBulkClearCache: () => void
  onToggleFavourite: (imageId: number, isFavourite: boolean) => void
  onPreviewImage: (imageId: number) => void
  onToggleSelectedId: (imageId: number) => void
  onSetSingleImage: (imageId: number) => void
  onToggleRotation: (imageId: number, inRotation: boolean) => void
  onClearImageCache: (imageId: number) => void
  onMoveRotationImage: (imageId: number, direction: -1 | 1) => void
  onDeleteImage: (imageId: number) => void
}) {
  return (
    <section className={`space-y-5 ${className ?? ''}`}>
      <PaneHeader
        eyebrow="Library"
        title="Image Workspace"
        subtitle={`${images.length} image${images.length === 1 ? '' : 's'} ready for slideshow, preview, and cleanup.`}
      />

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`rounded-apple-lg border border-dashed p-4 transition ${dragActive ? 'border-apple-blue bg-apple-blue/10' : 'border-apple-sep bg-apple-bg2'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event) => { if (event.target.files) onFilesSelected(event.target.files) }}
          className="hidden"
        />
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-apple-bg3 text-apple-blue">
            <UploadIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold">Add images</p>
              {uploading && <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-apple-blue" />}
            </div>
            <p className="mt-1 text-[13px] text-apple-label2">Drop files here or add a batch from disk. Originals are preserved.</p>
          </div>
          <AppleButton size="sm" onClick={() => fileInputRef.current?.click()}>
            <PlusIcon className="h-4 w-4" /> Add
          </AppleButton>
        </div>

        {(queue.length > 0 || uploadWarnings.length > 0) && (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <ListGroup header="Queue">
              {queue.length === 0 ? (
                <div className="px-4 py-3 text-[13px] text-apple-label2">No files queued.</div>
              ) : (
                queue.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate text-[13px] text-apple-label">{item.name}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[12px] ${item.status === 'uploaded' ? 'text-apple-green' : item.status === 'failed' ? 'text-apple-red' : 'text-apple-label2'}`}>
                      {item.status === 'uploaded' && <CheckIcon className="h-3.5 w-3.5" />}
                      {item.status === 'failed' && <XIcon className="h-3.5 w-3.5" />}
                      {item.status === 'failed' ? item.detail ?? 'Failed' : item.status}
                    </span>
                  </div>
                ))
              )}
            </ListGroup>
            <ListGroup header="Duplicates">
              {uploadWarnings.length === 0 ? (
                <div className="px-4 py-3 text-[13px] text-apple-label2">No duplicates in the latest batch.</div>
              ) : (
                uploadWarnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2 px-4 py-2.5 text-[13px] text-apple-yellow">
                    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))
              )}
            </ListGroup>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-apple-lg bg-apple-bg2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-label2" />
            <input
              type="search"
              placeholder="Search filenames"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[10px] bg-apple-bg3 py-2 pl-9 pr-3 text-[15px] text-apple-label placeholder:text-apple-label2 focus:outline-none focus:ring-2 focus:ring-apple-blue/60"
            />
          </div>
          <button onClick={onSelectAllFiltered} className="text-[13px] font-medium text-apple-blue transition hover:opacity-70">Select filtered</button>
          {selectedIds.length > 0 && (
            <button onClick={onClearSelection} className="text-[13px] font-medium text-apple-blue transition hover:opacity-70">Clear</button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((option) => {
            const active = filter === option.value
            const Glyph = option.icon
            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${active ? 'bg-apple-blue text-white' : 'bg-apple-bg3 text-apple-label2 hover:text-apple-label'}`}
              >
                <Glyph className="h-3.5 w-3.5" />
                {option.label}
              </button>
            )
          })}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-apple bg-black/20 p-2">
            <span className="mx-1 text-[13px] font-medium text-apple-label2">{selectedIds.length} selected</span>
            <AppleButton variant="tinted" tone="gray" size="sm" onClick={() => onBulkAction('enable-rotation')}><RepeatIcon className="h-4 w-4" /> Add to slideshow</AppleButton>
            <AppleButton variant="tinted" tone="gray" size="sm" onClick={() => onBulkAction('disable-rotation')}><XIcon className="h-4 w-4" /> Remove from slideshow</AppleButton>
            <AppleButton variant="tinted" tone="gray" size="sm" onClick={() => onBulkAction('favourite')}><StarIcon className="h-4 w-4" /> Favourite</AppleButton>
            <AppleButton variant="tinted" tone="gray" size="sm" onClick={() => onBulkAction('unfavourite')}><StarIcon className="h-4 w-4" /> Unfavourite</AppleButton>
            <AppleButton variant="tinted" tone="gray" size="sm" onClick={onBulkClearCache}><SparklesIcon className="h-4 w-4" /> Clear cache</AppleButton>
            <AppleButton variant="tinted" tone="red" size="sm" onClick={() => onBulkAction('delete')}><TrashIcon className="h-4 w-4" /> Delete</AppleButton>
          </div>
        )}
      </div>

      {draftSettings.display_mode === 'rotation' && draftSettings.slideshow_enabled && draftSettings.slideshow_advance_mode === 'sequential' && (
        <p className="text-[13px] text-apple-label2">Sequential order uses the move controls on each slideshow-enabled card.</p>
      )}

      {filteredImages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-apple-lg bg-apple-bg2 p-12 text-center text-[14px] text-apple-label2">
          <ImageIcon className="h-8 w-8 text-apple-label3" />
          No images match the current filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {filteredImages.map((image) => (
            <ImageLibraryCard
              key={image.id}
              image={image}
              draftSettings={draftSettings}
              isSelected={selectedIds.includes(image.id)}
              isHighlighted={highlightedIds.includes(image.id)}
              isPreview={previewImageId === image.id}
              isSingleImage={draftSettings.single_image_id === image.id}
              isSingleMode={draftSettings.display_mode === 'single'}
              onToggleSelected={() => onToggleSelectedId(image.id)}
              onToggleFavourite={() => onToggleFavourite(image.id, image.favourite === 1)}
              onPreview={() => onPreviewImage(image.id)}
              onSetSingleImage={() => onSetSingleImage(image.id)}
              onToggleRotation={() => onToggleRotation(image.id, image.in_rotation === 1)}
              onClearCache={() => onClearImageCache(image.id)}
              onMoveUp={() => onMoveRotationImage(image.id, -1)}
              onMoveDown={() => onMoveRotationImage(image.id, 1)}
              onDelete={() => onDeleteImage(image.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ImageLibraryCard({
  image,
  draftSettings,
  isSelected,
  isHighlighted,
  isPreview,
  isSingleImage,
  isSingleMode,
  onToggleSelected,
  onToggleFavourite,
  onPreview,
  onSetSingleImage,
  onToggleRotation,
  onClearCache,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  image: Image
  draftSettings: Settings
  isSelected: boolean
  isHighlighted: boolean
  isPreview: boolean
  isSingleImage: boolean
  isSingleMode: boolean
  onToggleSelected: () => void
  onToggleFavourite: () => void
  onPreview: () => void
  onSetSingleImage: () => void
  onToggleRotation: () => void
  onClearCache: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const inRotation = image.in_rotation === 1
  const isFavourite = image.favourite === 1

  return (
    <article
      className={`group overflow-hidden rounded-apple-lg bg-apple-bg2 transition ${isSelected ? 'ring-2 ring-apple-blue' : isHighlighted ? 'ring-2 ring-apple-green/70' : 'ring-1 ring-apple-sep hover:ring-white/20'}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black">
        <img src={buildImageUrl(image, draftSettings)} alt={image.original_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <Badge>{image.width && image.height ? `${image.width}×${image.height}` : 'Unknown'}</Badge>
          {inRotation && <Badge><RepeatIcon className="h-3 w-3" /> Slideshow</Badge>}
          {isSingleImage && <Badge tone="blue"><MonitorIcon className="h-3 w-3" /> Single</Badge>}
        </div>
        <button
          type="button"
          onClick={onToggleSelected}
          className={`absolute right-2.5 top-2.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[12px] font-medium backdrop-blur transition ${isSelected ? 'bg-apple-blue text-white' : 'bg-black/45 text-white hover:bg-black/70'}`}
          aria-pressed={isSelected}
          title={isSelected ? 'Deselect image' : 'Select image'}
        >
          <CheckCircleIcon className="h-4 w-4" filled={isSelected} />
        </button>
        <button
          type="button"
          onClick={onPreview}
          className={`absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium backdrop-blur transition ${isPreview ? 'bg-apple-blue text-white' : 'bg-black/45 text-white hover:bg-black/70'}`}
        >
          <EyeIcon className="h-3.5 w-3.5" /> {isPreview ? 'Previewing' : 'Preview'}
        </button>
      </div>

      <div className="p-3.5">
        <h3 className="truncate text-[14px] font-semibold" title={image.original_name}>{image.original_name}</h3>
        <p className="mt-0.5 text-[12px] text-apple-label2">
          {formatBytes(image.file_size)} · {formatDate(image.upload_date)}
          {inRotation ? ` · order ${image.rotation_order ?? '—'}` : ''}
        </p>

        <div className="mt-3 flex items-center gap-0.5 border-t border-apple-sep pt-2.5">
          <CardAction icon={<StarIcon className="h-[18px] w-[18px]" filled={isFavourite} />} label={isFavourite ? 'Unfavourite' : 'Favourite'} active={isFavourite} onClick={onToggleFavourite} />
          {isSingleMode && (
            <CardAction
              icon={isSingleImage ? <CheckCircleIcon className="h-[18px] w-[18px]" filled /> : <PlusIcon className="h-[18px] w-[18px]" />}
              label={isSingleImage ? 'Selected for single image' : 'Use as single image'}
              active={isSingleImage}
              onClick={onSetSingleImage}
            />
          )}
          {!isSingleMode && (
            <CardAction icon={<RepeatIcon className="h-[18px] w-[18px]" />} label={inRotation ? 'Remove from slideshow' : 'Add to slideshow'} active={inRotation} onClick={onToggleRotation} />
          )}
          <CardAction icon={<SparklesIcon className="h-[18px] w-[18px]" />} label="Clear cached variants" onClick={onClearCache} />
          {draftSettings.display_mode === 'rotation' && draftSettings.slideshow_enabled && draftSettings.slideshow_advance_mode === 'sequential' && inRotation && (
            <>
              <CardAction icon={<ArrowUpIcon className="h-[18px] w-[18px]" />} label="Move up in order" onClick={onMoveUp} />
              <CardAction icon={<ArrowDownIcon className="h-[18px] w-[18px]" />} label="Move down in order" onClick={onMoveDown} />
            </>
          )}
          <span className="flex-1" />
          <CardAction icon={<TrashIcon className="h-[18px] w-[18px]" />} label="Delete image" danger onClick={onDelete} />
        </div>
      </div>
    </article>
  )
}

function PaneHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-apple-label3">{eyebrow}</p>
      <h2 className="mt-1 text-[22px] font-bold tracking-tight text-apple-label">{title}</h2>
      <p className="mt-1 text-[14px] text-apple-label2">{subtitle}</p>
    </div>
  )
}

function MetaPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-apple-lg bg-apple-bg2 px-4 py-3 shadow-sm shadow-black/10">
      <div className="flex items-center gap-2 text-[12px] text-apple-label2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-apple-label">{value}</div>
    </div>
  )
}

// A small browser-window mockup so the preview reads as the real homepage.
function BrowserPreview({
  image,
  rotationImages,
  settings,
  onDisplayedImageChange,
}: {
  image: Image
  rotationImages: Image[]
  settings: Settings
  onDisplayedImageChange: (imageId: number | null) => void
}) {
  const host = typeof window !== 'undefined' ? window.location.host : 'home'
  const [displayedImage, setDisplayedImage] = useState<Image>(image)
  const [shuffleQueue, setShuffleQueue] = useState<number[]>([])
  const gradientClass = COLOR_GRADIENTS[settings.color_scheme] || COLOR_GRADIENTS.teal

  useEffect(() => {
    onDisplayedImageChange(displayedImage.id)
  }, [displayedImage.id, onDisplayedImageChange])

  useEffect(() => {
    setDisplayedImage(image)
    setShuffleQueue([])
  }, [image.id, settings.display_mode, settings.single_image_id, settings.slideshow_enabled, settings.slideshow_advance_mode])

  useEffect(() => {
    if (settings.display_mode !== 'rotation' || !settings.slideshow_enabled || rotationImages.length <= 1) {
      setDisplayedImage(image)
      return
    }

    setDisplayedImage((current) => {
      if (rotationImages.some((entry) => entry.id === current.id)) return current
      return image
    })

    const multiplier = settings.slideshow_interval_unit === 'minutes' ? 60_000 : 1_000
    const intervalMs = Math.max(1, settings.slideshow_interval_value) * multiplier
    const timer = window.setInterval(() => {
      setDisplayedImage((previous) => {
        const next = getNextPreviewImage(previous, rotationImages, settings.slideshow_advance_mode, shuffleQueue)
        setShuffleQueue(next.nextQueue)
        return next.image ?? previous
      })
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [
    image,
    rotationImages,
    settings.display_mode,
    settings.slideshow_advance_mode,
    settings.slideshow_enabled,
    settings.slideshow_interval_unit,
    settings.slideshow_interval_value,
    shuffleQueue,
  ])

  const imageUrl = buildImageUrl(displayedImage, settings)
  // Match the homepage viewport: use the render target's aspect when set, else widescreen.
  const ratio = settings.render_enabled && settings.render_width && settings.render_height
    ? `${settings.render_width} / ${settings.render_height}`
    : '16 / 10'
  return (
    <div className="overflow-hidden rounded-apple-lg shadow-xl shadow-black/40 ring-1 ring-apple-sep">
      {/* Tab strip */}
      <div className="flex items-center gap-2 bg-[#2a2a2c] px-3 pt-2">
        <span className="flex gap-1.5 pb-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <div className="flex min-w-0 items-center gap-1.5 rounded-t-lg bg-[#3a3a3c] px-2.5 py-1.5 text-[10px] text-apple-label">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-gradient-to-b from-apple-blue to-[#0066d6]" />
          <span className="max-w-[130px] truncate">{settings.page_title || 'Home'}</span>
        </div>
      </div>
      {/* Toolbar / address bar */}
      <div className="flex items-center gap-2 bg-[#3a3a3c] px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-apple-label3">
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-black/30 px-2.5 py-1 text-[10px] text-apple-label2">
          <LockIcon className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{host}</span>
        </div>
        <span className="w-7 shrink-0" />
      </div>
      {/* Viewport — mirrors the real homepage (clean image + Admin button) */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${gradientClass}`} style={{ aspectRatio: ratio }}>
        <img
          src={imageUrl}
          alt={displayedImage.original_name}
          className="absolute inset-0 h-full w-full"
          style={{
            objectFit: settings.image_fit,
            objectPosition: renderPositionToObjectPosition(settings.render_position),
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur">
          <GearIcon className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}

function AppleButton({ children, onClick, variant = 'filled', tone = 'blue', size = 'md', disabled, type = 'button', className }: {
  children: ReactNode
  onClick?: () => void
  variant?: 'filled' | 'tinted' | 'plain'
  tone?: 'blue' | 'red' | 'gray' | 'green'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const tones: Record<string, Record<string, string>> = {
    blue: { filled: 'bg-apple-blue text-white hover:brightness-110', tinted: 'bg-apple-blue/15 text-apple-blue hover:bg-apple-blue/25', plain: 'text-apple-blue hover:opacity-70' },
    red: { filled: 'bg-apple-red text-white hover:brightness-110', tinted: 'bg-apple-red/15 text-apple-red hover:bg-apple-red/25', plain: 'text-apple-red hover:opacity-70' },
    gray: { filled: 'bg-apple-bg3 text-apple-label hover:brightness-110', tinted: 'bg-white/10 text-apple-label hover:bg-white/15', plain: 'text-apple-label2 hover:text-apple-label' },
    green: { filled: 'bg-apple-green text-white hover:brightness-110', tinted: 'bg-apple-green/15 text-apple-green hover:bg-apple-green/25', plain: 'text-apple-green hover:opacity-70' },
  }
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-[15px]'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-apple font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${sizes} ${tones[tone][variant]} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-apple-bg2 ${checked ? 'bg-apple-green' : 'bg-apple-bg3'}`}
    >
      <span className={`pointer-events-none inline-block h-[27px] w-[27px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-in-out ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
    </button>
  )
}

function Segmented<T extends string>({ options, value, onChange, full }: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  value: T
  onChange: (value: T) => void
  full?: boolean
}) {
  return (
    <div className={`inline-flex rounded-[10px] bg-black/25 p-[2px] ${full ? 'w-full' : ''}`}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition ${full ? 'flex-1' : ''} ${active ? 'bg-apple-bg3 text-apple-label shadow-sm' : 'text-apple-label2 hover:text-apple-label'}`}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function PopupSelect({ value, onChange, children, className }: {
  value: string | number
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative inline-flex items-center ${className ?? ''}`}>
      <select
        value={value}
        onChange={onChange}
        className={`w-full appearance-none rounded-lg bg-apple-bg3 py-1.5 pl-3 pr-8 text-[15px] text-apple-label focus:outline-none focus:ring-2 focus:ring-apple-blue/60`}
      >
        {children}
      </select>
      <ChevronUpDownIcon className="pointer-events-none absolute right-2 h-4 w-4 text-apple-label2" />
    </div>
  )
}

function ListGroup({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div>
      {header && <p className="mb-1.5 px-4 text-[12px] font-medium uppercase tracking-wide text-apple-label2">{header}</p>}
      <div className="overflow-hidden rounded-apple-lg bg-apple-bg2 shadow-sm shadow-black/10">
        <div className="divide-y divide-apple-sep">{children}</div>
      </div>
      {footer && <p className="mt-1.5 px-4 text-[12px] leading-snug text-apple-label2">{footer}</p>}
    </div>
  )
}

function ListRow({ icon, iconBg, title, subtitle, trailing, onClick, chevron, danger }: {
  icon?: ReactNode
  iconBg?: string
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  chevron?: boolean
  danger?: boolean
}) {
  const body = (
    <>
      {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${iconBg ?? 'bg-apple-gray'} text-white`}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className={`text-[15px] leading-tight ${danger ? 'text-apple-red' : 'text-apple-label'}`}>{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-apple-label2">{subtitle}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2 text-[15px] text-apple-label2">{trailing}</div>}
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-apple-label3" />}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04] active:bg-white/[0.06]">
        {body}
      </button>
    )
  }
  return <div className="flex min-h-[48px] items-center gap-3 px-4 py-2.5">{body}</div>
}

function ListBlock({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      {title && <div className="mb-2.5 text-[15px] text-apple-label">{title}</div>}
      {children}
    </div>
  )
}

function StatItem({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-apple-label3">{icon}</span>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold text-apple-label">{value}</div>
        <div className="text-[11px] text-apple-label2">{label}</div>
      </div>
    </div>
  )
}

function Badge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'blue' }) {
  const tones: Record<string, string> = {
    dark: 'bg-black/55 text-white',
    blue: 'bg-apple-blue/90 text-white',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm ${tones[tone]}`}>{children}</span>
}

function CardAction({ icon, label, onClick, active, danger }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  const tone = danger
    ? 'text-apple-label2 hover:bg-apple-red/15 hover:text-apple-red'
    : active
      ? 'bg-apple-blue/15 text-apple-blue'
      : 'text-apple-label2 hover:bg-white/10 hover:text-apple-label'
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={`group/ca relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${tone}`}>
      {icon}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-apple-bg3 px-2 py-1 text-[11px] text-apple-label shadow-lg group-hover/ca:block">
        {label}
      </span>
    </button>
  )
}

function AccountMenu({ cacheLabel, newPassword, setNewPassword, onSavePassword, onClearCache, onOpenHome, onSignOut }: {
  cacheLabel: string
  newPassword: string
  setNewPassword: (value: string) => void
  onSavePassword: () => void
  onClearCache: () => void
  onOpenHome: () => void
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'password'>('menu')
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setView('menu')
      return
    }
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account and settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-apple-label ${open ? 'bg-white/10 text-apple-label' : 'text-apple-label2'}`}
      >
        <GearIcon className={`h-5 w-5 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-apple-lg border border-apple-sep bg-apple-bg2/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {view === 'menu' ? (
            <div className="py-1.5">
              <MenuItem icon={<ExternalLinkIcon className="h-[18px] w-[18px]" />} label="Open homepage" onClick={() => { onOpenHome(); setOpen(false) }} />
              <MenuItem icon={<KeyIcon className="h-[18px] w-[18px]" />} label="Change password…" onClick={() => setView('password')} />
              <MenuItem icon={<SparklesIcon className="h-[18px] w-[18px]" />} label="Clear image cache" detail={cacheLabel} onClick={() => { setOpen(false); onClearCache() }} />
              <div className="my-1.5 h-px bg-apple-sep" />
              <MenuItem icon={<LogOutIcon className="h-[18px] w-[18px]" />} label="Sign out" danger onClick={() => { setOpen(false); onSignOut() }} />
            </div>
          ) : (
            <div className="p-3">
              <div className="mb-2 text-[13px] font-medium text-apple-label">Change password</div>
              <input
                type="password"
                autoFocus
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                className={`${fieldCls} w-full`}
                onKeyDown={(event) => { if (event.key === 'Enter' && newPassword.trim()) { onSavePassword(); setOpen(false) } }}
              />
              <div className="mt-2.5 flex justify-end gap-2">
                <AppleButton size="sm" variant="plain" tone="gray" onClick={() => setView('menu')}>Cancel</AppleButton>
                <AppleButton size="sm" disabled={!newPassword.trim()} onClick={() => { onSavePassword(); setOpen(false) }}>Save</AppleButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, detail, onClick, danger }: { icon: ReactNode; label: string; detail?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] transition hover:bg-white/[0.06] ${danger ? 'text-apple-red' : 'text-apple-label'}`}
    >
      <span className={danger ? 'text-apple-red' : 'text-apple-label2'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {detail && <span className="text-[12px] text-apple-label3">{detail}</span>}
    </button>
  )
}

export default AdminPage
