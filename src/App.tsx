import { motion } from 'motion/react'
import { Header } from './components/Header'
import { MainCanvas } from './components/MainCanvas'

export function App() {
  return (
    <>
      <Header />
      <motion.main
        className="canvas-shell"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
      >
        <MainCanvas />
      </motion.main>
    </>
  )
}
