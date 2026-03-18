import { useState, useEffect, useCallback, useRef } from "react";
import {
  listAuthMethods,
  unlinkPasskey,
  unlinkGoogle,
  linkGoogle,
  passkeyRegisterBegin,
  passkeyRegisterComplete,
  getAccount,
  updateUsername,
  deleteAccount,
  type AuthMethods,
  type AccountInfo,
} from "../api";
import { useAuth } from "../auth";

const GOOGLE_CLIENT_ID =
  "736208371429-6gungtfe3nrul24m2rqhm83ccv09i0jh.apps.googleusercontent.com";

export default function Account() {
  const { displayName, setDisplayName, logout } = useAuth();
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const googleLinkButtonRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [m, acct] = await Promise.all([listAuthMethods(), getAccount()]);
      setMethods(m);
      setAccountInfo(acct);
      setUsername(acct.username || acct.email || "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load auth methods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const totalMethods = (methods?.google ? 1 : 0) + (methods?.passkeys.length || 0);

  // Render Google sign-in button when no Google account is linked
  useEffect(() => {
    if (methods?.google || !googleLinkButtonRef.current) return;
    const gid = (window as any).google?.accounts?.id;
    if (!gid) return;
    gid.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: GoogleCredentialResponse) => {
        setActionLoading("link-google");
        try {
          await linkGoogle(response.credential);
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to link Google");
        } finally {
          setActionLoading(null);
        }
      },
    });
    gid.renderButton(googleLinkButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      width: 320,
    });
  }, [methods?.google, refresh]);

  async function handleAddPasskey() {
    setError("");
    setActionLoading("add-passkey");
    try {
      const { challenge_id, options } = await passkeyRegisterBegin();

      // The options come from webauthn-rs and need to be transformed for the browser API
      const publicKey = options as any;
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          ...publicKey.publicKey,
          challenge: base64urlToArrayBuffer(publicKey.publicKey.challenge),
          user: {
            ...publicKey.publicKey.user,
            id: base64urlToArrayBuffer(publicKey.publicKey.user.id),
          },
          excludeCredentials: (publicKey.publicKey.excludeCredentials || []).map((c: any) => ({
            ...c,
            id: base64urlToArrayBuffer(c.id),
          })),
        },
      };

      const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential | null;
      if (!credential) {
        setActionLoading(null);
        return;
      }

      const name = `Passkey ${new Date().toLocaleDateString()}`;
      await passkeyRegisterComplete({ challenge_id, credential, name });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register passkey");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnlinkPasskey(id: string) {
    if (!confirm("Remove this passkey from your account?")) return;
    setActionLoading(`unlink-passkey-${id}`);
    try {
      await unlinkPasskey(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove passkey");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnlinkGoogle() {
    if (!confirm("Disconnect Google from your account?")) return;
    setActionLoading("unlink-google");
    try {
      await unlinkGoogle();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink Google");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Account</h1>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  async function handleSaveUsername() {
    if (!username.trim()) return;
    setActionLoading("username");
    try {
      await updateUsername(username.trim());
      setDisplayName(username.trim());
      setEditingUsername(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update username");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteAccount() {
    setError("");
    setActionLoading("delete-account");
    try {
      await deleteAccount();
      logout();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Account</h1>

      {/* Display name */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Display Name</h2>
        {editingUsername ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
            />
            <button
              onClick={handleSaveUsername}
              disabled={actionLoading === "username"}
              className="px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {actionLoading === "username" ? "..." : "Save"}
            </button>
            <button
              onClick={() => setEditingUsername(false)}
              className="px-3 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-900">{displayName || username || "Not set"}</span>
            <button
              onClick={() => setEditingUsername(true)}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              Edit
            </button>
          </div>
        )}
      </section>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Authentication Methods</h2>
      <p className="text-gray-500 text-sm mb-6">
        Manage how you sign in to your account. You must always have at least one method linked.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Google */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Google</h2>
        {methods?.google ? (
          <div className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">G</span>
              <div>
                <p className="text-sm text-gray-900">{methods.google.email}</p>
                <p className="text-xs text-gray-400">Google account</p>
              </div>
            </div>
            <button
              onClick={handleUnlinkGoogle}
              disabled={totalMethods <= 1 || actionLoading !== null}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {actionLoading === "unlink-google" ? "Removing..." : "Remove"}
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 border border-dashed border-gray-200 rounded-lg">
            <div ref={googleLinkButtonRef} />
          </div>
        )}
      </section>

      {/* Passkeys */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-700">Passkeys</h2>
          <button
            onClick={handleAddPasskey}
            disabled={actionLoading !== null}
            className="text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50"
          >
            {actionLoading === "add-passkey" ? "Adding..." : "+ Add Passkey"}
          </button>
        </div>
        {methods?.passkeys && methods.passkeys.length > 0 ? (
          <div className="space-y-2">
            {methods.passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm text-gray-900">{pk.name}</p>
                    <p className="text-xs text-gray-400">Added {new Date(pk.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnlinkPasskey(pk.id)}
                  disabled={totalMethods <= 1 || actionLoading !== null}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {actionLoading === `unlink-passkey-${pk.id}` ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 px-4 py-3 border border-dashed border-gray-200 rounded-lg">
            No passkeys registered
          </p>
        )}
      </section>

      {/* Danger Zone */}
      <section className="mt-12 border border-red-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-red-700 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!showDeleteDialog ? (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            {accountInfo && accountInfo.balance_cents > 0 && (
              <p className="text-sm text-red-600 font-medium">
                You will forfeit your remaining balance of ${(accountInfo.balance_cents / 100).toFixed(2)}.
              </p>
            )}
            <p className="text-sm text-gray-600">
              Type <span className="font-mono font-semibold">delete</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="delete"
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "delete" || actionLoading === "delete-account"}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "delete-account" ? "Deleting..." : "Permanently Delete Account"}
              </button>
              <button
                onClick={() => { setShowDeleteDialog(false); setDeleteConfirm(""); }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
