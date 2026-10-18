// @ts-nocheck
import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);

  const add = (item, qty = 1) => {
    setLines((prev) => {
      const existingIndex = prev.findIndex((l) => l.item.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: updated[existingIndex].qty + qty,
        };
        return updated;
      }
      return [...prev, { item, qty }];
    });
  };

  const setLineQty = (itemId, qty) => {
    setLines((prev) => {
      if (qty <= 0) {
        return prev.filter((l) => l.item.id !== itemId);
      }
      return prev.map((l) => (l.item.id === itemId ? { ...l, qty } : l));
    });
  };

  const remove = (itemId) => {
    setLines((prev) => prev.filter((l) => l.item.id !== itemId));
  };

  const clear = () => setLines([]);

  const count = lines.reduce((acc, l) => acc + l.qty, 0);
  const total = lines.reduce((acc, l) => acc + l.item.price * l.qty, 0);

  return (
    <CartContext.Provider value={{ lines, add, setLineQty, remove, clear, count, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);