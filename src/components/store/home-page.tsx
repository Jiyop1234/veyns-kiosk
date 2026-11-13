// @ts-nocheck
// HomePage — the landing part of the store (Step 8): welcome greeting + hero image marquee.
// Rendered by StorePage above the menu. Later steps add testimonials, "The usual?" and the footer here.
import React from 'react';
import './home-page.css';
import { WelcomeModal } from '@/components/store/welcome-modal';
import { HeroMarquee } from '@/components/store/hero-marquee';

export function HomePage(props: any) {
  return (
    <>
      <WelcomeModal />
      <HeroMarquee />
    </>
  );
}
