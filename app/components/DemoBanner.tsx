"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DemoBanner() {
  const [demoSiteId, setDemoSiteId] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/market_fit_demo_site_id=([^;]+)/);
    const isManual = localStorage.getItem('market_fit_manual_demo') === 'true';
    if (match && isManual) {
      setDemoSiteId(match[1]);
    }
  }, []);

  if (!demoSiteId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link 
        href="/demo" 
        className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-300 shadow-sm transition-colors flex items-center gap-2"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        Demo
      </Link>
    </div>
  );
}
