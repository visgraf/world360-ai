import { motion } from 'motion/react'
import { Header } from './components/Header'
import { MainCanvas } from './components/MainCanvas'

export function App() {
  return (
    <>
      <Header />
      <motion.main
        className="canvas-shell"
        style={{ flex: 1, position: 'relative' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
      >
      <MainCanvas />
      </motion.main>
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-copyright">
            &copy; {new Date().getFullYear()} World360-AI. All rights reserved.
          </div>
          <div className="footer-credits">
            Powered by <a href="https://visgraf.impa.br/" rel="noopener noreferrer">VISGRAF Lab</a> &amp; <a href="https://eyllo.com/" rel="noopener noreferrer">Eyllo Tech</a>
          </div>
        </div>
      </footer>
    </>
  )
}
