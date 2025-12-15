"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase"; 
import { ref, onValue, set } from "firebase/database";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, // <--- Import fungsi login manual
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  Sprout, 
  AlertTriangle, 
  ShieldCheck, 
  Power,
  LogOut,
  Mail, // Ikon baru
  Lock, // Ikon baru
  Chrome // Ikon Google (pengganti visual)
} from "lucide-react";

export default function Dashboard() {
  // --- STATE USER & AUTH ---
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // State untuk Form Login Manual
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- STATE IOT ---
  const [jarak, setJarak] = useState(0);
  const [status, setStatus] = useState("Menunggu Data...");
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 1. CEK STATUS LOGIN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. CEK DATA IOT
  useEffect(() => {
    if (!user) return; 

    setLastUpdate(new Date()); 

    const monitorRef = ref(db, "monitor");
    const unsubscribeMonitor = onValue(monitorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJarak(data.jarak || 0);
        setStatus(data.status || "AMAN");
        setLastUpdate(new Date());
      }
      setLoading(false);
    });

    const controlRef = ref(db, "kontrol/paksa_usir");
    const unsubscribeControl = onValue(controlRef, (snapshot) => {
      setIsManual(snapshot.val() === true);
    });

    return () => {
      unsubscribeMonitor();
      unsubscribeControl();
    };
  }, [user]);

  // --- FUNGSI LOGIN GOOGLE ---
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoginError("Google Login Gagal: " + error.message);
    }
  };

  // --- FUNGSI LOGIN MANUAL (EMAIL/PASS) ---
  const handleManualLogin = async (e) => {
    e.preventDefault(); // Mencegah reload halaman
    setLoginError(""); // Reset error
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Jika sukses, user otomatis ter-set lewat useEffect
    } catch (error) {
      console.error("Login Manual Error:", error);
      // Pesan error yang user-friendly
      if (error.code === 'auth/invalid-credential') {
        setLoginError("Email atau Password salah!");
      } else if (error.code === 'auth/invalid-email') {
        setLoginError("Format email tidak valid!");
      } else {
        setLoginError("Login Gagal. Cek koneksi atau akun.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setJarak(0); // Reset data saat logout
      setStatus("Menunggu Data...");
    } catch (error) {
      console.error("Logout Gagal:", error);
    }
  };

  const toggleManualMode = () => {
    const newValue = !isManual;
    set(ref(db, "kontrol/paksa_usir"), newValue);
  };

  // --- HELPER VISUAL ---
  const isDanger = status.includes("HAMA") || isManual;
  const signalColor = loading ? "text-gray-400" : "text-green-400";
  
  const timeString = lastUpdate 
    ? lastUpdate.toLocaleTimeString("id-ID", {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : "--:--:--";

  // --- TAMPILAN LOADING AWAL ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // --- TAMPILAN HALAMAN LOGIN (DUA OPSI) ---
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background Effects */}
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-green-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]"></div>

        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl w-full max-w-sm z-10 relative">
          
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20 mb-3">
              <Sprout className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">SawahGuard</h1>
            <p className="text-slate-400 text-sm">Masuk untuk memantau</p>
          </div>

          {/* Form Login Manual */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            
            {/* Input Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="email" 
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
                required
              />
            </div>

            {/* Input Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
                required
              />
            </div>

            {/* Tombol Login Manual */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/20 active:scale-95 text-sm"
            >
              Login
            </button>
          </form>

          {/* Pesan Error */}
          {loginError && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
              {loginError}
            </div>
          )}

          {/* Divider "ATAU" */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-[1px] bg-slate-700 flex-1"></div>
            <span className="text-slate-500 text-xs font-mono">ATAU</span>
            <div className="h-[1px] bg-slate-700 flex-1"></div>
          </div>

          {/* Tombol Login Google */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-2.5 rounded-xl hover:bg-gray-100 transition-transform active:scale-95 shadow-lg text-sm"
          >
            <Chrome className="w-4 h-4 text-blue-500" />
            Lanjut dengan Google
          </button>
        </div>
      </main>
    );
  }

  // --- TAMPILAN DASHBOARD (Sama seperti sebelumnya) ---
  return (
    <main className="min-h-screen bg-slate-900 text-white font-sans selection:bg-green-500 selection:text-white pb-10">
      {/* Background Gradient Effect */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-green-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6 md:p-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 backdrop-blur-sm">
              <Sprout className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
                SawahGuard IoT
              </h1>
              <p className="text-slate-400 text-sm">
                Halo, {user.displayName || user.email || "Petani"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700 backdrop-blur-sm">
              {loading ? (
                <WifiOff className="w-4 h-4 text-gray-500 animate-pulse" />
              ) : (
                <Wifi className={`w-4 h-4 ${signalColor}`} />
              )}
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                {loading ? "OFFLINE" : "LIVE"}
              </span>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full border border-red-500/20 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </header>

        {/* UTAMA GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. KARTU STATUS */}
          <div className={`col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl p-8 border transition-all duration-500 ${
            isDanger 
              ? "bg-red-500/10 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]" 
              : "bg-green-500/10 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]"
          }`}>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <h2 className="text-slate-400 text-sm uppercase tracking-widest font-semibold mb-2">Status Keamanan</h2>
                <div className="flex items-center gap-3">
                  {isDanger ? (
                    <AlertTriangle className="w-10 h-10 text-red-500 animate-bounce" />
                  ) : (
                    <ShieldCheck className="w-10 h-10 text-green-400" />
                  )}
                  <span className={`text-4xl md:text-5xl font-bold tracking-tight ${isDanger ? "text-red-500" : "text-green-400"}`}>
                    {loading ? "--" : (isDanger ? "BAHAYA!" : "AMAN")}
                  </span>
                </div>
                <p className="mt-4 text-slate-300 max-w-lg text-sm leading-relaxed">
                  {isDanger 
                    ? "Hama terdeteksi atau mode manual aktif! Sistem pengusir (Servo & Buzzer) sedang bekerja." 
                    : "Tidak ada aktivitas mencurigakan. Sistem standby memantau area persawahan."}
                </p>
              </div>
              
              <div className="hidden md:block">
                 <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${
                   isDanger ? "border-red-500/30 animate-ping" : "border-green-500/20"
                 }`}>
                   <div className={`w-12 h-12 rounded-full ${isDanger ? "bg-red-500" : "bg-green-500"}`}></div>
                 </div>
              </div>
            </div>
          </div>

          {/* 2. KARTU SENSOR JARAK */}
          <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 flex flex-col justify-between group hover:border-blue-500/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-xs text-slate-500 font-mono">Realtime Sensor</span>
            </div>
            
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white tracking-tighter">
                  {jarak}
                </span>
                <span className="text-xl text-slate-400">cm</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min((jarak / 200) * 100, 100)}%` }} 
                ></div>
              </div>
              <p className="text-xs text-slate-400 mt-3 text-right">Updated: {timeString}</p>
            </div>
          </div>

          {/* 3. KARTU KONTROL MANUAL */}
          <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl transition-colors ${isManual ? "bg-orange-500/20" : "bg-slate-700"}`}>
                <Power className={`w-6 h-6 ${isManual ? "text-orange-500" : "text-slate-400"}`} />
              </div>
              <span className="text-xs text-slate-500 font-mono">Control Panel</span>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Override System</h3>
              <p className="text-xs text-slate-400 mb-6">
                Aktifkan paksa servo & buzzer tanpa menunggu sensor.
              </p>
              
              <button
                onClick={toggleManualMode}
                className={`w-full py-4 rounded-xl font-bold text-sm tracking-wider shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-3
                  ${isManual 
                    ? "bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-orange-900/20 hover:shadow-orange-900/40 ring-2 ring-orange-500/50" 
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  }`}
              >
                {isManual ? (
                  <>MATIKAN ALAT <Activity className="w-4 h-4 animate-spin" /></>
                ) : (
                  "AKTIFKAN (PAKSA)"
                )}
              </button>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <footer className="mt-12 text-center border-t border-slate-800 pt-6">
          <p className="text-slate-600 text-xs font-mono">
            Connected to: <span className="text-slate-500">sawah-iot-default-rtdb</span> | v1.1.0
          </p>
        </footer>
      </div>
    </main>
  );
}