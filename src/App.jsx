import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageProvider';
import { ThemeProvider } from './context/ThemeProvider';
import { HomePage } from './pages/HomePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AddServicePage } from './pages/AddServicePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TermsPage } from './pages/TermsPage';
import { BackToTop } from './components/UI/BackToTop';

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminQueuePage = lazy(() => import('./pages/admin/AdminQueuePage').then((m) => ({ default: m.AdminQueuePage })));
const AdminServicesPage = lazy(() => import('./pages/admin/AdminServicesPage').then((m) => ({ default: m.AdminServicesPage })));

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/add-service" element={<AddServicePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin/login" element={<Suspense><AdminLoginPage /></Suspense>} />
            <Route path="/admin" element={<Suspense><AdminLayout /></Suspense>}>
              <Route index element={<AdminQueuePage />} />
              <Route path="services" element={<AdminServicesPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <BackToTop />
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
