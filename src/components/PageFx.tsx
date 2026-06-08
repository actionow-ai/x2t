"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// 站点级页面动效：每次路由变化时，标题/卡片以错落 slam-in 入场（粗野主义节奏）。
export function PageFx({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".page-title", { y: 26, opacity: 0, duration: 0.55, ease: "power4.out", clearProps: "all" });
      gsap.from(".page-sub", { y: 12, opacity: 0, duration: 0.5, ease: "power3.out", delay: 0.08, clearProps: "all" });
      gsap.from(".post-card, .dir-card, .inf-header, .form, .empty", {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: "back.out(1.3)",
        stagger: 0.06,
        delay: 0.1,
        clearProps: "all",
      });
    },
    { scope, dependencies: [pathname], revertOnUpdate: true },
  );

  return <div ref={scope}>{children}</div>;
}
