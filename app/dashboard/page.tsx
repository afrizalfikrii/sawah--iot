// app/dashboard/page.js
"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { ref, onValue, set } from "firebase/database";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Dashboard() {
  const router = useRouter();
  const [jarak, setJarak] = useState(0);
  const [status, setStatus] = useState("Memuat...");
  const [loading, setLoading] = useState(true);
  const [isManual, setIsManual] = useState(false);

  // 1. Cek Keamanan (Apakah User Login?)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/"); // Tendang ke Login kalau belum masuk
      } else {
        setLoading(false); // User valid, tampilkan konten
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Ambil Data Realtime dari Firebase
  useEffect(() => {
    if (loading) return;

    const jarakRef = ref(db, 'monitor/jarak');
    const statusRef = ref(db, 'monitor/status');
    const kontrolRef = ref(db, 'kontrol/paksa_usir');

    // Listener Jarak
    const unsubJarak = onValue(jarakRef, (snapshot) => {
      setJarak(snapshot.val() || 0);
    });

    // Listener Status
    const unsubStatus = onValue(statusRef, (snapshot) => {
      setStatus(snapshot.val() || "Offline");
    });

    // Listener Tombol Kontrol (Sync status tombol)
    const unsubKontrol = onValue(kontrolRef, (snapshot) => {
        setIsManual(snapshot.val() || false);
    });

    return () => {
        unsubJarak();
        unsubStatus();
        unsubKontrol();
    };
  }, [loading]);

  // 3. Fungsi Kontrol Manual
  const toggleSerangan = () => {
    const newState = !isManual;
    setIsManual(newState);
    set(ref(db, 'kontrol/paksa_usir'), newState);
  };

  // 4. Fungsi Logout
  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };

  if (loading) return <div className="p-10 text-center">Memeriksa Akses...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">🌾 Dashboard Sawah</h1>
            <button onClick={handleLogout} className="text-sm text-red-500 underline">Logout</button>
        </div>

        {/* Status Card */}
        <div className={`p-6 rounded-2xl shadow-lg transition-colors duration-300 ${
            status === "HAMA TERDETEKSI!" ? "bg-red-100 border-l-4 border-red-500" : "bg-white border-l-4 border-green-500"
        }`}>
            <p className="text-gray-500 text-sm uppercase font-bold">Status Keamanan</p>
            <h2 className={`text-3xl font-extrabold mt-2 ${
                status === "HAMA TERDETEKSI!" ? "text-red-600" : "text-green-600"
            }`}>
                {status}
            </h2>
            
            <div className="mt-6 flex justify-between items-center">
                <div className="text-center">
                    <p className="text-xs text-gray-400">Jarak Deteksi</p>
                    <p className="text-2xl font-bold text-gray-800">{jarak} cm</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-400">Buzzer</p>
                    <p className="text-xl font-bold">{status === "HAMA TERDETEKSI!" ? "🔊 ON" : "🔇 OFF"}</p>
                </div>
            </div>
        </div>

        {/* Control Panel */}
        <div className="mt-6 bg-white p-6 rounded-2xl shadow-lg">
            <h3 className="font-bold text-gray-700 mb-4">Remote Control</h3>
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border">
                <div>
                    <p className="font-semibold text-gray-800">Mode Serang Paksa</p>
                    <p className="text-xs text-gray-500">Nyalakan manual (Testing)</p>
                </div>
                <button 
                    onClick={toggleSerangan}
                    className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${isManual ? 'bg-red-500' : 'bg-gray-300'}`}
                >
                    <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${isManual ? 'translate-x-6' : ''}`}></div>
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}