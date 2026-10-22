"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

let actionDepth = 0;
let patched = false;
const listeners = new Set<(busy: boolean) => void>();

function notifyAction() {
  listeners.forEach((listener) => listener(actionDepth > 0));
}

function releaseBusyButtons() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>("[data-app-busy]").forEach((button) => {
    button.disabled = false;
    button.removeAttribute("data-app-busy");
  });
}

function isServerAction(init?: RequestInit) {
  if (!init?.headers) return false;
  return new Headers(init.headers).has("Next-Action");
}

function installFetchPatch() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const track = isServerAction(init);
    if (track) {
      actionDepth += 1;
      notifyAction();
    }
    try {
      return await original(input, init);
    } finally {
      if (track) {
        actionDepth = Math.max(0, actionDepth - 1);
        notifyAction();
      }
    }
  };
}

function isInternalNavClick(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return (
    url.pathname !== window.location.pathname || url.search !== window.location.search
  );
}

export function BilliardBusy() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams}`;
  const [actionBusy, setActionBusy] = useState(false);
  const [navWait, setNavWait] = useState(false);
  const [formWait, setFormWait] = useState(false);
  const [visible, setVisible] = useState(false);
  const sawAction = useRef(false);

  useEffect(() => {
    installFetchPatch();
    const onAction = (busy: boolean) => setActionBusy(busy);
    listeners.add(onAction);
    setActionBusy(actionDepth > 0);
    return () => {
      listeners.delete(onAction);
    };
  }, []);

  useEffect(() => {
    setNavWait(false);
    setFormWait(false);
    releaseBusyButtons();
  }, [routeKey]);

  useEffect(() => {
    if (pathname.endsWith("/tv")) return;

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || !isInternalNavClick(anchor, event)) return;
      setNavWait(true);
    }

    function onSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.target && form.target !== "_self") return;
      setFormWait(true);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [pathname]);

  const busy = (actionBusy || navWait || formWait) && !pathname.endsWith("/tv");

  useEffect(() => {
    if (busy) {
      const show = window.setTimeout(() => setVisible(true), 80);
      return () => window.clearTimeout(show);
    }
    const hide = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(hide);
  }, [busy]);

  useEffect(() => {
    if (actionBusy) {
      sawAction.current = true;
      return;
    }
    if (!sawAction.current || !formWait) return;
    sawAction.current = false;
    const clear = window.setTimeout(() => {
      setFormWait(false);
      releaseBusyButtons();
    }, 400);
    return () => window.clearTimeout(clear);
  }, [actionBusy, formWait]);

  useEffect(() => {
    if (!busy) return;
    const failsafe = window.setTimeout(() => {
      setNavWait(false);
      setFormWait(false);
      releaseBusyButtons();
    }, 45_000);
    return () => window.clearTimeout(failsafe);
  }, [busy]);

  return (
    <div
      className={`app-busy${visible ? " app-busy--on" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={visible}
      aria-label={visible ? "Cargando, un momento" : undefined}
    >
      {visible ? (
        <div className="app-busy-overlay" aria-hidden>
          <div className="app-busy-card">
            <div className="billiard-busy-set billiard-busy-set--active">
              <span className="billiard-busy-ball billiard-busy-ball--yellow" />
              <span className="billiard-busy-ball billiard-busy-ball--white" />
              <span className="billiard-busy-ball billiard-busy-ball--red" />
            </div>
            <p className="app-busy-label">Un momento…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
