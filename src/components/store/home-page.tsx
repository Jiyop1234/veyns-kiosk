// @ts-nocheck
// HomePage — the landing part of the store: welcome section, hero image marquee (Step 8A), then testimonials (Step 9).
// Rendered by StorePage above the menu. Later steps add 'The usual?' and the footer here.
// Step 9C: while the store is shown, the page snaps one section at a time (see home-page.css).
import React, { useEffect } from 'react';
import './home-page.css';
import { WelcomeSection } from '@/components/store/welcome-section';
import { HeroMarquee } from '@/components/store/hero-marquee';
import { TestimonialsMarquee } from '@/components/store/testimonials-marquee';

export function HomePage({ currentUser }: { currentUser?: any }) {
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
    </>
  );
}
