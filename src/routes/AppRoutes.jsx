import { Navigate, Route, Routes } from 'react-router'
import LoginPage from '../pages/Login/LoginPage.jsx'
import RegisterPage from '../pages/Register/RegisterPage.jsx'
import NotFoundPage from '../pages/NotFound/NotFoundPage.jsx'
import AppLayout from '../layouts/AppLayout.jsx'
import TrophiesPage from '../pages/Trophies/TrophiesPage.jsx'
import HistoryPage from '../pages/History/HistoryPage.jsx'
import HomePage from '../pages/Home/HomePage.jsx'
import GroupsPage from '../pages/Groups/GroupsPage.jsx'
import RequireAuth from '../auth/RequireAuth.jsx'
import ProfilePage from '../pages/Profile/ProfilePage.jsx'
import InvitePage from '../pages/Invite/InvitePage.jsx'
import JoinGroupPage from '../pages/Invite/JoinGroupPage.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/trofeus" element={<TrophiesPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/grupos" element={<GroupsPage />} />
      </Route>
      <Route path="/entrar-grupo" element={<JoinGroupPage />} />
      <Route path="/cadastro/tag" element={<JoinGroupPage registration />} />
      </Route>
      <Route path="/convite" element={<InvitePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
