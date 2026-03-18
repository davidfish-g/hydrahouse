import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  googleAuth,
  passkeyLoginBegin,
  passkeyLoginComplete,
  passkeySignupBegin,
  passkeySignupComplete,
  bufferToBase64url,
  base64urlToBuffer,
} from "../api";

const GOOGLE_CLIENT_ID =
  "736208371429-6gungtfe3nrul24m2rqhm83ccv09i0jh.apps.googleusercontent.com";

/** Wrap a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/heads";

  useEffect(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(setPasskeyAvailable)
        .catch(() => {});
    }
  }, []);

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

  const finishLogin = useCallback(
    (identifier: string, displayName?: string) => {
      login(identifier, displayName);
      navigate(redirectTo, { replace: true });
    },
    [login, navigate, redirectTo],
  );

  async function handleGoogleCallback(response: GoogleCredentialResponse) {
    setError("");
    setLoading(true);
    setLoadingMethod("google");
    try {
      const result = await googleAuth(response.credential);
      finishLogin(result.email, result.username || result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
      setLoadingMethod(null);
    }
  }

  async function handlePasskeyLogin() {
    setError("");
    setLoading(true);
    setLoadingMethod("passkey");
    try {
      const { challenge_id, options } = await withTimeout(
        passkeyLoginBegin(),
        10_000,
        "Server request",
      );
      const pk = options.publicKey;

      const credential = (await withTimeout(
        navigator.credentials.get({
          publicKey: {
            challenge: base64urlToBuffer(pk.challenge),
            rpId: pk.rpId,
            timeout: 60_000,
            userVerification: (pk.userVerification || "preferred") as UserVerificationRequirement,
            allowCredentials: (pk.allowCredentials || []).map((c: any) => ({
              type: c.type,
              id: base64urlToBuffer(c.id),
            })),
          },
        }),
        65_000,
        "Passkey authentication",
      )) as PublicKeyCredential | null;

      if (!credential) throw new Error("Passkey authentication was cancelled");

      const resp = credential.response as AuthenticatorAssertionResponse;
      const result = await withTimeout(
        passkeyLoginComplete({
          challenge_id,
          raw_id: bufferToBase64url(credential.rawId),
          client_data_json: bufferToBase64url(resp.clientDataJSON),
          authenticator_data: bufferToBase64url(resp.authenticatorData),
          signature: bufferToBase64url(resp.signature),
        }),
        10_000,
        "Server verification",
      );

      finishLogin(result.email || result.account_id, result.username || result.email || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Passkey sign-in failed";
      if (msg.includes("NotAllowedError") || msg.includes("cancelled"))
        setError("Passkey authentication was cancelled");
      else if (msg.includes("not configured"))
        setError("Passkey sign-in is not enabled on this server");
      else if (msg.includes("SecurityError"))
        setError("Passkey domain mismatch — check server configuration");
      else
        setError(msg);
    } finally {
      setLoading(false);
      setLoadingMethod(null);
    }
  }

  async function handlePasskeySignup() {
    setError("");
    setLoading(true);
    setLoadingMethod("passkey-signup");
    try {
      const { challenge_id, options } = await withTimeout(
        passkeySignupBegin(),
        10_000,
        "Server request",
      );

      const pk = (options as any).publicKey;
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          ...pk,
          challenge: base64urlToBuffer(pk.challenge),
          user: { ...pk.user, id: base64urlToBuffer(pk.user.id) },
          excludeCredentials: (pk.excludeCredentials || []).map((c: any) => ({
            ...c,
            id: base64urlToBuffer(c.id),
          })),
        },
      };

      const credential = await withTimeout(
        navigator.credentials.create(createOptions) as Promise<PublicKeyCredential | null>,
        65_000,
        "Passkey creation",
      );

      if (!credential) throw new Error("Passkey creation was cancelled");

      const result = await withTimeout(
        passkeySignupComplete({
          challenge_id,
          credential,
          name: `Passkey ${new Date().toLocaleDateString()}`,
        }),
        10_000,
        "Server verification",
      );

      finishLogin(result.email || result.account_id, result.username || result.email || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Passkey signup failed";
      if (msg.includes("NotAllowedError") || msg.includes("cancelled"))
        setError("Passkey creation was cancelled");
      else
        setError(msg);
    } finally {
      setLoading(false);
      setLoadingMethod(null);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left half */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-sm w-full mx-auto lg:mx-0">
          <div className="flex items-center gap-2.5 mb-12">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#0A6E5C" opacity="0.08" />
              <line x1="16" y1="26" x2="16" y2="15" stroke="#0A6E5C" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M16 15 C14 12 10.5 10 8 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none" />
              <line x1="16" y1="15" x2="16" y2="6.5" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 15 C18 12 21.5 10 24 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none" />
              <circle cx="8" cy="8" r="2.5" fill="#10B981" />
              <circle cx="16" cy="6.5" r="2.5" fill="#10B981" />
              <circle cx="24" cy="8" r="2.5" fill="#10B981" />
            </svg>
            <span className="text-base font-semibold text-gray-900 tracking-tight">HydraHouse</span>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to HydraHouse</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in or create an account</p>

          {/* Google */}
          <div ref={googleButtonRef} className="mb-4" />

          {passkeyAvailable && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* Passkey */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  {loadingMethod === "passkey" ? "Authenticating..." : "Sign in with Passkey"}
                </button>
                <button
                  onClick={handlePasskeySignup}
                  disabled={loading}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Create a new account with a passkey"
                >
                  {loadingMethod === "passkey-signup" ? "..." : "New"}
                </button>
              </div>
            </>
          )}

          {loading && loadingMethod === "google" && (
            <p className="text-sm text-gray-400 text-center mt-4">Signing in...</p>
          )}

          {error && <p className="text-sm text-red-600 text-center mt-4">{error}</p>}
        </div>
      </div>

      {/* Right half */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-white to-primary-light items-center justify-center relative overflow-hidden">
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
