// @ts-nocheck
// HomePage — the landing part of the store: welcome section, hero image marquee (Step 8A), testimonials (Step 9), then 'The usual?' (Step 10).
// Rendered by StorePage above the menu. A later step adds the footer here.
// Step 9C: while the store is shown, the page snaps one section at a time (see home-page.css).
import React, { useEffect } from 'react';
import './home-page.css';
import { WelcomeSection } from '@/components/store/welcome-section';
import { HeroMarquee } from '@/components/store/hero-marquee';
import { TestimonialsMarquee } from '@/components/store/testimonials-marquee';
import { TheUsual } from '@/components/store/the-usual';

export function HomePage({ currentUser, orderHistory, onReviewOrder }: { currentUser?: any; orderHistory?: any[]; onReviewOrder?: () => void }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('veyns-snap-page');
    return () => root.classList.remove('veyns-snap-page');
  }, []);

  return (
    <>
      <WelcomeSection currentUser={currentUser} />
      <HeroMarquee />
      <TestimonialsMarquee />
      {/* Step 10: shows only for a signed-in customer with 3+ orders and an item in 2+ of them. */}
      <TheUsual orderHistory={orderHistory || []} currentUser={currentUser} onReviewOrder={onReviewOrder} />
    </>
  );
}
