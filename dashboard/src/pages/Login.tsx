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
        theme: "filled_blue",
        size: "large",
        text: "signin_with",
        width: 384,
      });
    }

    // GSI script may load after this component mounts
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-400 mb-2">
            HydraHouse
          </h1>
          <p className="text-slate-400 text-sm">
            Managed Hydra Head orchestration
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
          <div ref={googleButtonRef} className="flex justify-center" />

          {loading && (
            <p className="text-sm text-slate-400 text-center">Signing in...</p>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
