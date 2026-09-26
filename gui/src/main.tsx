import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { ColorModeProvider } from './components/ui/color-mode'
import './index.css'
import { PlayerProvider } from './context/PlayerContext.tsx'
import { App } from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      {/* ⚡️ Wrap your application */}
      <ColorModeProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </ColorModeProvider>
    </ChakraProvider>
  </StrictMode>,
)