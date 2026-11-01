import AppRoutes from './routes/AppRoutes.jsx'
import AuthProvider from './auth/AuthProvider.jsx'

function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>
}

export default App
