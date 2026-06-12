export type JourneyStep = {
  id: string;
  action: "navigate" | "click" | "fill" | "wait" | "assert_text" | "assert_element";
  selector?: string;
  value?: string;
  label: string;
};

export type MonitorTemplate = {
  slug: string;
  name: string;
  description: string;
  category: "lead_gen" | "brochure" | "ecommerce" | "general";
  type: "page" | "journey";
  defaultFrequencyMinutes: number;
  // Pre-filled steps for journey templates
  steps?: JourneyStep[];
  // Test data fields required by this template
  testDataFields?: { key: string; label: string; placeholder: string; required: boolean }[];
};

export const TEMPLATES: MonitorTemplate[] = [
  // ---- Lead Gen ----
  {
    slug: "lead-gen-contact-form",
    name: "Contact Form Submission",
    description: "Fills and submits a contact form, then checks for a thank-you confirmation.",
    category: "lead_gen",
    type: "journey",
    defaultFrequencyMinutes: 60,
    steps: [
      { id: "1", action: "navigate", value: "{{contact_page_url}}", label: "Open contact page" },
      { id: "2", action: "fill", selector: "input[name='name']", value: "{{test_name}}", label: "Fill name" },
      { id: "3", action: "fill", selector: "input[name='email']", value: "{{test_email}}", label: "Fill email" },
      { id: "4", action: "fill", selector: "textarea", value: "Automated monitor test — please ignore.", label: "Fill message" },
      { id: "5", action: "click", selector: "button[type='submit']", label: "Submit form" },
      { id: "6", action: "assert_text", value: "Thank you", label: "Check confirmation text" },
    ],
    testDataFields: [
      { key: "contact_page_url", label: "Contact page URL", placeholder: "https://example.com/contact", required: true },
      { key: "test_name", label: "Test name", placeholder: "WatchLayer Bot", required: true },
      { key: "test_email", label: "Test email", placeholder: "monitor@example.com", required: true },
    ],
  },
  {
    slug: "lead-gen-newsletter-signup",
    name: "Newsletter Sign-up",
    description: "Enters an email address in a newsletter widget and submits it.",
    category: "lead_gen",
    type: "journey",
    defaultFrequencyMinutes: 60,
    steps: [
      { id: "1", action: "navigate", value: "{{page_url}}", label: "Open page" },
      { id: "2", action: "fill", selector: "input[type='email']", value: "{{test_email}}", label: "Enter email" },
      { id: "3", action: "click", selector: "button[type='submit']", label: "Submit" },
      { id: "4", action: "assert_text", value: "{{success_text}}", label: "Check success message" },
    ],
    testDataFields: [
      { key: "page_url", label: "Page URL", placeholder: "https://example.com", required: true },
      { key: "test_email", label: "Test email", placeholder: "monitor@example.com", required: true },
      { key: "success_text", label: "Success text to check", placeholder: "Thanks for subscribing", required: true },
    ],
  },
  // ---- Brochure ----
  {
    slug: "brochure-homepage",
    name: "Homepage Availability",
    description: "Loads the homepage and checks for a key heading or element.",
    category: "brochure",
    type: "page",
    defaultFrequencyMinutes: 15,
    testDataFields: [],
  },
  {
    slug: "brochure-cta-visible",
    name: "Call-to-Action Visible",
    description: "Navigates to a landing page and asserts that a primary CTA button is present.",
    category: "brochure",
    type: "journey",
    defaultFrequencyMinutes: 60,
    steps: [
      { id: "1", action: "navigate", value: "{{page_url}}", label: "Open page" },
      { id: "2", action: "assert_element", selector: "{{cta_selector}}", label: "Assert CTA is present" },
    ],
    testDataFields: [
      { key: "page_url", label: "Page URL", placeholder: "https://example.com/pricing", required: true },
      { key: "cta_selector", label: "CTA CSS selector", placeholder: "a.btn-primary", required: true },
    ],
  },
  // ---- General ----
  {
    slug: "general-page-load",
    name: "Page Load Check",
    description: "Simple load check — verifies the page returns a 200 and renders without a JS error.",
    category: "general",
    type: "page",
    defaultFrequencyMinutes: 15,
    testDataFields: [],
  },
  {
    slug: "general-custom-journey",
    name: "Custom Journey",
    description: "Start from scratch and build your own step-by-step journey.",
    category: "general",
    type: "journey",
    defaultFrequencyMinutes: 60,
    steps: [],
    testDataFields: [],
  },
];

export const CATEGORY_LABELS: Record<MonitorTemplate["category"], string> = {
  lead_gen: "Lead Gen",
  brochure: "Brochure",
  ecommerce: "Ecommerce",
  general: "General",
};

export const FREQUENCY_OPTIONS = [
  { value: 15, label: "Every 15 min" },
  { value: 60, label: "Every hour" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Daily" },
];
