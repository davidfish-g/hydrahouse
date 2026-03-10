import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import HeadsList from "./pages/HeadsList";
import HeadDetail from "./pages/HeadDetail";
import Billing from "./pages/Billing";
import ApiKeys from "./pages/ApiKeys";
import QuickStart from "./pages/docs/QuickStart";
import Concepts from "./pages/docs/Concepts";
import SdkGuide from "./pages/docs/SdkGuide";
import ApiReference from "./pages/docs/ApiReference";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const redirect = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return children;
}

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/heads" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="heads" element={<HeadsList />} />
            <Route path="keys" element={<ApiKeys />} />
            <Route path="billing" element={<Billing />} />
            <Route path="heads/:id" element={<HeadDetail />} />
            <Route path="docs" element={<QuickStart />} />
            <Route path="docs/quick-start" element={<QuickStart />} />
            <Route path="docs/concepts" element={<Concepts />} />
            <Route path="docs/sdk" element={<SdkGuide />} />
            <Route path="docs/api" element={<ApiReference />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
