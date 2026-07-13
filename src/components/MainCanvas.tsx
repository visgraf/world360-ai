import { Suspense, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Image,
  MeshTransmissionMaterial,
  useFBO,
  useTexture,
} from '@react-three/drei'
import { motion } from 'motion/react'
import type { WheelEvent } from 'react'
import * as THREE from 'three'

const PROJECT_IMAGE_URLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  .split('')
  .map((letter) => `${import.meta.env.BASE_URL}projects/${letter}.png`)
const MOBIUS_ANGLE_OFFSET = THREE.MathUtils.degToRad(10)
const MOBIUS_ENDPOINT_TWIST_WIDTH = 0.16
const MOBIUS_CARD_LENGTH_RATIO = 0.88
const CARD_RADIUS = 0.1
const CARD_HOVER_RADIUS = 0.3
const CARD_SELECTED_RADIUS = 0.03
const CARD_HOVER_ZOOM = 1.25
const CARD_HOVER_SCALE = 1.025
const CARD_HOVER_DAMPING = 8
const SELECTION_DURATION = 0.65
const DESELECTION_DURATION = 0.45
const SELECTION_OFFSET_DAMPING = 3
const WHEEL_ROTATION_SENSITIVITY = 0.00045
const BASE_RIG_ROTATION_X = THREE.MathUtils.degToRad(8)
const BASE_RIG_ROTATION_Y = 0
const POINTER_ROTATION_X = THREE.MathUtils.degToRad(4)
const POINTER_ROTATION_Y = THREE.MathUtils.degToRad(6)
const POINTER_ROTATION_DAMPING = 3
const SELECTED_CARD_CAMERA_DISTANCE = 5
const SELECTED_CARD_LEFT_OFFSET = 0.2
const SELECTED_CARD_SIZE = 0.58
const FROSTED_GLASS_CAMERA_DISTANCE = SELECTED_CARD_CAMERA_DISTANCE + 0.35
const FROSTED_GLASS_CLOSED_SCALE = 0.01
const FROSTED_GLASS_OPEN_SCALE = 4
const FRONT_PHASE = 0.5
const CAROUSEL_LAYER = 0
const SELECTED_CARD_LAYER = 1
const FROSTED_GLASS_LAYER = 2

type NumericRef = MutableRefObject<number>
type SourcePositionsRef = MutableRefObject<Float32Array | null>
type SelectionPhase = 'idle' | 'selecting' | 'selected' | 'deselecting'
type SelectionPhaseRef = MutableRefObject<SelectionPhase>

type ImageMaterial = THREE.ShaderMaterial & {
  radius: number
  zoom: number
}

const textContainerVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
  show: {
    opacity: 1,
    height: 'auto',
    transition: { when: 'beforeChildren', staggerChildren: 0.06 },
  },
}

const textItemVariants = {
  hidden: { opacity: 0, y: '100%' },
  show: { opacity: 1, y: 0 },
}

type MobiusCardProps = {
  index: number
  texture: THREE.Texture
  coord: number
  length: number
  height: number
  displayOffsetRef: NumericRef
  selectedIndex: number | null
  onSelectCard: (index: number, mesh: THREE.Mesh, texture: THREE.Texture) => void
  onDeselect: () => void
}

function getShortestPhaseDelta(from: number, to: number) {
  return THREE.MathUtils.euclideanModulo(to - from + 0.5, 1) - 0.5
}

type RotationTextureState = {
  fullTurns: number
  crossedCount: number
}

function hasCrossedBackThreshold(slotIndex: number, crossedCount: number, count: number) {
  return crossedCount > 0 && slotIndex >= count - crossedCount
}

function getSlotProjectIndex(
  slotIndex: number,
  count: number,
  { fullTurns, crossedCount }: RotationTextureState,
) {
  const crossedOffset = hasCrossedBackThreshold(slotIndex, crossedCount, count)
    ? count
    : 0

  return THREE.MathUtils.euclideanModulo(
    fullTurns * count - slotIndex + crossedOffset,
    PROJECT_IMAGE_URLS.length,
  )
}

function getMobiusPoint(
  target: THREE.Vector3,
  coord: number,
  length: number,
  height: number,
  offset: number,
  u: number,
  v: number,
) {
  const circularCoord = coord + offset + (0.5 - u) * length
  const circularPhase = THREE.MathUtils.euclideanModulo(circularCoord, 1)
  const baseAngle = circularCoord * Math.PI * 2
  const angle = baseAngle + MOBIUS_ANGLE_OFFSET
  const amplitude = 0.3 + Math.cos(baseAngle) * 0.1
  const centerX = Math.sin(angle)
  const centerY = Math.sin(angle * 2) * amplitude
  const centerZ = -Math.cos(angle)
  const startTwist = 1 - THREE.MathUtils.smoothstep(
    circularPhase,
    0,
    MOBIUS_ENDPOINT_TWIST_WIDTH,
  )
  const endTwist = -THREE.MathUtils.smoothstep(
    circularPhase,
    1 - MOBIUS_ENDPOINT_TWIST_WIDTH,
    1,
  )
  const twist = (startTwist + endTwist) * Math.PI * 0.5
  const crossSectionOffset = (v - 0.5) * height
  const tangentX = Math.cos(angle)
  const tangentZ = Math.sin(angle)

  return target.set(
    centerX - tangentZ * Math.sin(twist) * crossSectionOffset,
    centerY + Math.cos(twist) * crossSectionOffset,
    centerZ + tangentX * Math.sin(twist) * crossSectionOffset,
  )
}

function MobiusCard({
  index,
  texture,
  coord,
  length,
  height,
  displayOffsetRef,
  selectedIndex,
  onSelectCard,
  onDeselect,
}: MobiusCardProps) {
  const imageRef = useRef<THREE.Mesh>(null)
  const point = useRef(new THREE.Vector3())
  const [hovered, setHovered] = useState(false)

  useFrame((_, delta) => {
    const image = imageRef.current

    if (image) {
      const activeHover = hovered && selectedIndex === null
      const geometry = image.geometry
      const position = geometry.attributes.position as THREE.BufferAttribute
      const uv = geometry.attributes.uv as THREE.BufferAttribute

      for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
        const u = uv.getX(vertexIndex)
        const v = uv.getY(vertexIndex)

        getMobiusPoint(
          point.current,
          coord,
          length,
          height,
          displayOffsetRef.current,
          u,
          v,
        )
        position.setXYZ(vertexIndex, point.current.x, point.current.y, point.current.z)
      }

      position.needsUpdate = true
      geometry.computeBoundingSphere()

      const material = image.material as ImageMaterial
      const scale = THREE.MathUtils.damp(
        image.scale.x,
        activeHover ? CARD_HOVER_SCALE : 1,
        CARD_HOVER_DAMPING,
        delta,
      )

      image.scale.setScalar(scale)
      material.radius = THREE.MathUtils.damp(
        material.radius,
        activeHover ? CARD_HOVER_RADIUS : CARD_RADIUS,
        CARD_HOVER_DAMPING,
        delta,
      )
      material.zoom = THREE.MathUtils.damp(
        material.zoom,
        activeHover ? CARD_HOVER_ZOOM : 1,
        CARD_HOVER_DAMPING,
        delta,
      )
    }
  })

  return (
    <Image
      ref={imageRef}
      texture={texture}
      scale={[1, 1]}
      radius={CARD_RADIUS}
      zoom={1}
      transparent
      side={THREE.DoubleSide}
      visible={selectedIndex !== index}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation()

        if (selectedIndex !== null) {
          onDeselect()
          return
        }

        if (hovered && imageRef.current) {
          onSelectCard(index, imageRef.current, texture)
        }
      }}>
      <planeGeometry args={[1, 1, 100, 10]} />
    </Image>
  )
}

type SelectedMobiusCardProps = {
  selectedIndex: number | null
  selectedSlotIndexRef: MutableRefObject<number | null>
  texture: THREE.Texture | null
  count: number
  displayOffsetRef: NumericRef
  selectionPhaseRef: SelectionPhaseRef
  selectionProgressRef: NumericRef
  sourcePositionsRef: SourcePositionsRef
  carouselRef: MutableRefObject<THREE.Group | null>
  onDeselect: () => void
}

function SelectedMobiusCard({
  selectedIndex,
  selectedSlotIndexRef,
  texture,
  count,
  displayOffsetRef,
  selectionPhaseRef,
  selectionProgressRef,
  sourcePositionsRef,
  carouselRef,
  onDeselect,
}: SelectedMobiusCardProps) {
  const imageRef = useRef<THREE.Mesh>(null)
  const cardLength = MOBIUS_CARD_LENGTH_RATIO / count
  const sourcePoint = useRef(new THREE.Vector3())
  const targetPoint = useRef(new THREE.Vector3())
  const anchorSourcePoint = useRef(new THREE.Vector3())
  const anchorTargetPoint = useRef(new THREE.Vector3())
  const selectedCardAnchorRef = useRef(new THREE.Vector3())
  const center = useRef(new THREE.Vector3())
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const up = useRef(new THREE.Vector3())

  useFrame((state) => {
    const image = imageRef.current
    const sourcePositions = sourcePositionsRef.current
    const selectedSlotIndex = selectedSlotIndexRef.current

    if (!image || selectedSlotIndex === null || !sourcePositions) {
      return
    }

    image.layers.set(SELECTED_CARD_LAYER)

    const geometry = image.geometry
    const position = geometry.attributes.position as THREE.BufferAttribute
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    const progress = THREE.MathUtils.smoothstep(selectionProgressRef.current, 0, 1)
    const viewport = state.viewport.getCurrentViewport(
      state.camera,
      center.current
        .copy(state.camera.position)
        .addScaledVector(
          state.camera.getWorldDirection(forward.current),
          SELECTED_CARD_CAMERA_DISTANCE,
        ),
    )

    const isTabletOrMobile = window.innerWidth <= 1100
    const isPortrait = viewport.height > viewport.width

    const cardSize = (isPortrait || isTabletOrMobile)
    ? Math.min(viewport.width * 0.75, viewport.height * 0.4) 
    : Math.min(viewport.height * SELECTED_CARD_SIZE, viewport.width * 0.45) 

    right.current.setFromMatrixColumn(state.camera.matrixWorld, 0).normalize()
    up.current.setFromMatrixColumn(state.camera.matrixWorld, 1).normalize()

    if (isPortrait || isTabletOrMobile) {
      center.current.addScaledVector(up.current, viewport.height * 0.15)
    } else {
      center.current.addScaledVector(right.current, -viewport.width * SELECTED_CARD_LEFT_OFFSET)
    }

    carouselRef.current?.updateWorldMatrix(true, false)

    if (selectionPhaseRef.current !== 'deselecting') {
      anchorSourcePoint.current.set(0, 0, 0)

      for (let sourceIndex = 0; sourceIndex < sourcePositions.length; sourceIndex += 3) {
        anchorSourcePoint.current.x += sourcePositions[sourceIndex]
        anchorSourcePoint.current.y += sourcePositions[sourceIndex + 1]
        anchorSourcePoint.current.z += sourcePositions[sourceIndex + 2]
      }

      anchorSourcePoint.current.multiplyScalar(3 / sourcePositions.length)
    } else {
        getMobiusPoint(
          anchorSourcePoint.current,
          selectedSlotIndex / count,
          cardLength,
        cardLength * Math.PI * 2,
        displayOffsetRef.current,
        0.5,
        0.5,
      )

      if (carouselRef.current) {
        anchorSourcePoint.current.applyMatrix4(carouselRef.current.matrixWorld)
      }
    }

    selectedCardAnchorRef.current
      .copy(anchorSourcePoint.current)
      .lerp(anchorTargetPoint.current.copy(center.current), progress)

    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
      const u = uv.getX(vertexIndex)
      const v = uv.getY(vertexIndex)

      if (selectionPhaseRef.current !== 'deselecting') {
        const sourceIndex = vertexIndex * 3

        sourcePoint.current.set(
          sourcePositions[sourceIndex],
          sourcePositions[sourceIndex + 1],
          sourcePositions[sourceIndex + 2],
        )
      } else {
        getMobiusPoint(
          sourcePoint.current,
          selectedSlotIndex / count,
          cardLength,
          cardLength * Math.PI * 2,
          displayOffsetRef.current,
          u,
          v,
        )

        if (carouselRef.current) {
          sourcePoint.current.applyMatrix4(carouselRef.current.matrixWorld)
        }
      }

      targetPoint.current
        .copy(center.current)
        .addScaledVector(right.current, (u - 0.5) * cardSize)
        .addScaledVector(up.current, (v - 0.5) * cardSize)

      sourcePoint.current.lerp(targetPoint.current, progress)
      position.setXYZ(
        vertexIndex,
        sourcePoint.current.x,
        sourcePoint.current.y,
        sourcePoint.current.z,
      )
    }

    position.needsUpdate = true
    geometry.computeBoundingSphere()

    const material = image.material as ImageMaterial
    const sourceRadius =
      selectionPhaseRef.current !== 'deselecting' ? CARD_HOVER_RADIUS : CARD_RADIUS
    const sourceZoom =
      selectionPhaseRef.current !== 'deselecting' ? CARD_HOVER_ZOOM : 1

    material.radius = THREE.MathUtils.lerp(
      sourceRadius,
      CARD_SELECTED_RADIUS,
      progress,
    )
    material.zoom = THREE.MathUtils.lerp(
      sourceZoom,
      1,
      progress,
    )
    material.depthTest = false
    material.depthWrite = false
  })

  return (
    <>
      <FrostedGlassLayer
        selectionProgressRef={selectionProgressRef}
        selectedCardAnchorRef={selectedCardAnchorRef}
      />
      {selectedIndex !== null && texture !== null && (
        <Image
          ref={imageRef}
          texture={texture}
          scale={[1, 1]}
          radius={CARD_HOVER_RADIUS}
          zoom={CARD_HOVER_ZOOM}
          transparent
          side={THREE.DoubleSide}
          renderOrder={10}
          onClick={(event) => {
            event.stopPropagation()
            onDeselect()
          }}>
          <planeGeometry args={[1, 1, 100, 10]} />
        </Image>
      )}
    </>
  )
}

type FrostedGlassLayerProps = {
  selectionProgressRef: NumericRef
  selectedCardAnchorRef: MutableRefObject<THREE.Vector3>
}

function FrostedGlassLayer({
  selectionProgressRef,
  selectedCardAnchorRef,
}: FrostedGlassLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const buffer = useFBO(512)
  const projectedAnchor = useRef(new THREE.Vector3())
  const center = useRef(new THREE.Vector3())
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const up = useRef(new THREE.Vector3())

  useFrame((state) => {
    const mesh = meshRef.current

    if (!mesh) {
      return
    }

    mesh.layers.set(FROSTED_GLASS_LAYER)

    const progress = THREE.MathUtils.smoothstep(selectionProgressRef.current, 0, 1)
    const visible = progress > 0.001

    mesh.visible = visible

    if (!visible) {
      return
    }

    center.current
      .copy(state.camera.position)
      .addScaledVector(
        state.camera.getWorldDirection(forward.current),
        FROSTED_GLASS_CAMERA_DISTANCE,
      )

    const viewport = state.viewport.getCurrentViewport(state.camera, center.current)
    const anchor = projectedAnchor.current
      .copy(selectedCardAnchorRef.current)
      .project(state.camera)

    right.current.setFromMatrixColumn(state.camera.matrixWorld, 0).normalize()
    up.current.setFromMatrixColumn(state.camera.matrixWorld, 1).normalize()
    center.current
      .addScaledVector(right.current, (anchor.x * viewport.width) / 2)
      .addScaledVector(up.current, (anchor.y * viewport.height) / 2)

    mesh.position.copy(center.current)
    mesh.quaternion.copy(state.camera.quaternion)
    mesh.scale.setScalar(
      THREE.MathUtils.lerp(
        FROSTED_GLASS_CLOSED_SCALE,
        FROSTED_GLASS_OPEN_SCALE,
        progress,
      ),
    )

    const previousRenderTarget = state.gl.getRenderTarget()
    const previousLayerMask = state.camera.layers.mask

    state.camera.layers.set(CAROUSEL_LAYER)
    state.gl.setRenderTarget(buffer)
    state.gl.render(state.scene, state.camera)
    state.gl.setRenderTarget(previousRenderTarget)
    state.camera.layers.mask = previousLayerMask
    state.camera.layers.enable(CAROUSEL_LAYER)
    state.camera.layers.enable(SELECTED_CARD_LAYER)
    state.camera.layers.enable(FROSTED_GLASS_LAYER)
  })

  return (
    <mesh ref={meshRef} renderOrder={5}>
      <circleGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        buffer={buffer.texture}
        color="#f5f5f5"
        samples={16}
        resolution={512}
        anisotropicBlur={0.1}
        thickness={0.1}
        roughness={0.4}
        toneMapped={false}
      />
    </mesh>
  )
}

type SelectedCardTextOverlayProps = {
  visible: boolean
}

function SelectedCardTextOverlay({ visible }: SelectedCardTextOverlayProps) {
  return (
    <aside
      className="selection-info ${visible ? 'is-visible' : ''}"
      aria-hidden={!visible}
    >
      <motion.ul
        className="selection-info-list"
        variants={textContainerVariants}
        initial="hidden"
        animate={visible ? 'show' : 'hidden'}
      >
        <li>
          <motion.div variants={textItemVariants}>
            <h2>WORLD 360 AI</h2>
          </motion.div>
        </li>
        <li>
          <motion.div variants={textItemVariants}>
            <h2>
              <span className="selection-accent">TEST</span>
            </h2>
          </motion.div>
        </li>
        <li>
          <motion.div variants={textItemVariants}>
            <h3>Selected Card</h3>
          </motion.div>
        </li>
        <li>
          <motion.div variants={textItemVariants}>
            <p className="selection-copy">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              posuere erat a ante venenatis dapibus posuere velit aliquet.
              Donec sed odio dui, sed posuere consectetur est at lobortis.
            </p>
            <br/>
          </motion.div>
        </li>
      </motion.ul>
    </aside>
  )
}

type MobiusCarouselProps = {
  count?: number
  selectedIndex: number | null
  carouselTargetRotationRef: NumericRef
  selectionPhaseRef: SelectionPhaseRef
  onSelectCard: (index: number) => void
  onDeselect: () => void
  onSelectionRest: () => void
}

function MobiusCarousel({
  count = 9,
  selectedIndex,
  carouselTargetRotationRef,
  selectionPhaseRef,
  onSelectCard,
  onDeselect,
  onSelectionRest,
}: MobiusCarouselProps) {
  const projectTextures = useTexture(PROJECT_IMAGE_URLS, (textures) => {
    for (const texture of textures as THREE.Texture[]) {
      texture.colorSpace = THREE.SRGBColorSpace
    }
  }) as THREE.Texture[]
  const parallaxRef = useRef<THREE.Group>(null)
  const carouselRef = useRef<THREE.Group>(null)
  const carouselRotationRef = useRef(0)
  const displayOffsetRef = useRef(0)
  const selectionProgressRef = useRef(0)
  const selectedSourcePositionsRef = useRef<Float32Array | null>(null)
  const selectedSlotIndexRef = useRef<number | null>(null)
  const rotationTextureStateRef = useRef<RotationTextureState>({
    fullTurns: 0,
    crossedCount: 0,
  })
  const [rotationTextureState, setRotationTextureState] =
    useState<RotationTextureState>({
      fullTurns: 0,
      crossedCount: 0,
    })
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [selectedTexture, setSelectedTexture] = useState<THREE.Texture | null>(null)

  const selectCard = (index: number, mesh: THREE.Mesh, texture: THREE.Texture) => {
    const position = mesh.geometry.attributes.position as THREE.BufferAttribute
    const sourcePositions = new Float32Array(position.count * 3)
    const point = new THREE.Vector3()

    mesh.updateWorldMatrix(true, false)

    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
      point.fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld)
      sourcePositions[vertexIndex * 3] = point.x
      sourcePositions[vertexIndex * 3 + 1] = point.y
      sourcePositions[vertexIndex * 3 + 2] = point.z
    }

    selectedSourcePositionsRef.current = sourcePositions
    selectedSlotIndexRef.current = index
    setSelectedSlotIndex(index)
    setSelectedTexture(texture)
    selectionProgressRef.current = 0
    onSelectCard(index)
  }

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()

    state.camera.layers.enable(CAROUSEL_LAYER)
    state.camera.layers.enable(SELECTED_CARD_LAYER)
    state.camera.layers.enable(FROSTED_GLASS_LAYER)

    if (carouselRef.current) {
      carouselRef.current.rotation.set(
        Math.cos(t / 4) / 16,
        Math.sin(t / 3) / 12,
        Math.sin(t / 2) / 24,
      )
      carouselRef.current.position.y = Math.cos(t / 2) / 12
    }

    if (parallaxRef.current) {
      const pointerRotationEnabled = selectedIndex === null
      const targetRotationX = pointerRotationEnabled
        ? BASE_RIG_ROTATION_X + state.pointer.y * POINTER_ROTATION_X
        : BASE_RIG_ROTATION_X
      const targetRotationY = pointerRotationEnabled
        ? BASE_RIG_ROTATION_Y - state.pointer.x * POINTER_ROTATION_Y
        : BASE_RIG_ROTATION_Y

      parallaxRef.current.rotation.x = THREE.MathUtils.damp(
        parallaxRef.current.rotation.x,
        targetRotationX,
        POINTER_ROTATION_DAMPING,
        delta,
      )
      parallaxRef.current.rotation.y = THREE.MathUtils.damp(
        parallaxRef.current.rotation.y,
        targetRotationY,
        POINTER_ROTATION_DAMPING,
        delta,
      )
    }

    if (
      selectedIndex !== null &&
      selectedSlotIndexRef.current !== null &&
      (selectionPhaseRef.current === 'selecting' ||
        selectionPhaseRef.current === 'selected')
    ) {
      const selectedMidCoord = selectedSlotIndexRef.current / count
      const targetOffset = FRONT_PHASE - selectedMidCoord

      carouselTargetRotationRef.current =
        carouselRotationRef.current +
        getShortestPhaseDelta(carouselRotationRef.current, targetOffset)
    }

    carouselRotationRef.current = THREE.MathUtils.damp(
      carouselRotationRef.current,
      carouselTargetRotationRef.current,
      SELECTION_OFFSET_DAMPING,
      delta,
    )

    const rotation = THREE.MathUtils.euclideanModulo(carouselRotationRef.current, 1)
    const nextTextureState = {
      fullTurns: Math.floor(carouselRotationRef.current),
      crossedCount: Math.floor(rotation * count),
    }

    displayOffsetRef.current = rotation

    if (
      nextTextureState.fullTurns !== rotationTextureStateRef.current.fullTurns ||
      nextTextureState.crossedCount !== rotationTextureStateRef.current.crossedCount
    ) {
      rotationTextureStateRef.current = nextTextureState
      setRotationTextureState(nextTextureState)
    }

    if (selectedIndex === null) {
      selectionProgressRef.current = 0
    } else if (selectionPhaseRef.current === 'selecting') {
      selectionProgressRef.current = Math.min(
        1,
        selectionProgressRef.current + delta / SELECTION_DURATION,
      )

      if (selectionProgressRef.current === 1) {
        selectionPhaseRef.current = 'selected'
      }
    } else if (selectionPhaseRef.current === 'selected') {
      selectionProgressRef.current = 1
    } else if (selectionPhaseRef.current === 'deselecting') {
      selectionProgressRef.current = Math.max(
        0,
        selectionProgressRef.current - delta / DESELECTION_DURATION,
      )

      if (selectionProgressRef.current === 0) {
        selectionPhaseRef.current = 'idle'
        selectedSourcePositionsRef.current = null
        selectedSlotIndexRef.current = null
        setSelectedSlotIndex(null)
        setSelectedTexture(null)
        onSelectionRest()
      }
    }

    state.events.update?.()
  })

  return (
    <>
      <group ref={parallaxRef}>
        <group ref={carouselRef}>
          {Array.from({ length: count }, (_, index) => {
            const cardLength = MOBIUS_CARD_LENGTH_RATIO / count

            return (
              <MobiusCard
                key={index}
                index={index}
                texture={projectTextures[
                  getSlotProjectIndex(index, count, rotationTextureState)
                ]}
                coord={index / count}
                length={cardLength}
                height={cardLength * Math.PI * 2}
                displayOffsetRef={displayOffsetRef}
                selectedIndex={selectedSlotIndex}
                onSelectCard={selectCard}
                onDeselect={onDeselect}
              />
            )
          })}
        </group>
      </group>
      <SelectedMobiusCard
        selectedIndex={selectedSlotIndex}
        selectedSlotIndexRef={selectedSlotIndexRef}
        texture={selectedTexture}
        count={count}
        displayOffsetRef={displayOffsetRef}
        selectionPhaseRef={selectionPhaseRef}
        selectionProgressRef={selectionProgressRef}
        sourcePositionsRef={selectedSourcePositionsRef}
        carouselRef={carouselRef}
        onDeselect={onDeselect}
      />
    </>
  )
}

export function MainCanvas() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectionTextVisible, setSelectionTextVisible] = useState(false)
  const selectionPhaseRef = useRef<SelectionPhase>('idle')
  const carouselTargetRotationRef = useRef(0)

  const selectCard = (index: number) => {
    selectionPhaseRef.current = 'selecting'
    setSelectionTextVisible(true)
    setSelectedIndex(index)
  }

  const deselectCard = () => {
    if (selectionPhaseRef.current !== 'idle') {
      selectionPhaseRef.current = 'deselecting'
      setSelectionTextVisible(false)
    }
  }

  const clearSelection = () => {
    selectionPhaseRef.current = 'idle'
    setSelectionTextVisible(false)
    setSelectedIndex(null)
  }

  const rotateCarousel = (event: WheelEvent<HTMLDivElement>) => {
    if (selectedIndex !== null) {
      return
    }
    event.preventDefault()
    carouselTargetRotationRef.current +=
      event.deltaY * WHEEL_ROTATION_SENSITIVITY
  }

  return (
    <>
      <Canvas
        className="main-canvas"
        camera={{ position: [0, 0, 10], fov: 10, near: 0.1, far: 50 }}
        onWheel={rotateCarousel}
        onPointerMissed={() => {
          if (selectedIndex !== null) {
            deselectCard()
          }
        }}
      >
        
        <color attach="background" args={["#667889"]} />
        <fog attach="fog" args={["#667889", 8.5, 12]} />
        <Suspense fallback={null}>
          <MobiusCarousel
            selectedIndex={selectedIndex}
            carouselTargetRotationRef={carouselTargetRotationRef}
            selectionPhaseRef={selectionPhaseRef}
            onSelectCard={selectCard}
            onDeselect={deselectCard}
            onSelectionRest={clearSelection}
          />
        </Suspense>
      </Canvas>
      <SelectedCardTextOverlay visible={selectionTextVisible} />
    </>
  )
}
