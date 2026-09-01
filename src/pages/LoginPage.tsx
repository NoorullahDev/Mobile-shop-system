import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { useSessionStore } from "../store/session";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, error } = useSessionStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      // error is set in the store
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#F4F6FA",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        padding: "24px",
      }}
    >
      {/* ── LOGIN CARD ── */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
          padding: "36px 32px 32px",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          {/* Icon */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "#1B2A4A",
              marginBottom: "14px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.3px",
              lineHeight: 1.3,
            }}
          >
            Mobile Shop Manager
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "#94A3B8",
              marginTop: "2px",
              letterSpacing: "0.01em",
            }}
          >
            Professional Retail Management
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background: "#E2E8F0",
            marginBottom: "24px",
          }}
        />

        {/* Welcome text */}
        <div style={{ marginBottom: "20px" }}>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#0F172A",
              margin: 0,
              letterSpacing: "-0.2px",
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#64748B",
              margin: "4px 0 0",
            }}
          >
            Sign in to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <Alert
              message={error}
              variant="error"
            />
          )}

          <Input
            name="username"
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            disabled={loading}
            required
          />

          <div className="relative">
            <Input
              name="password"
              label="Password"
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 flex h-5 w-5 items-center justify-center transition-colors"
              style={{
                bottom: "8px",
                color: "#94A3B8",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="mt-1 w-full"
            style={{
              background: "#1B2A4A",
              fontSize: "14px",
              height: "42px",
              borderRadius: "6px",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Footer note */}
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            fontSize: "12px",
            color: "#94A3B8",
          }}
        >
          Forgot your password?{" "}
          <span style={{ color: "#64748B" }}>Contact your administrator</span>
        </p>
      </div>

      {/* ── FOOTER INFO ── */}
      <div
        style={{
          marginTop: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "11px",
            color: "#94A3B8",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "#64748B",
            }}
          >
            <CheckCircle2
              style={{ width: "12px", height: "12px", color: "#16A34A" }}
            />
            License Activated
          </span>
          <span style={{ color: "#CBD5E1" }}>·</span>
          <span>Offline Desktop Application</span>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#CBD5E1",
          }}
        >
          Version 1.0
        </div>
      </div>
    </div>
  );
}
