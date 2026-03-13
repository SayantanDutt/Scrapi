import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ScrapePage from "./pages/ScrapePage";

function GuestRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <LoginPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <RegisterPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scrape"
                element={
                  <ProtectedRoute>
                    <ScrapePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
