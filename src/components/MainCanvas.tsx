import { useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image, ScrollControls, useScroll } from '@react-three/drei'
import * as THREE from 'three'

const CARD_IMAGE_URL = `${import.meta.env.BASE_URL}fluxus.png`

type ImageMaterial = THREE.ShaderMaterial & {
  radius: number
  zoom: number
}

type CardProps = {
  position: [number, number, number]
  rotation: [number, number, number]
}

function Rig({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)
  const scroll = useScroll()

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return
    }

    groupRef.current.rotation.y = -scroll.offset * Math.PI * 2
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

  return (
    <group ref={groupRef} rotation={[0, 0, 0.15]}>
      {children}
    </group>
  )
}

function Carousel({ count = 8, radius = 1.4 }) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const position: [number, number, number] = [
      Math.sin(angle) * radius,
      0,
      Math.cos(angle) * radius,
    ]
    const rotation: [number, number, number] = [0, Math.PI + angle, 0]

    return <Card key={index} position={position} rotation={rotation} />
  })
}

function Card({ position, rotation }: CardProps) {
  const groupRef = useRef<THREE.Group>(null)
  const imageRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((_state, delta) => {
    if (groupRef.current) {
      const targetScale = hovered ? 1.15 : 1

      groupRef.current.scale.setScalar(
        THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 10, delta),
      )
    }

    if (imageRef.current) {
      const material = imageRef.current.material as ImageMaterial

      material.radius = THREE.MathUtils.damp(
        material.radius,
        hovered ? 0.18 : 0.08,
        8,
        delta,
      )
      material.zoom = THREE.MathUtils.damp(
        material.zoom,
        hovered ? 1 : 1.35,
        8,
        delta,
      )
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <Image
        ref={imageRef}
        url={CARD_IMAGE_URL}
        scale={[1, 1]}
        transparent
        side={THREE.DoubleSide}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      />
    </group>
  )
}

export function MainCanvas() {
  return (
    <Canvas className="main-canvas" camera={{ position: [0, 0, 10], fov: 15 }}>
      <color attach="background" args={["#08111f"]} />
      <fog attach="fog" args={["#08111f", 8.5, 12]} />
      <ScrollControls
        pages={4}
        infinite
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <Rig>
          <Carousel />
        </Rig>
      </ScrollControls>
    </Canvas>
  )
}
