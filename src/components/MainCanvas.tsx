import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image, ScrollControls, useScroll } from '@react-three/drei'
import * as THREE from 'three'

const CARD_IMAGE_URL = `${import.meta.env.BASE_URL}temp_img.png`
const MOBIUS_ANGLE_OFFSET = THREE.MathUtils.degToRad(10)
const MOBIUS_ENDPOINT_TWIST_WIDTH = 0.16
const MOBIUS_CARD_LENGTH_RATIO = 0.88

type MobiusCardProps = {
  coord?: number
  length?: number
  height?: number
}

function MobiusCard({ coord = 0.0, length = 1.0, height = 0.5 }: MobiusCardProps) {
  const imageRef = useRef<THREE.Mesh>(null)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  void hovered

  useFrame(() => {
    if (imageRef.current) {
      const geometry = imageRef.current.geometry
      const position = geometry.attributes.position as THREE.BufferAttribute
      const uv = geometry.attributes.uv as THREE.BufferAttribute

      for (let index = 0; index < position.count; index += 1) {
        const u = uv.getX(index)
        const v = uv.getY(index)
        const circularCoord = coord + scroll.offset + u * length
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
        const x = centerX - tangentZ * Math.sin(twist) * crossSectionOffset
        const y = centerY + Math.cos(twist) * crossSectionOffset
        const z = centerZ + tangentX * Math.sin(twist) * crossSectionOffset

        position.setXYZ(index, x, y, z)
      }

      position.needsUpdate = true
      geometry.computeBoundingSphere()
    }
  })

  return (
    <Image
      ref={imageRef}
      url={CARD_IMAGE_URL}
      scale={[1, 1]}
      radius={0.08}
      transparent
      side={THREE.DoubleSide}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}>
      <planeGeometry args={[1, 1, 100, 10]} />
    </Image>
  )
}

function MobiusCarousel({ count = 8 }) {
  useFrame((state, delta) => {
    state.events.update?.()

    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x,
      -state.pointer.x * 2,
      3,
      delta,
    )
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      state.pointer.y + 1.5,
      3,
      delta,
    )
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      10,
      3,
      delta,
    )
    state.camera.lookAt(0, 0, 0)
  })

  return Array.from({ length: count }, (_, index) => {
    const cardLength = MOBIUS_CARD_LENGTH_RATIO / count

    return (
      <MobiusCard
        key={index}
        coord={index / count}
        length={cardLength}
        height={cardLength * Math.PI * 2}
      />
    )
  })
}

export function MainCanvas() {
  return (
    <Canvas
      className="main-canvas"
      camera={{ position: [0, 0, 10], fov: 10, near: 0.1, far: 50 }}
    >
      <color attach="background" args={["#08111f"]} />
      <fog attach="fog" args={["#08111f", 8.5, 12]} />
      <ScrollControls
        pages={4}
        infinite
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <MobiusCarousel />
      </ScrollControls>
    </Canvas>
  )
}
