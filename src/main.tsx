import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { seedIfEmpty } from '@/lib/seedData'
import App from './App'

// Seed IndexedDB on first load (no-op if data already exists)
seedIfEmpty()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
