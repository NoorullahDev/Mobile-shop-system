import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  LogIn,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import bgImage from "../assets/login-bg.jpg";

function DefaultShopLogo() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto shrink-0 drop-shadow-sm"
    >
      <defs>
        <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00A3FF" />
          <stop offset="50%" stopColor="#0077FF" />
          <stop offset="100%" stopColor="#0055EE" />
        </linearGradient>
      </defs>

      {/* Back segment of orbit (behind phone) */}
      <path
        d="M 22 55 C 16 38 28 20 48 16 C 64 12 78 18 82 28"
        stroke="url(#orbitGrad)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Phone Silhouette */}
      <rect
        x="33"
        y="18"
        width="34"
        height="56"
        rx="8"
        fill="#FFFFFF"
        stroke="#0A2548"
        strokeWidth="4.5"
      />
      {/* Top Speaker Pill */}
      <rect x="44" y="23" width="12" height="2.5" rx="1.25" fill="#0A2548" />
      {/* Bottom Home Dot */}
      <circle cx="50" cy="67" r="2.5" fill="#0A2548" />

      {/* Front segment of orbit (sweeping across the front of the phone) */}
      <path
        d="M 82 28 C 86 38 78 52 64 63 C 48 74 27 77 16 70 C 8 64 12 52 24 48 C 36 44 54 39 74 32"
        stroke="url(#orbitGrad)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, error } = useSessionStore();
  const { businessName, logo, loaded, load } = useSettingsStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loaded) {
      load();
    }
  }, [loaded, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      // error is handled in store
    } finally {
      setLoading(false);
    }
  };

  const rawName = businessName?.trim() || "Galaxy Mobile Hub";
  const words = rawName.split(/\s+/);
  const firstWord = words[0] || "Galaxy";
  const restWords = words.slice(1).join(" ");

  return (
    <div
      className="flex min-h-screen w-full flex-col lg:flex-row overflow-x-hidden font-sans"
      style={{ backgroundColor: "#EEF4FB" }}
    >
      {/* Left Split: Exactly 50% */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-[#0A1A35] p-10 xl:p-14 text-white shrink-0">
        {/* Brightened full-height mobile shop showroom photo */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundPosition: "center 85%",
          }}
        />

        {/* Lighter, balanced overlay: keeps image bright and vibrant while ensuring text is sharp */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(8, 22, 46, 0.85) 0%, rgba(8, 22, 46, 0.78) 38%, rgba(6, 18, 38, 0.55) 68%, rgba(5, 14, 30, 0.35) 100%)",
          }}
        />

        {/* Foreground Content */}
        <div className="relative z-20 flex flex-col justify-between h-full">
          <div>
            {/* Brand Header */}
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center">
                <svg
                  width="44"
                  height="62"
                  viewBox="0 0 44 62"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0 drop-shadow-sm"
                >
                  <rect
                    x="2.5"
                    y="2.5"
                    width="39"
                    height="57"
                    rx="9"
                    stroke="white"
                    strokeWidth="4"
                  />
                  <rect x="15" y="7.5" width="14" height="2.5" rx="1.25" fill="white" />
                  <circle cx="22" cy="51" r="2.8" fill="white" />
                </svg>
              </div>
              <div>
                <div className="text-[32px] font-extrabold text-white tracking-tight leading-none drop-shadow-sm">
                  Mobile Shop
                </div>
                <div className="text-[32px] font-extrabold text-[#0066FF] tracking-tight leading-tight mt-1 drop-shadow-sm">
                  Manager
                </div>
              </div>
            </div>

            {/* Thin horizontal divider */}
            <div className="h-px w-full bg-white/15 my-6" />

            {/* Subtitle */}
            <div>
              <p className="text-[16px] font-normal text-slate-200 leading-relaxed">
                Complete Solution for
              </p>
              <p className="text-[16px] font-normal text-slate-200 leading-relaxed">
                Your Mobile Business
              </p>
            </div>

            {/* Feature List */}
            <div className="mt-8 space-y-6">
              {/* 1. Manage Inventory */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#132646]/85 border border-white/20 text-white shadow-lg backdrop-blur-sm">
                  <Package className="h-5 w-5 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[16px] font-bold text-white leading-tight">
                    Manage Inventory
                  </div>
                  <div className="text-[13px] text-slate-300 font-normal mt-0.5">
                    Phones & Accessories
                  </div>
                </div>
              </div>

              {/* 2. Easy Sales & Invoicing */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#132646]/85 border border-white/20 text-white shadow-lg backdrop-blur-sm">
                  <ShoppingCart className="h-5 w-5 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[16px] font-bold text-white leading-tight">
                    Easy Sales & Invoicing
                  </div>
                  <div className="text-[13px] text-slate-300 font-normal mt-0.5">
                    Fast and Simple
                  </div>
                </div>
              </div>

              {/* 3. Customer Management */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#132646]/85 border border-white/20 text-white shadow-lg backdrop-blur-sm">
                  <Users className="h-5 w-5 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[16px] font-bold text-white leading-tight">
                    Customer Management
                  </div>
                  <div className="text-[13px] text-slate-300 font-normal mt-0.5">
                    Track Customers & Dues
                  </div>
                </div>
              </div>

              {/* 4. Reports & Analytics */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#132646]/85 border border-white/20 text-white shadow-lg backdrop-blur-sm">
                  <BarChart3 className="h-5 w-5 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[16px] font-bold text-white leading-tight">
                    Reports & Analytics
                  </div>
                  <div className="text-[13px] text-slate-300 font-normal mt-0.5">
                    Grow Your Business
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Split: Exactly 50% */}
      <div
        className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-10 lg:p-12 overflow-y-auto"
        style={{ backgroundColor: "#EEF4FB" }}
      >
        <div
          className="w-full max-w-[520px] rounded-[28px] bg-white px-9 py-10 sm:px-12 sm:py-12 transition-all"
          style={{
            boxShadow:
              "0 20px 50px -10px rgba(15, 35, 65, 0.09), 0 6px 18px -4px rgba(15, 35, 65, 0.05)",
            border: "1px solid #E2EAF2",
          }}
        >
          {/* Dynamic Shop Logo from Settings */}
          {logo ? (
            <div className="flex justify-center mb-3">
              <img
                src={logo}
                alt={rawName}
                className="h-24 max-w-[200px] object-contain"
              />
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <DefaultShopLogo />
            </div>
          )}

          {/* Dynamic Shop Name from Settings */}
          <h2 className="text-[28px] sm:text-[32px] font-black tracking-tight text-center leading-tight">
            <span className="text-[#0F172A]">{firstWord}</span>
            {restWords ? <span className="text-[#0066FF]"> {restWords}</span> : null}
          </h2>

          {/* Welcome Header */}
          <div className="text-center my-6">
            <h1 className="text-[25px] sm:text-[27px] font-extrabold text-[#0F172A] tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-[15px] font-medium text-[#64748B]">
              Sign in to continue
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-[14px] text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <span className="leading-tight font-medium">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Username field */}
            <div>
              <label htmlFor="login-username" className="block text-[14px] font-bold text-[#1E293B] mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center h-[54px] w-full rounded-2xl border border-[#CBD5E1] focus-within:border-2 focus-within:border-[#3B82F6] focus-within:ring-4 focus-within:ring-[#3B82F6]/15 bg-white transition-all shadow-sm">
                <User className="h-[22px] w-[22px] text-[#64748B] ml-4 shrink-0" strokeWidth={1.8} />
                <input
                  type="text"
                  id="login-username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-transparent px-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none h-full font-medium"
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="login-password" className="block text-[14px] font-bold text-[#1E293B] mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center h-[54px] w-full rounded-2xl border border-[#CBD5E1] focus-within:border-2 focus-within:border-[#3B82F6] focus-within:ring-4 focus-within:ring-[#3B82F6]/15 bg-white transition-all shadow-sm">
                <Lock className="h-[22px] w-[22px] text-[#64748B] ml-4 shrink-0" strokeWidth={1.8} />
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent px-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none h-full pr-12 font-medium"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 flex h-7 w-7 items-center justify-center text-[#64748B] hover:text-[#1E293B] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.8} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[54px] rounded-2xl flex items-center justify-center gap-3 font-bold text-white transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-md hover:brightness-110"
              style={{
                backgroundColor: "#0A2958",
              }}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-[16px]">Signing In...</span>
                </div>
              ) : (
                <>
                  <LogIn className="h-5 w-5 text-white" strokeWidth={2.2} />
                  <span className="text-[16px] tracking-wide">Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer inside card */}
          <div className="w-full h-px bg-slate-200/70 my-7" />

          <p className="text-[13px] text-slate-500 text-center font-normal">
            Powered by{" "}
            <span className="font-bold text-[#0066FF]">EagleNest Creations</span>{" "}
            <span className="text-slate-500 font-medium">(0346-4451505)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
