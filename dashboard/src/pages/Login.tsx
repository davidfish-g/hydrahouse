import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { googleAuth } from "../api";

const GOOGLE_CLIENT_ID = "736208371429-6gungtfe3nrul24m2rqhm83ccv09i0jh.apps.googleusercontent.com";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function initGoogle() {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 384,
      });
    }

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  async function handleGoogleCallback(response: GoogleCredentialResponse) {
    setError("");
    setLoading(true);
    try {
      const result = await googleAuth(response.credential);
      login(result.email);
      navigate(searchParams.get("redirect") || "/heads", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left half */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-sm w-full mx-auto lg:mx-0">
          <div className="flex items-center gap-2.5 mb-12">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L28.66 9.5V24.5L16 32L3.34 24.5V9.5L16 2Z" fill="#0A6E5C" opacity="0.1" stroke="#0A6E5C" strokeWidth="1.5"/>
              <text x="16" y="21" textAnchor="middle" fill="#0A6E5C" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">H</text>
            </svg>
            <span className="text-base font-semibold text-gray-900 tracking-tight">HydraHouse</span>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to your account</p>

          <div ref={googleButtonRef} className="mb-4" />

          {loading && (
            <p className="text-sm text-gray-400 text-center">Signing in...</p>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </div>
      </div>

      {/* Right half */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-white to-primary-light items-center justify-center relative overflow-hidden">
        {/* Decorative pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex-pattern" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <path d="M30 0L60 15V37L30 52L0 37V15Z" fill="none" stroke="#0A6E5C" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-pattern)" />
        </svg>
        <div className="relative z-10 text-center px-12">
          <p className="text-3xl font-light text-gray-400 leading-relaxed">
            Managed Hydra Head
            <br />
            <span className="text-primary font-medium">Orchestration</span>
          </p>
        </div>
      </div>
    </div>
  );
}
