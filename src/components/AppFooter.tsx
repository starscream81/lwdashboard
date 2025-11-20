"use client";

export default function AppFooter() {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="mt-10 py-8 text-center text-xs text-slate-500 border-t border-slate-800">
      <p className="text-slate-400 font-medium tracking-wide">
        Last War Command Center
      </p>

      <div className="mt-3 flex flex-col items-center gap-2 text-slate-500">
        {/* GDPR / Privacy Policy */}
        <a
          href="/privacy"
          className="hover:text-slate-300 transition-colors"
        >
          GDPR / Privacy Policy
        </a>

        {/* Back to Top */}
        <button
          onClick={scrollToTop}
          className="hover:text-slate-300 transition-colors"
        >
          Back to top ↑
        </button>
      </div>

      <p className="mt-4 text-slate-500">
        Made with <span className="text-red-400">❤</span>. If you find this helpful,
        <a
          href="https://paypal.me/KMahana"
          target="_blank"
          className="text-sky-400 hover:text-sky-300 ml-1 transition-colors"
        >
          🍺 buy me a beer 🍺
        </a>
        .
      </p>
    </footer>
  );
}
