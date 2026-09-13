import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Smartphone } from "lucide-react";
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
      className="flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{
        background: "#F1F5F9",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        className="w-full max-w-[460px] rounded-2xl border bg-white px-6 py-10 sm:px-10"
        style={{
          borderColor: "#DCE3EC",
          boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div className="text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl"
            style={{ background: "#1B315B" }}
          >
            <Smartphone className="h-7 w-7 text-white" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="mt-6 text-[22px] font-bold tracking-[-0.4px]" style={{ color: "#0F172A" }}>
            Mobile Shop Manager
          </div>
          <div className="mt-2 text-[14px]" style={{ color: "#94A3B8" }}>
            Professional Retail Management
          </div>
        </div>

        <div className="my-8 h-px" style={{ background: "#E2E8F0" }} />

        <div className="text-center">
          <h1 className="text-[24px] font-bold tracking-[-0.4px]" style={{ color: "#0F172A" }}>
            Welcome back
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: "#7C8CA5" }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          {error && <Alert message={error} variant="error" />}

          <Input
            name="username"
            label="Username"
            placeholder="Enter your username"
            className="!h-12 !rounded-[10px]"
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
              className="!h-12 !rounded-[10px] !pr-11"
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
                bottom: "14px",
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
            className="w-full"
            style={{
              background: "#1B315B",
              fontSize: "14px",
              height: "48px",
              borderRadius: "10px",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mb-0 mt-7 text-center text-[12px]" style={{ color: "#7C8CA5" }}>
          Powered by <span className="font-semibold" style={{ color: "#334155" }}>EagleNest Creations</span>{" "}
          (0346-4451505)
        </p>
      </div>
    </div>
  );
}
