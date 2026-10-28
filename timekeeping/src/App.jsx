import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import AppShellFrame from './app-shell.jsx';
import ChamCong from './pages/ChamCong.jsx';
import PrintPage from './pages/PrintPage.jsx';
import Users from './pages/Users.jsx';

function ShellLayout() {
  return (
    <AppShellFrame>
      <Routes>
        <Route path="/" element={<ChamCong />} />
        <Route path="/users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShellFrame>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Trang in đứng ngoài AppShell để window.print() chỉ in bảng công. */}
        <Route path="/print" element={<PrintPage />} />
        <Route path="*" element={<ShellLayout />} />
      </Routes>
    </HashRouter>
  );
}
