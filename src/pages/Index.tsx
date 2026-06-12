import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useState } from "react";
import {
  ShieldCheck,
  Activity,
  Camera,
  AlertTriangle,
  CheckCircle,
  Zap,
  Globe,
  FileText,
  ChevronRight,
  ArrowRight,
  ChevronDown,
  Star,
  Bell,
  Clock,
  TrendingUp,
  Users,
  Menu,
  X,
} from "lucide-react";

const FEATURES = [
  {
    icon: Activity,
    title: "Page & Journey Monitoring",
    description:
      "Monitor status codes, keywords, and scripted flows like contact form submissions or newsletter signups.",
  },
  {
    icon: Camera,
    title: "Screenshot Evidence",
    description:
      "Every run captures a full-page screenshot. Compare before and after to see exactly what changed.",
  },
  {
    icon: AlertTriangle,
    title: "Incident Tickets",
    description:
      "Issues become structured tickets with severity, evidence, and plain-English recommended fixes.",
  },
  {
    icon: ShieldCheck,
    title: "Ownership Verification",
    description:
      "Verify your site via DNS TXT or meta tag before monitoring begins — prevents abuse.",
  },
  {
    icon: Zap,
    title: "Change Detection",
    description:
      "Catch visual regressions, missing keywords, new JS errors, and performance drops automatically.",
  },
  {
    icon: FileText,
    title: "Weekly Health Reports",
    description:
      "Receive a weekly summary email with pass rates, incident counts, and top failing monitors.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    description: "For solo site owners",
    features: [
      "1 site",
      "5 monitors",
      "Hourly checks",
      "1 journey monitor",
      "14-day retention",
      "Email alerts",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$79",
    period: "/mo",
    description: "For small businesses",
    features: [
      "3 sites",
      "15 monitors",
      "15-min + hourly checks",
      "3 journey monitors",
      "30-day retention",
      "Slack & webhook alerts",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$199",
    period: "/mo",
    description: "For consultants & agencies",
    features: [
      "10 sites",
      "30 monitors",
      "15-min checks",
      "10 journey monitors",
      "90-day retention",
      "White-label reports",
    ],
    cta: "Start free trial",
    highlight: false,
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Add your site",
    description:
      "Enter your domain and verify ownership in under 2 minutes with a DNS record or meta tag.",
  },
  {
    step: "02",
    title: "Choose a template",
    description:
      "Pick Lead Gen or Brochure — monitors are pre-configured for your site type.",
  },
  {
    step: "03",
    title: "Get protected",
    description:
      "Receive incident alerts with screenshots and plain-English fixes the moment something breaks.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Our contact form broke on a Friday night and I found out Saturday morning via Watchlayer — not from an angry client on Monday. That alone paid for a year of subscription.",
    name: "Marcus Webb",
    title: "Freelance Web Consultant",
    avatar: "MW",
    stars: 5,
  },
  {
    quote:
      "I manage 8 client sites. Before Watchlayer I'd randomly discover issues during calls. Now I'm the one who emails the client about problems before they even notice.",
    name: "Priya Nathani",
    title: "Digital Agency Owner",
    avatar: "PN",
    stars: 5,
  },
  {
    quote:
      "The screenshot evidence feature is killer. When a JS deploy broke our lead form, I had a screenshot and a recommended fix ready before the dev team had coffee.",
    name: "Tom Callahan",
    title: "Head of Growth, SaaS Startup",
    avatar: "TC",
    stars: 5,
  },
];

const FAQS = [
  {
    question: "What exactly does Watchlayer monitor?",
    answer:
      "Watchlayer monitors HTTP status codes, keyword presence/absence, contact form submissions, checkout flows, and visual changes via screenshots. We check the things that actually matter to your business — not just whether the server responds.",
  },
  {
    question: "How is this different from simple uptime monitors?",
    answer:
      "Traditional uptime monitors only check if a server responds with a 200 status. Watchlayer goes deeper: it checks that your contact form actually submits, that key copy is still on the page, that no new JS errors appeared, and captures screenshots as evidence.",
  },
  {
    question: "How quickly will I be alerted when something breaks?",
    answer:
      "Starter plans check hourly. Growth and Agency plans check every 15 minutes. You'll receive an email (or Slack/webhook on higher plans) the moment an incident is detected, with a screenshot attached.",
  },
  {
    question: "Do I need to install anything on my website?",
    answer:
      "No code installation required. You just verify site ownership via a DNS record or a meta tag in your HTML — a one-time 2-minute setup. After that, all monitoring runs from our infrastructure.",
  },
  {
    question: "Can I monitor sites I don't own?",
    answer:
      "We require ownership verification before monitoring begins. This protects both site owners and prevents abuse. You can only monitor sites you control.",
  },
  {
    question: "What happens after the 7-day free trial?",
    answer:
      "After your trial, you'll be prompted to choose a paid plan. We don't auto-charge — you pick and pay when ready. Your data and monitors are preserved for 14 days after trial end.",
  },
];

const STATS = [
  { value: "12,000+", label: "Sites protected" },
  { value: "99.9%", label: "Alert delivery rate" },
  { value: "< 3 min", label: "Avg time-to-alert" },
  { value: "4.8\u2605", label: "Average rating" },
];

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Watchlayer</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <SignInButton className="text-sm" />
            <Button asChild size="sm">
              <Link to="/app/dashboard">Start free trial <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <button className="cursor-pointer md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-border md:hidden">
              <div className="flex flex-col gap-4 px-6 py-4">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Features</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">FAQ</a>
                <div className="flex gap-3 pt-2">
                  <SignInButton className="text-sm" />
                  <Button asChild size="sm"><Link to="/app/dashboard">Start free trial</Link></Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-background to-background" />
          <div className="absolute left-1/2 top-[-100px] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        </div>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-sm font-medium text-primary">
              <Bell className="h-3.5 w-3.5" />
              Know when your website breaks before customers do
            </div>
          </motion.div>
          <motion.h1 className="mb-6 text-5xl font-bold tracking-tight text-balance md:text-6xl lg:text-7xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
            Website monitoring{" "}<span className="relative"><span className="relative z-10 bg-gradient-to-br from-primary via-primary to-accent-foreground bg-clip-text text-transparent">with evidence</span></span>
          </motion.h1>
          <motion.p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground text-balance" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.16 }}>
            Watchlayer monitors your contact forms, landing pages, and key journeys. When something breaks, you get a structured incident report — with screenshots, error logs, and exactly what to fix.
          </motion.p>
          <motion.div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.24 }}>
            <Button asChild size="lg" className="px-8 text-base shadow-lg shadow-primary/25">
              <Link to="/app/dashboard">Start monitoring for free<ChevronRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-chart-3" />
              7-day free trial · No credit card required
            </div>
          </motion.div>
          <motion.div className="mt-8 flex items-center justify-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.35 }}>
            <div className="flex -space-x-2">
              {["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"].map((color, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-background" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <div className="flex">{[1,2,3,4,5].map((s) => (<Star key={s} className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />))}</div>
              <span>Trusted by <strong className="text-foreground">800+</strong> site owners</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/30 py-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <motion.div key={stat.label} className="text-center" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.07 }}>
                <p className="text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Features</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Not just uptime. Evidence.</h2>
              <p className="mx-auto max-w-xl text-lg text-muted-foreground">Traditional monitors tell you the site is down. Watchlayer tells you <em>what</em> broke, shows you the screenshot, and recommends how to fix it.</p>
            </motion.div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} className="group rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md hover:shadow-primary/5" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.06 }}>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15"><f.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border bg-muted/20 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Setup</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Protected in under 10 minutes</h2>
              <p className="text-lg text-muted-foreground">Template-driven setup means zero configuration headaches.</p>
            </motion.div>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={step.step} className="relative" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><span className="text-sm font-bold">{step.step}</span></div>
                  {i < HOW_IT_WORKS.length - 1 && <div className="hidden h-px flex-1 bg-border md:block" />}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Social proof</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Trusted by site owners who can{"'"}t afford downtime</h2>
            </motion.div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} className="flex flex-col justify-between rounded-xl border border-border bg-card p-6" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                <div>
                  <div className="mb-4 flex">{Array.from({ length: t.stars }).map((_, s) => (<Star key={s} className="h-4 w-4 fill-chart-4 text-chart-4" />))}</div>
                  <p className="mb-6 text-sm leading-relaxed text-foreground">{`"`}{t.quote}{`"`}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{t.avatar}</div>
                  <div><p className="text-sm font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.title}</p></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-muted/20 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Pricing</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Simple, transparent pricing</h2>
              <p className="text-lg text-muted-foreground">All plans include a 7-day free trial with Growth limits. No credit card required.</p>
            </motion.div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PRICING.map((plan, i) => (
              <motion.div key={plan.name} className={`relative flex flex-col rounded-xl border p-7 ${plan.highlight ? "border-primary bg-card shadow-xl shadow-primary/10" : "border-border bg-card"}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}>
                {plan.highlight && (<div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">Most popular</div>)}
                <div className="mb-6">
                  <h3 className="mb-1 text-lg font-bold">{plan.name}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="flex items-baseline gap-1"><span className="text-4xl font-bold">{plan.price}</span><span className="text-muted-foreground">{plan.period}</span></div>
                </div>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map((f) => (<li key={f} className="flex items-center gap-2.5 text-sm"><CheckCircle className="h-4 w-4 shrink-0 text-primary" />{f}</li>))}
                </ul>
                <Button asChild className="w-full" variant={plan.highlight ? "default" : "secondary"}><Link to="/app/dashboard">{plan.cta}</Link></Button>
              </motion.div>
            ))}
          </div>
          <motion.div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card p-6 md:flex-row" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div><p className="font-semibold">Need more? Enterprise plans available.</p><p className="text-sm text-muted-foreground">Unlimited sites, SSO, custom SLAs, dedicated support.</p></div>
            </div>
            <Button variant="secondary" asChild><a href="mailto:hello@watchlayer.io">Contact sales</a></Button>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-16 text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">FAQ</p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Common questions</h2>
            </motion.div>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div key={faq.question} className="rounded-xl border border-border bg-card overflow-hidden" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                <button className="flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="font-medium">{faq.question}</span>
                  <ChevronDown className={`ml-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-16 text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-[80px]" />
            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white"><Clock className="h-3.5 w-3.5" />Protected in under 10 minutes</div>
              <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Start monitoring before something breaks</h2>
              <p className="mb-8 text-lg text-white/75">Join 800+ site owners catching breakages before customers do. 7-day free trial. No credit card required.</p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" variant="secondary" className="px-8 text-base"><Link to="/app/dashboard">Start free trial<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/60">
                <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-white/50" /> No credit card</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-white/50" /> Cancel anytime</span>
                <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-white/50" /> Set up in 10 min</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <Link to="/" className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary"><Globe className="h-3.5 w-3.5 text-primary-foreground" /></div>
                <span className="font-bold">Watchlayer</span>
              </Link>
              <p className="text-sm text-muted-foreground">Website monitoring with evidence. Built for site owners who can't afford surprises.</p>
            </div>
            <div className="flex gap-16 text-sm">
              <div className="space-y-3">
                <p className="font-semibold">Product</p>
                <div className="space-y-2 text-muted-foreground">
                  <a href="#features" className="block hover:text-foreground transition-colors">Features</a>
                  <a href="#pricing" className="block hover:text-foreground transition-colors">Pricing</a>
                  <a href="#faq" className="block hover:text-foreground transition-colors">FAQ</a>
                </div>
              </div>
              <div className="space-y-3">
                <p className="font-semibold">Company</p>
                <div className="space-y-2 text-muted-foreground">
                  <a href="#" className="block hover:text-foreground transition-colors">Privacy</a>
                  <a href="#" className="block hover:text-foreground transition-colors">Terms</a>
                  <a href="mailto:hello@watchlayer.io" className="block hover:text-foreground transition-colors">Contact</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Watchlayer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
