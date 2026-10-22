// @ts-nocheck
import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);

  const add = (
    item,
    qty = 1,
    customizations = [],
    customizationTotal = 0,
    customizationsSummary = ''
  ) => {
    const effectiveUnitPrice = (Number(item?.price) || 0) + (Number(customizationTotal) || 0);
    const customizationsKey = JSON.stringify(customizations || []);

    setLines((prev) => {
      const existingIndex = prev.findIndex(
        (l) =>
          l.item.id === item.id &&
          JSON.stringify(l.customizations || []) === customizationsKey
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: updated[existingIndex].qty + qty,
        };
        return updated;
      }
      const lineId = `${item.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return [
        ...prev,
        {
          id: lineId,
          lineId,
          item,
          qty,
          customizations,
          customizationTotal,
          customizationsSummary,
          unitPrice: effectiveUnitPrice,
        },
      ];
    });
  };

  const setLineQty = (lineIdentifier, qty) => {
    setLines((prev) => {
      if (qty <= 0) {
        return prev.filter(
          (l) => l.lineId !== lineIdentifier && l.id !== lineIdentifier && l.item.id !== lineIdentifier
        );
      }
      return prev.map((l) =>
        l.lineId === lineIdentifier || l.id === lineIdentifier || l.item.id === lineIdentifier
          ? { ...l, qty }
          : l
      );
    });
  };

  const remove = (lineIdentifier) => {
    setLines((prev) =>
      prev.filter(
        (l) => l.lineId !== lineIdentifier && l.id !== lineIdentifier && l.item.id !== lineIdentifier
      )
    );
  };

  const clear = () => setLines([]);

  const count = lines.reduce((acc, l) => acc + l.qty, 0);
  const total = lines.reduce(
    (acc, l) => acc + (l.unitPrice ?? l.item.price) * l.qty,
    0
  );

  return (
    <CartContext.Provider value={{ lines, add, setLineQty, remove, clear, count, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);