// @ts-nocheck
import React, { createContext, useContext, useState } from 'react';

// Keep cart state in memory while the customer is browsing and checking out.
// Order submission must still revalidate prices and customizations against trusted data.
const CartContext = createContext(null);

// Provide cart state and actions to the ordering interface and its child components.
export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);

  // Add an item with its selected customizations and calculated add-on charge.
  const add = (
    item,
    qty = 1,
    customizations = [],
    customizationTotal = 0,
    customizationsSummary = ''
  ) => {
    const basePrice = Number(item?.price) || 0;
    const discountPercent = Number(item?.discountPercent) || 0;
    const discountedBasePrice = discountPercent > 0
      ? basePrice * (1 - discountPercent / 100)
      : basePrice;
    const effectiveUnitPrice = discountedBasePrice + (Number(customizationTotal) || 0);
    const customizationsKey = JSON.stringify(customizations || []);

    setLines((prev) => {
      // Combine quantities only when the same item and options already match.
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

      // Give each customized cart line its own identifier so quantity and remove actions
      // can target that specific line even when the same menu item has different options.
      const lineId = String(item.id) + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
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

  // Change a cart line's quantity, or remove matching lines when the quantity reaches zero.
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

  // Remove a cart line by its line ID, row ID, or menu item ID.
  const remove = (lineIdentifier) => {
    setLines((prev) =>
      prev.filter(
        (l) => l.lineId !== lineIdentifier && l.id !== lineIdentifier && l.item.id !== lineIdentifier
      )
    );
  };

  // Empty the cart after checkout or when the customer clears it.
  const clear = () => setLines([]);

  // Derive the displayed item count and subtotal from the current cart lines.
  const count = lines.reduce((acc, l) => acc + l.qty, 0);
  const total = lines.reduce(
    (acc, l) => acc + (l.unitPrice ?? l.item.price) * l.qty,
    0
  );

  // Expose the cart state and actions to components inside CartProvider.
  return (
    <CartContext.Provider value={{ lines, add, setLineQty, remove, clear, count, total }}>
      {children}
    </CartContext.Provider>
  );
}

// Read cart state and actions from the nearest CartProvider.
export const useCart = () => useContext(CartContext);
