"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type CartItem = {
  productId: string;
  quantity: number;
  addedAt: string;
};

const STORAGE_KEY = "dela-cart-v1";
const CHANGE_EVENT = "dela-cart-change";

const EMPTY_ITEMS: CartItem[] = [];

// Snapshot estável compartilhado entre todos os consumidores do hook na mesma aba.
// useSyncExternalStore exige que getSnapshot retorne a MESMA referência quando
// nada muda — por isso cacheamos o JSON raw e parseamos só quando ele difere.
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY_ITEMS;

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CartItem>;
  return (
    typeof record.productId === "string" &&
    typeof record.quantity === "number" &&
    Number.isInteger(record.quantity) &&
    record.quantity >= 0 &&
    typeof record.addedAt === "string"
  );
}

function parseRaw(raw: string): CartItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : EMPTY_ITEMS;
  } catch {
    return EMPTY_ITEMS;
  }
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): CartItem[] {
  const raw = readRaw();
  if (raw === cachedRaw) {
    return cachedItems;
  }
  cachedRaw = raw;
  cachedItems = raw ? parseRaw(raw) : EMPTY_ITEMS;
  return cachedItems;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_ITEMS;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      callback();
    }
  }

  function onCustom() {
    callback();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(items);
  cachedRaw = raw;
  cachedItems = items;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // localStorage cheio ou desabilitado — mantemos a atualização em memória
  }

  // Notifica outros hooks na MESMA aba (storage event só dispara em outras abas).
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const addItem = useCallback((productId: string, quantity = 1) => {
    if (quantity <= 0) return;
    const current = getSnapshot();
    const existing = current.find((item) => item.productId === productId);
    const next = existing
      ? current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      : [...current, { productId, quantity, addedAt: new Date().toISOString() }];
    writeCart(next);
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const current = getSnapshot();
    const next =
      quantity <= 0
        ? current.filter((item) => item.productId !== productId)
        : current.map((item) =>
            item.productId === productId ? { ...item, quantity } : item,
          );
    writeCart(next);
  }, []);

  const removeItem = useCallback((productId: string) => {
    writeCart(getSnapshot().filter((item) => item.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    writeCart([]);
  }, []);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, clear, count, isHydrated };
}
