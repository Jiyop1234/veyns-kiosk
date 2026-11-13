// @ts-nocheck
// HomePage — the landing part of the store: welcome section, hero image marquee (Step 8A), then testimonials (Step 9).
// Rendered by StorePage above the menu. Later steps add 'The usual?' and the footer here.
import React from 'react';
import './home-page.css';
import { WelcomeSection } from '@/components/store/welcome-section';
import { HeroMarquee } from '@/components/store/hero-marquee';
import { TestimonialsMarquee } from '@/components/store/testimonials-marquee';

export function HomePage({ currentUser }: { currentUser?: any }) {
  return (
    <>
      <WelcomeSection currentUser={currentUser} />
      <HeroMarquee />
      <TestimonialsMarquee />
    </>
  );
}
