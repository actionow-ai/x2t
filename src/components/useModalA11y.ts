"use client";

import { useEffect, useRef } from "react";

// 模态可访问性:打开时移焦进模态、Tab 焦点陷阱、Esc 关闭、关闭后还焦到触发元素。
// 配合 role="dialog" aria-modal,挡住"aria-modal 宣称背景不可达、键盘却仍能 Tab 进背景"的硬伤(UX a11y #1)。
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useModalA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = () => (node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    (focusables()[0] ?? node)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key === "Tab" && node) {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open]);

  return ref;
}
