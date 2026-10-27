import { Navigate, Route, Routes } from 'react-router'
import LoginPage from '../pages/Login/LoginPage.jsx'
import NotFoundPage from '../pages/NotFound/NotFoundPage.jsx'
import AppLayout from '../layouts/AppLayout.jsx'
import TrophiesPage from '../pages/Trophies/TrophiesPage.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={null} />
        <Route path="/perfil" element={null} />
        <Route path="/trofeus" element={<TrophiesPage />} />
        <Route path="/historico" element={null} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
