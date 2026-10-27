import { Navigate, Route, Routes } from 'react-router'
import LoginPage from '../pages/Login/LoginPage.jsx'
import NotFoundPage from '../pages/NotFound/NotFoundPage.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
