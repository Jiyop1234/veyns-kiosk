// @ts-nocheck
// HomePage — the landing part of the store: welcome section, then the hero image marquee (Step 8A).
// Rendered by StorePage above the menu. Later steps add testimonials, 'The usual?' and the footer here.
import React from 'react';
import './home-page.css';
import { WelcomeSection } from '@/components/store/welcome-section';
import { HeroMarquee } from '@/components/store/hero-marquee';

export function HomePage({ currentUser }: { currentUser?: any }) {
  return (
    <>
      <WelcomeSection currentUser={currentUser} />
      <HeroMarquee />
    </>
  );
}
