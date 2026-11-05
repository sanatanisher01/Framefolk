"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  Lock,
  Users,
  BookImage,
  Clock,
  Smartphone,
  Shield,
  Sparkles,
  ArrowRight,
  Play,
  ImageIcon,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { fadeUp, fadeIn, stagger } from "@/lib/animations";

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const features = [
  {
    icon: Camera,
    title: "High-Quality Photography",
    description:
      "Upload full-resolution photos and videos. We preserve your originals while delivering optimised versions across every screen.",
  },
  {
    icon: Lock,
    title: "Private & Controlled Sharing",
    description:
      "Every post has fine-grained visibility: Public, Followers, Close Friends or fully Private. You decide who sees what.",
  },
  {
    icon: Users,
    title: "Collaborative Albums",
    description:
      "Invite friends to contribute to shared albums. Capture events together and preserve them in one beautiful collection.",
  },
  {
    icon: BookImage,
    title: "Story Highlights",
    description:
      "Stories that expire in 24 hours, saved forever as Highlights. Pin your best moments to your profile.",
  },
  {
    icon: Clock,
    title: "Memory Timeline",
    description:
      "Rediscover your past — day by day, month by month, year by year. Your personal visual diary, automatically organised.",
  },
  {
    icon: MessageCircle,
    title: "Real-Time Messaging",
    description:
      "Direct messages with read receipts, typing indicators and media sharing. Stay connected with the people you follow.",
  },
  {
    icon: Smartphone,
    title: "Installable PWA",
    description:
      "Install FRAMEFOLK on any device for a native app experience. Works offline and supports push notifications.",
  },
  {
    icon: Shield,
    title: "Admin-Moderated Community",
    description:
      "Every account requires approval. A dedicated admin layer keeps the community safe, trusted and premium.",
  },
];

// Placeholder photo grid URLs (Unsplash — public domain)
const gridPhotos = [
  { src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80", h: "h-48" },
  { src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=80", h: "h-64" },
  { src: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80", h: "h-40" },
  { src: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&q=80", h: "h-56" },
  { src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80", h: "h-44" },
  { src: "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=400&q=80", h: "h-60" },
  { src: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&q=80", h: "h-36" },
  { src: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&q=80", h: "h-52" },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary flex flex-col">
      <LandingNav />
      <HeroSection />
      <PhotoGridSection />
      <FeaturesSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-bg-primary/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Logo size="md" />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-text-secondary">
          <a href="#features" className="hover:text-text-primary transition-colors">
            Features
          </a>
          <a href="#community" className="hover:text-text-primary transition-colors">
            Community
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28 px-4">
      {/* Background gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,118,94,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-6"
        >
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-sm font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Premium photography community
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-balance leading-[1.1]"
          >
            Every frame
            <br />
            <span className="text-accent">has a story.</span>
          </motion.h1>

          {/* Subline */}
          <motion.p
            variants={fadeUp}
            className="max-w-xl text-base sm:text-lg text-text-secondary leading-relaxed text-balance"
          >
            FRAMEFOLK is a private social photography network where you share
            high-quality photos and videos, build memories, and connect with
            the people who matter — on your terms.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 flex-wrap justify-center">
            <Link href="/register">
              <Button variant="primary" size="lg" className="gap-2">
                Join FRAMEFOLK
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                Sign in
              </Button>
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.p variants={fadeUp} className="text-xs text-text-muted">
            Every new account is reviewed before access is granted.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Photo Grid
// ─────────────────────────────────────────────
function PhotoGridSection() {
  return (
    <section className="px-4 sm:px-6 pb-20" aria-label="Photo showcase">
      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={fadeIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Masonry-style grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {gridPhotos.map((photo, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className={cn(
                  "relative overflow-hidden rounded-xl bg-bg-card group cursor-pointer",
                  photo.h
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt="Photography showcase"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-bg-primary/0 group-hover:bg-bg-primary/20 transition-colors duration-300" />
              </motion.div>
            ))}
          </div>

          {/* Caption */}
          <p className="text-center text-sm text-text-muted mt-4">
            Beautiful photos deserve a beautiful home.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Features
// ─────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 bg-bg-secondary/40">
      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="flex flex-col items-center gap-12"
        >
          {/* Heading */}
          <motion.div variants={fadeUp} className="text-center max-w-xl">
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-text-primary">
              Built for photographers.
              <br />
              <span className="text-accent">Made for everyone.</span>
            </h2>
            <p className="mt-3 text-text-secondary text-base leading-relaxed">
              Everything you need to share, preserve and experience your visual
              story — in one beautifully designed platform.
            </p>
          </motion.div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={fadeUp}
                  className="bg-bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-accent/30 hover:shadow-card-hover transition-all duration-300"
                >
                  <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-text-primary mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Three-column showcase
// ─────────────────────────────────────────────
function CtaSection() {
  return (
    <section id="community" className="py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: text */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="flex flex-col gap-5"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-card border border-border text-xs font-medium text-text-secondary">
                <Play className="h-3 w-3 text-accent" />
                Curated community
              </span>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="font-display font-bold text-3xl sm:text-4xl tracking-tight leading-tight"
            >
              A private network,
              <br />
              not a public feed.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-text-secondary leading-relaxed">
              Every member is reviewed before they join. No anonymous accounts,
              no spam, no noise. Just genuine people sharing genuine moments in
              a beautifully curated space.
            </motion.p>
            <motion.ul variants={stagger} className="flex flex-col gap-2.5">
              {[
                "Admin-approved registrations",
                "Granular post visibility controls",
                "Collaborative albums with invites",
                "Admin-moderated content removal",
              ].map((item) => (
                <motion.li
                  key={item}
                  variants={fadeUp}
                  className="flex items-center gap-2.5 text-sm text-text-secondary"
                >
                  <span className="h-5 w-5 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  {item}
                </motion.li>
              ))}
            </motion.ul>
            <motion.div variants={fadeUp} className="flex gap-3 pt-2">
              <Link href="/register">
                <Button variant="primary" size="md">
                  Request access
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="md">
                  Sign in
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right: mock phone frame */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex justify-center"
          >
            <MockPhoneFrame />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function MockPhoneFrame() {
  return (
    <div className="relative w-[260px]">
      {/* Phone shell */}
      <div className="relative bg-bg-card border-2 border-border rounded-[36px] p-3 shadow-modal overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 mb-2">
          <span className="text-[10px] text-text-muted font-medium">9:41</span>
          <div className="w-16 h-4 rounded-full bg-bg-secondary" />
          <div className="flex gap-1">
            <span className="w-4 h-2 bg-text-muted/30 rounded-sm" />
            <span className="w-3 h-2 bg-text-muted/30 rounded-sm" />
          </div>
        </div>

        {/* Mock feed */}
        <div className="flex flex-col gap-2">
          {/* Story carousel */}
          <div className="flex gap-1.5 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                <div className={cn(
                  "h-10 w-10 rounded-full bg-bg-secondary border-2",
                  i === 0 ? "border-accent" : "border-border"
                )} />
                <div className="h-1.5 w-7 bg-bg-secondary rounded-full" />
              </div>
            ))}
          </div>

          {/* Post card */}
          <div className="bg-bg-secondary rounded-xl overflow-hidden">
            {/* Author row */}
            <div className="flex items-center gap-2 p-2">
              <div className="h-7 w-7 rounded-full bg-accent/20" />
              <div className="flex flex-col gap-0.5">
                <div className="h-2 w-16 bg-bg-card rounded" />
                <div className="h-1.5 w-10 bg-bg-card/60 rounded" />
              </div>
            </div>
            {/* Photo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=70"
              alt="Mock post"
              className="w-full h-36 object-cover"
            />
            {/* Actions */}
            <div className="flex items-center gap-3 p-2">
              <div className="h-4 w-4 bg-bg-card rounded" />
              <div className="h-4 w-4 bg-bg-card rounded" />
              <div className="h-4 w-4 bg-bg-card rounded" />
              <div className="ml-auto h-4 w-4 bg-bg-card rounded" />
            </div>
          </div>

          {/* Second mini post */}
          <div className="bg-bg-secondary rounded-xl p-2 flex gap-2 items-center">
            <div className="h-7 w-7 rounded-full bg-bg-card" />
            <div className="flex-1 space-y-1">
              <div className="h-2 w-20 bg-bg-card rounded" />
              <div className="h-1.5 w-14 bg-bg-card/60 rounded" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-accent/15" />
          </div>
        </div>

        {/* Bottom nav mock */}
        <div className="flex justify-around mt-3 pt-2 border-t border-border/50">
          {[ImageIcon, Compass, PlusSquare, MessageCircle, Users].map((Icon, i) => (
            <div
              key={i}
              className={cn(
                "h-6 w-6 rounded-lg flex items-center justify-center",
                i === 0 ? "text-accent" : "text-text-muted"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Accent glow */}
      <div
        aria-hidden
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full blur-2xl"
        style={{ background: "rgba(255,118,94,0.15)" }}
      />
    </div>
  );
}

function Compass({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" strokeWidth="2" />
    </svg>
  );
}

function PlusSquare({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
      <path d="M12 8v8M8 12h8" strokeWidth="2" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-10 px-4 sm:px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo size="sm" />
        <p className="text-sm text-text-muted text-center">
          © {new Date().getFullYear()} FRAMEFOLK · Every frame has a story.
        </p>
        <div className="flex items-center gap-5 text-sm text-text-muted">
          <a href="#" className="hover:text-text-secondary transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-text-secondary transition-colors">
            Terms
          </a>
          <Link href="/login" className="hover:text-text-secondary transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
