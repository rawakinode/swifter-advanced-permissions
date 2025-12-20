import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom";
import './index.css'
import App from './App.jsx'

// import wagmi config
import { config } from './wagmi';

// import rainbowkit
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme()} modalSize="compact">
        <BrowserRouter>

          <AuthProvider>
            <App />
          </AuthProvider>

        </BrowserRouter>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
)