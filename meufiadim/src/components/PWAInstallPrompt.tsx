"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, PlusSquare, Sparkles, Check } from "lucide-react";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Verifica se ja esta rodando como PWA instalado (Standalone)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Captura evento nativo do Android / Chrome
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Exibe apos 1.5s na primeira visita
      const dismissed = localStorage.getItem("meufiadim_pwa_dismissed");
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 1500);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // No iOS, se nao estiver instalado e primeira visita, exibe apos 2s
    if (isIosDevice && !isStandaloneMode) {
      const dismissed = localStorage.getItem("meufiadim_pwa_dismissed");
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Se nao tiver prompt nativo disponivel no momento
      alert("Para instalar, toque no menu do seu navegador (três pontinhos) e selecione 'Adicionar à tela inicial'.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    // Cooldown de 24h
    localStorage.setItem("meufiadim_pwa_dismissed", Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Bottom Sheet com Física Spring estilo Flutter */}
      <AnimatePresence>
        {showPrompt && (
          <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end p-3 sm:p-5">
            {/* Backdrop sutil */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDismiss}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto"
            />

            {/* Card Mobile Principal */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{
                type: "spring",
                damping: 24,
                stiffness: 300,
                mass: 0.8,
              }}
              className="relative w-full max-w-md mx-auto bg-white/95 backdrop-blur-2xl rounded-[32px] p-5 sm:p-6 border border-emerald-100 shadow-2xl pointer-events-auto overflow-hidden ring-1 ring-black/5"
            >
              {/* Barra superior de puxar (Drag Handle estilo iOS/Flutter) */}
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-200 to-emerald-400 p-0.5 shadow-md flex items-center justify-center">
                      <div className="w-full h-full bg-white rounded-[14px] overflow-hidden flex items-center justify-center p-1">
                        <img
                          src="/logo.png"
                          alt="meufiadim app"
                          className="w-full h-full object-contain scale-110"
                        />
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-0.5 rounded-full ring-2 ring-white">
                      <Check className="w-3 h-3 font-bold" />
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        App Oficial
                      </span>
                      <span className="text-xs text-slate-400 font-medium">• 100% Grátis</span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug">
                      Instalar o app Meu Fiadim
                    </h4>
                    <p className="text-xs text-slate-500">
                      Acesso instantâneo direto na sua tela inicial
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDismiss}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Destaques rápidos */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-semibold bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600">⚡</span> Super rápido e leve
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600">🔔</span> Alertas no WhatsApp
                </div>
              </div>

              {/* Guia especial para iPhone / Safari */}
              {showIOSGuide ? (
                <div className="mt-4 p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-2">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <Share className="w-4 h-4 text-amber-700" /> Como instalar no iPhone:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px] leading-relaxed">
                    <li>Toque no botão <strong>Compartilhar</strong> (ícone do meio no rodapé do Safari).</li>
                    <li>Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.</li>
                    <li>Toque em <strong>"Adicionar"</strong> no canto superior direito.</li>
                  </ol>
                </div>
              ) : (
                <div className="mt-5 flex gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleInstallClick}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-3.5 px-4 rounded-2xl font-extrabold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar Aplicativo</span>
                  </motion.button>

                  <button
                    onClick={handleDismiss}
                    className="px-4 py-3.5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
                  >
                    Agora não
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
