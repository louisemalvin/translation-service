# Design Guidelines: Sermon Translation System

This document defines the unified visual design system, colors, and layout guidelines for the sermon translation application. The goal is to maintain a single, highly readable, and premium dark theme tailored for dark church environments.

---

## 🎨 Unified Color Palette

To keep the codebase clean, readable, and maintainable, the app uses a single dark color scheme with distinct semantic colors.

### 1. Base Colors (Surfaces & Backgrounds)
* **Main Viewport Background**: `#020617` (`bg-slate-950` / `var(--color-surface-primary)`)
  * Solid dark foundation to prevent glare in low-light environments.
* **Component Cards & Trays**: `#0f172a` (`bg-slate-900` / `var(--color-surface-secondary)`)
  * Used for headers, footers, control boxes, and settings panels.
* **Borders & Dividers**: `#1e293b` (`border-slate-800` / `var(--color-surface-border)`)
  * Low-opacity separators to maintain clean boundaries without visual clutter.

### 2. Typography Colors
* **Primary Text**: `#f1f5f9` (`text-slate-100` / `var(--color-text-primary)`)
  * High-contrast white for maximum legibility of active translated sentences.
* **Secondary Text**: `#94a3b8` (`text-slate-400` / `var(--color-text-secondary)`)
  * Muted slate gray for past sentences, timestamps, and secondary captions.
* **Disabled / Accent Labels**: `#475569` (`text-slate-500` / `var(--color-text-muted)`)

### 3. Semantic / Status Colors
* **Accent / Core Controls**: `#6366f1` (`bg-indigo-500` / `var(--color-accent)`)
  * Used for active toggle buttons, inputs, focus states, and headphones icons.
* **Live Broadcast (Success)**: `#22c55e` (`bg-green-500` / `var(--color-status-live)`)
  * Glowing indicator showing active connection and microphone transmission.
* **Stop / Warning (Error)**: `#ef4444` (`bg-red-500` / `var(--color-status-error)`)
  * Red coloring for Stopped state, connection errors, and error banners.

---

## 📐 Layout & Typography Guidelines

### 1. Congregation Live View (`/`)
* **Teleprompter Model**: 
  * Only show a focused list of the current sentence and the preceding 2 sentences.
  * Hide scrollbars completely (`overflow-hidden` or `scrollbar-none`).
  * Apply font-size scale dynamically to the main container using classes:
    * `text-lg` / `text-xl` / `text-2xl` / `text-3xl` / `text-4xl`
* **Horizontal Constraints**: Max width of text content container must be restricted to `max-w-2xl` or `max-w-3xl` for optimal readability (roughly 60–80 characters per line).

### 2. Speaker Console (`/speaker`)
* **Minimalist Controls**: A centered layout focusing on the main record action.
* **Microphone Feedback**: A visual, animating canvas-based or CSS-based VU Meter that uses green/indigo hues to represent active voice volume input.
