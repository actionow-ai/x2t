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
      // 用 fromTo（终态显式 opacity:1）而非 from：避免 React StrictMode 二次挂载把当前 0 读成目标值，导致卡片永久不可见。
      gsap.fromTo(".page-title", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power4.out", clearProps: "all" });
      gsap.fromTo(".page-sub", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 0.08, clearProps: "all" });
      const items = gsap.utils.toArray<HTMLElement>(".post-card, .dir-card, .inf-header, .form, .empty");
      if (items.length) {
        gsap.fromTo(
          items,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(1.3)",
            // 级联总时长封顶 0.5s：长列表(50-100 项)也能秒内全部出现，不再线性拖长。
            stagger: { amount: Math.min(0.5, items.length * 0.04) },
            delay: 0.1,
            clearProps: "all",
            // 兜底：动画若被中途打断（快速重挂载等），强制显形，绝不把内容藏死。
            onInterrupt: () => gsap.set(items, { opacity: 1, y: 0, clearProps: "all" }),
          },
        );
      }
    },
    { scope, dependencies: [pathname], revertOnUpdate: true },
  );

  return <div ref={scope}>{children}</div>;
}
