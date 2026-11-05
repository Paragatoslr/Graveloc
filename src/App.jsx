import { Navigate, Route, Routes } from "react-router-dom";
import { AdminShell } from "./components/AdminShell";
import { FamilyShell } from "./components/FamilyShell";
import { useApp } from "./data/store";
import { AccessPage } from "./pages/AccessPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminMapPage } from "./pages/AdminMapPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { ActivityHistoryPage } from "./pages/ActivityHistoryPage";
import { MapBuilderPage, MapPreviewPage } from "./pages/MapBuilderPage";
import { MapBuilderRedirect, MapPreviewRedirect } from "./pages/MapGalleryPage";
import { MapGalleryPage } from "./pages/MapGalleryPage";
import { TrashBinPage } from "./pages/TrashBinPage";
import { MapPage } from "./pages/MapPage";
import { MemorialPage } from "./pages/MemorialPage";
import { NavigatePage } from "./pages/NavigatePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { RecordNewPage } from "./pages/RecordNewPage";
import { RecordsPage } from "./pages/RecordsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StaffPage } from "./pages/StaffPage";

function RequireAdmin() {
  const { currentStaff } = useApp();
  if (!currentStaff) return <Navigate to="/admin/login" replace />;
  return <AdminShell />;
}

export function App() {
  return (
    <Routes>
      <Route element={<FamilyShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/access" element={<AccessPage />} />
        <Route path="/memorial/:id" element={<MemorialPage />} />
        <Route path="/map/:id" element={<MapPage />} />
        <Route path="/navigate/:id" element={<NavigatePage />} />
      </Route>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="records/new" element={<RecordNewPage />} />
        <Route path="records/:id" element={<RecordDetailPage />} />
        <Route path="map/gallery" element={<MapGalleryPage />} />
        <Route path="map/builder" element={<MapBuilderRedirect />} />
        <Route path="map/builder/:mapId" element={<MapBuilderPage />} />
        <Route path="map/preview/:mapId" element={<MapPreviewPage />} />
        <Route path="map/preview" element={<MapPreviewRedirect />} />
        <Route path="map/trash" element={<TrashBinPage />} />
        <Route path="activity" element={<ActivityHistoryPage />} />
        <Route path="map" element={<AdminMapPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
