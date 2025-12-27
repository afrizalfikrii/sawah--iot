"use client";

import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase"; 
import { ref, onValue, set } from "firebase/database";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
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
  Mail, 
  Lock, 
  Chrome,
  ZapOff // Ikon baru untuk alat mati
} from "lucide-react";

export default function Dashboard() {
  // --- STATE USER & AUTH ---
  // Menggunakan <any> agar tidak error TypeScript
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // State Login Manual
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- STATE IOT ---
  const [jarak, setJarak] = useState(0);
  const [status, setStatus] = useState("Menunggu Data...");
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // --- STATE BARU: DETEKSI ONLINE/OFFLINE ---
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  
  // ⭐ REF UNTUK TRACKING FIRST LOAD
  const isFirstLoadRef = useRef(true);
  const lastDataRef = useRef<{jarak: number, status: string} | null>(null);

  // 1. CEK STATUS LOGIN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      // Reset refs saat user berubah (login/logout)
      isFirstLoadRef.current = true;
      lastDataRef.current = null;
    });
    return () => unsubscribe();
  }, []);

  // 2. CEK DATA IOT & LOGIKA HEARTBEAT
  useEffect(() => {
    if (!user) return; 

    const monitorRef = ref(db, "monitor");
    const unsubscribeMonitor = onValue(monitorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const currentJarak = data.jarak || 0;
        const currentStatus = data.status || "AMAN";
        
        setJarak(currentJarak);
        setStatus(currentStatus);
        
        // ⭐ CEK APAKAH DATA BENAR-BENAR BERUBAH
        const isDataChanged = !lastDataRef.current || 
                              lastDataRef.current.jarak !== currentJarak || 
                              lastDataRef.current.status !== currentStatus;
        
        // CEK APAKAH ADA TIMESTAMP DARI ESP32
        if (data.timestamp) {
          // Jika ESP32 mengirim timestamp, gunakan itu
          const dataTimestamp = new Date(data.timestamp);
          setLastUpdate(dataTimestamp);
          
          // ⭐ CEK APAKAH DATA MASIH FRESH (< 10 detik)
          const now = new Date();
          const ageInSeconds = (now.getTime() - dataTimestamp.getTime()) / 1000;
          
          if (ageInSeconds <= 10) {
            console.log("✅ Data FRESH dari ESP32:", dataTimestamp.toLocaleTimeString(), `(${ageInSeconds.toFixed(1)}s yang lalu)`);
            setIsDeviceOnline(true);
            lastDataRef.current = {jarak: currentJarak, status: currentStatus};
          } else {
            console.log("⚠️ Data BASI dari Firebase:", dataTimestamp.toLocaleTimeString(), `(${ageInSeconds.toFixed(1)}s yang lalu) - DEVICE OFFLINE`);
            setIsDeviceOnline(false);
          }
        } else {
          // Fallback: Gunakan waktu sekarang (kurang akurat)
          const now = new Date();
          setLastUpdate(now);
          
          // ⭐ STRATEGI BARU: CEK APAKAH DATA BERUBAH
          if (isFirstLoadRef.current) {
            // First load setelah refresh
            console.log("📍 First load - Data dari Firebase (bisa jadi stale)");
            console.log(`   Jarak: ${currentJarak}, Status: ${currentStatus}`);
            setIsDeviceOnline(false); // Mulai dari offline
            isFirstLoadRef.current = false;
            lastDataRef.current = {jarak: currentJarak, status: currentStatus};
          } else if (isDataChanged) {
            // Data berubah = ada update baru dari ESP32
            console.log("✅ DATA BERUBAH - ESP32 mengirim update baru!");
            console.log(`   Sebelum: ${lastDataRef.current?.jarak}cm, ${lastDataRef.current?.status}`);
            console.log(`   Sekarang: ${currentJarak}cm, ${currentStatus}`);
            setIsDeviceOnline(true);
            lastDataRef.current = {jarak: currentJarak, status: currentStatus};
          } else {
            // Data sama = Firebase re-emit data yang sama (ignore)
            console.log("⚠️ Data sama dengan sebelumnya - Firebase re-emit (IGNORE)");
            // Jangan ubah status online/offline
          }
        }
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

  // 3. TIMER PENGECEKAN (Cek setiap detik: Apakah alat masih hidup?)
  useEffect(() => {
    // Jalankan pengecekan setiap 1 detik
    const interval = setInterval(() => {
      if (lastUpdate) {
        const now = new Date();
        const diffInSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;

        // DEBUG: Log untuk melihat selisih waktu
        console.log(`[Heartbeat] Selisih waktu: ${diffInSeconds.toFixed(1)} detik`);

        // JIKA LEBIH DARI 10 DETIK TIDAK ADA KABAR, VONIS OFFLINE
        if (diffInSeconds > 10) {
          console.log("⚠️ DEVICE OFFLINE - Tidak ada data lebih dari 10 detik");
          setIsDeviceOnline(false);
        } else {
          setIsDeviceOnline(true);
        }
      } else {
        console.log("[Heartbeat] Menunggu data pertama...");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);


  // --- FUNGSI-FUNGSI ---
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setLoginError("Google Login Gagal: " + error.message);
    }
  };

  const handleManualLogin = async (e: any) => {
    e.preventDefault();
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') setLoginError("Email/Password salah!");
      else setLoginError("Login Gagal.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setJarak(0);
  };

  const toggleManualMode = () => {
    const newValue = !isManual;
    set(ref(db, "kontrol/paksa_usir"), newValue);
  };

  // --- LOGIKA VISUAL ---
  // Tentukan warna berdasarkan kondisi: OFFLINE -> BAHAYA -> AMAN
  let cardColorClass = "bg-slate-700 border-slate-600"; // Default (Netral)
  let statusText = "MENUNGGU...";
  let statusIcon = <Activity className="w-10 h-10 text-slate-400" />;
  let mainTextColor = "text-slate-400";

  if (!isDeviceOnline && !loading) {
    // KONDISI ALAT MATI
    cardColorClass = "bg-slate-800/80 border-slate-600 grayscale opacity-70";
    statusText = "ALAT OFFLINE";
    statusIcon = <ZapOff className="w-10 h-10 text-gray-500" />;
    mainTextColor = "text-gray-500";
  } else if (status.includes("HAMA") || isManual) {
    // KONDISI BAHAYA
    cardColorClass = "bg-red-500/10 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]";
    statusText = "BAHAYA / AKTIF";
    statusIcon = <AlertTriangle className="w-10 h-10 text-red-500 animate-bounce" />;
    mainTextColor = "text-red-500";
  } else {
    // KONDISI AMAN
    cardColorClass = "bg-green-500/10 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]";
    statusText = "AMAN";
    statusIcon = <ShieldCheck className="w-10 h-10 text-green-400" />;
    mainTextColor = "text-green-400";
  }
  
  const timeString = lastUpdate 
    ? lastUpdate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : "--:--:--";

  // --- RENDER HALAMAN ---

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-green-500">Loading...</div>;

  // HALAMAN LOGIN
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl w-full max-w-sm z-10 relative">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20 mb-3">
              <Sprout className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">AgroShield</h1>
            <p className="text-slate-400 text-sm">Masuk untuk memantau</p>
          </div>
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm" required />
            </div>
            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all">Masuk (Manual)</button>
          </form>
          {loginError && <div className="mt-3 text-red-400 text-xs text-center">{loginError}</div>}
          <div className="flex items-center gap-3 my-6"><div className="h-[1px] bg-slate-700 flex-1"></div><span className="text-slate-500 text-xs">ATAU</span><div className="h-[1px] bg-slate-700 flex-1"></div></div>
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-100"><Chrome className="w-4 h-4 text-blue-500" /> Lanjut dengan Google</button>
        </div>
      </main>
    );
  }

  // HALAMAN DASHBOARD
  return (
    <main className="min-h-screen bg-slate-900 text-white font-sans selection:bg-green-500 selection:text-white pb-10">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-green-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6 md:p-10">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 backdrop-blur-sm">
              <Sprout className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">AgroShield IoT</h1>
              <p className="text-slate-400 text-sm">Halo, {user.displayName || user.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-colors duration-500 ${isDeviceOnline ? "bg-green-500/10 border-green-500/20" : "bg-gray-800/50 border-gray-700"}`}>
              {isDeviceOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-gray-500" />}
              <span className={`text-xs font-mono font-bold ${isDeviceOnline ? "text-green-400" : "text-gray-500"}`}>
                {isDeviceOnline ? "DEVICE ONLINE" : "DEVICE OFFLINE"}
              </span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full border border-red-500/20 text-sm font-medium"><LogOut className="w-4 h-4" /> Keluar</button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. KARTU STATUS */}
          <div className={`col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl p-8 border transition-all duration-500 ${cardColorClass}`}>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <h2 className="text-slate-400 text-sm uppercase tracking-widest font-semibold mb-2">Status Alat</h2>
                <div className="flex items-center gap-3">
                  {statusIcon}
                  <span className={`text-4xl md:text-5xl font-bold tracking-tight ${mainTextColor}`}>
                    {statusText}
                  </span>
                </div>
                <p className="mt-4 text-slate-300 max-w-lg text-sm leading-relaxed">
                  {!isDeviceOnline 
                    ? "Alat tidak mengirim data lebih dari 10 detik. Cek koneksi internet atau kabel power ESP32."
                    : (status.includes("HAMA") || isManual)
                      ? "Sistem pengusir aktif! Servo dan Buzzer sedang bekerja mengusir hama."
                      : "Sistem standby memantau area persawahan. Tidak ada pergerakan hama."}
                </p>
              </div>
            </div>
          </div>

          {/* 2. KARTU JARAK */}
          <div className={`bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 flex flex-col justify-between transition-opacity ${!isDeviceOnline ? "opacity-50" : "opacity-100"}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl"><Activity className="w-6 h-6 text-blue-400" /></div>
              <span className="text-xs text-slate-500 font-mono">Realtime Sensor</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white tracking-tighter">{jarak}</span>
                <span className="text-xl text-slate-400">cm</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full mt-4 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min((jarak / 200) * 100, 100)}%` }}></div>
              </div>
              <p className="text-xs text-slate-400 mt-3 text-right">Terakhir update: {timeString}</p>
            </div>
          </div>

          {/* 3. KONTROL MANUAL */}
          <div className={`bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 flex flex-col justify-between ${!isDeviceOnline ? "pointer-events-none opacity-50" : ""}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl transition-colors ${isManual ? "bg-orange-500/20" : "bg-slate-700"}`}>
                <Power className={`w-6 h-6 ${isManual ? "text-orange-500" : "text-slate-400"}`} />
              </div>
              <span className="text-xs text-slate-500 font-mono">Control Panel</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Override System</h3>
              <p className="text-xs text-slate-400 mb-6">Tombol tidak berfungsi jika alat offline.</p>
              <button onClick={toggleManualMode} className={`w-full py-4 rounded-xl font-bold text-sm tracking-wider shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${isManual ? "bg-gradient-to-r from-orange-600 to-red-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-300"}`}>
                {isManual ? <>MATIKAN PAKSA <Activity className="w-4 h-4 animate-spin" /></> : "AKTIFKAN (PAKSA)"}
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