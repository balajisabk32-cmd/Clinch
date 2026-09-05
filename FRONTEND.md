# AGENTS.md — Protocol for Premium Website Generation

## 1. Mandatory Master Frontend Skills
Whenever designing, scaffolding, refactoring, or building any website or web application, **YOU MUST ALWAYS consult and strictly apply the skills in the Master Frontend skills directory**:
📁 **Location**: `C:\Users\Balaji\.agents\skills\MASTER-FRONTEND`

### Zero Tolerance for Generic/Sloppy Designs (The "Absolute Zero" Directive)
- **No generic AI defaults**: Banned default saturated blues/purples over dark mesh, 3 identical cookie-cutter cards, unstyled inputs, and static flat layouts.
- **Banned Common Fonts**: Avoid generic fallbacks like plain Inter, Roboto, Arial, Times New Roman, or Open Sans. Use curated typography (e.g., `Geist`, `Clash Display`, `Plus Jakarta Sans`, `PP Editorial New`, `Outfit`, `Syne`, `Cabinet Grotesk`, `Instrument Serif`).
- **Banned Shadows & Borders**: No harsh 1px solid gray borders (`#e5e7eb`) or muddy drop shadows. Use subtle translucent rings (`border border-white/10`, `ring-1 ring-black/5`) and multi-layer diffused ambient glows.
- **Agency-Grade Polish**: Every site must look like it was designed by a top-tier design agency (Awwwards / Dribbble / Linear standard).

---

## 2. Taste & Anti-Slop Frontend Engine (Premium Feel)
Consult: `design-taste-frontend/`, `high-end-visual-design/`, `gpt-taste/`, `stitch-design-taste/`

### A. The Mandatory Pre-Flight "Design Read"
Before generating code, declare a one-line Design Read:
> **"Reading this as: `<page kind>` for `<audience>`, with a `<vibe>` language, leaning toward `<design system / aesthetic family>`."**

### B. The Three Aesthetic Dials
Set and tune the dials for every project based on the design brief:
- **`DESIGN_VARIANCE` (1 to 10)**: `1` = Strict Symmetry, `10` = Artsy Asymmetrical Chaos *(Default: `8`)*
- **`MOTION_INTENSITY` (1 to 10)**: `1` = Static, `10` = Cinematic Physics / Scroll scrubbing *(Default: `6`)*
- **`VISUAL_DENSITY` (1 to 10)**: `1` = Ultra Airy / Gallery, `10` = Cockpit / Data-dense *(Default: `4`)*

### C. Haptic Micro-Aesthetics & Container Architecture
1. **The "Double-Bezel" (Doppelrand) Architecture**:
   - Never drop a flat card directly onto the background.
   - Use an **Outer Shell** (`p-1.5` to `p-2`, `rounded-[2rem]`, subtle border/bg) wrapping an **Inner Core** container with mathematically concentric radiuses (`rounded-[calc(2rem-0.5rem)]`) and an inner hairline highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`).
2. **"Button-in-Button" Island CTAs**:
   - Primary buttons are rounded pills (`rounded-full px-6 py-3`).
   - Trailing arrow icons (`↗`) must be nested in their own circular sub-pill wrapper (`w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center`).
3. **Macro-Whitespace & Eyebrow Badges**:
   - Massive vertical section padding (`py-24` to `py-40`).
   - Eyebrow badges preceding headers: microscopic pill tags (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`).

---

## 3. Motion & GSAP Architecture Suite
Consult: `gsap-core/`, `gsap-scrolltrigger/`, `gsap-timeline/`, `gsap-plugins/`, `gsap-performance/`

### A. GSAP & Animation Core Mandates
- **GSAP + ScrollTrigger**: Smooth pinned sections, scrubbed progress bars, horizontal portfolio galleries, and parallax reveals.
- **GSAP Timelines & Staggering**: Sequence hero elements with coordinated delays; stagger reveal headlines, badges, CTAs, and cards (`stagger: 0.08`).
- **Kinetic Typography (SplitText)**: Animate text line-by-line or word-by-word with smooth vertical translations (`y: 40`, `opacity: 0`, `ease: "power3.out"`).
- **Anime.js Physics**: Use Anime.js for SVG line-drawing, morphing shapes, and spring-based magnetic button hover effects.
- **Performance & Cleanup**:
  - Always animate GPU-accelerated properties (`transform`, `opacity`).
  - Use `will-change: transform` on high-frequency animated elements.
  - Implement lifecycle cleanup (`gsap.context()` in React/frameworks or `ScrollTrigger.kill()` on unmount).

---

## 4. Signature Scroll Animation & Inertia Engine (ScrollTrigger + Lenis)
Consult: `gsap-scrolltrigger/`, `gsap-plugins/`, `gsap-performance/`

Every tier-1 website must feel alive as the user scrolls. Implement fluid inertia and scroll-driven choreography using the following signatures:

### A. Lenis Smooth Momentum Integration
- Integrate **Lenis** (or GSAP ScrollSmoother) for buttery inertial scrolling.
- Synchronize Lenis scroll updates directly with the GSAP ticker:
  ```javascript
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  ```

### B. The 6 Signature Scroll Archetypes
1. **The Sticky Card Peeling / Stack (Bento Stacking)**:
   - Cards pin to the viewport (`pin: true, scrub: 1`). As subsequent cards scroll in, preceding cards scale down slightly (`scale: 0.94`), dim, and stack beneath with layered z-indexes and subtle top blur.
2. **The Horizontal Scrub Runway**:
   - Pinned viewport container translating a wide track horizontally (`xPercent: -100 * (panels.length - 1)`), ideal for portfolios, client case studies, or timeline roadmaps.
3. **Kinetic Text Fill / Word-by-Word Reading Scrub**:
   - Editorial headlines and mission statements start with ghosted/muted text (`opacity: 0.15`). Words illuminate to 100% solid contrast sequentially as the scroll advances.
4. **Multi-Plane 3D Parallax Depth**:
   - Background generative meshes move at `0.25x` scroll speed, core content at `1.0x`, and foreground floating badges/metric chips float past at `1.45x` with subtle depth-of-field blur.
5. **Interactive SVG Pipeline Drawing**:
   - Animated SVG connector lines and feature path strokes draw themselves smoothly (`stroke-dashoffset` / GSAP DrawSVG / Anime.js) linked to scroll progress.
6. **Dynamic Floating Island Header Morph**:
   - Header begins transparent and unconstrained at the top. On scroll (>80px), it fluidly transitions into a centered, compact floating glass pill with heavy backdrop blur (`backdrop-filter: blur(20px)`), subtle border, and elevation.

### C. Scrub Smoothing & Mobile Guardrails
- **Buttery Momentum**: Never use `scrub: true` (which is jerky). Always supply a smooth catch-up value like `scrub: 1` or `scrub: 1.2`.
- **Responsive Media Query Guardrails (`gsap.matchMedia()`)**:
  - On viewports `< 768px`, disable complex horizontal scrub runways and multi-card pinning to preserve natural touch-scroll ergonomics. Fall back to clean vertical stacks.
- **Zero Scroll Jank**: Never animate `top`, `left`, `width`, `height`, or layout properties on scroll. Strictly animate GPU-accelerated `transform` (`x`, `y`, `scale`, `rotation`) and `opacity`.

---

## 5. Curated Component Libraries & Asset Ecosystem

When building UI components, layout blocks, interactive effects, and visual assets, integrate and adopt the design patterns from the following modern resources:

### A. Cutting-Edge Component Registries & UI Patterns
- **21st.dev**: Premium interactive components, animated card variants, glassmorphism headers, hero sections, and modern design blocks.
- **Kokonut UI**: Sleek, modern components, Bento grid items, smooth hover cards, and dynamic state transitions.
- **Skipper UI**: High-polish micro-interactions, floating dock navigation, animated menus, and badge notifications.
- **Vengeance UI**: High-impact dark-mode aesthetics, futuristic cyber accents, glowing borders, and tactile interactive elements.
- **Watermelon UI**: Clean, creative micro-components, minimal cards, and elegant modern utility elements.
- **componentry.fun**: Playful micro-interactions, experimental CSS/JS elements, creative cursor effects, and engaging toggle switches.
- **bolt.new**: Modern application ergonomics, full-stack layout architecture, fast responsive state flows, and production-grade polish.

### B. Generative Visual Assets & Textures
- **fffuel.co**: Generative SVG textures, organic SVG blobs, subtle noise/grain overlays (`opacity-[0.03]`), fluid SVG waves, SVG mesh gradients, and decorative geometric shapes. Never use flat blank backgrounds.

### C. Color Palette & Harmonization Systems
- **uicolors.app**: Curated 11-step color scales (50 to 950), balanced contrast ratios, bespoke HSL color tokens for primary, secondary, accent, surface, and border shades.

---

## 6. Master Frontend Skill Index & Activation Map

Before writing or modifying frontend code, check and execute the relevant domain skill from:
`C:\Users\Balaji\.agents\skills\MASTER-FRONTEND`

| Category | Skill Path / Directory | Core Mandates & Usage |
| :--- | :--- | :--- |
| **Comprehensive Review** | `skills-src/webdesign-review/SKILL.md` | Master design review orchestrating all domains |
| **Taste & Anti-Slop** | `design-taste-frontend/`<br>`high-end-visual-design/`<br>`gpt-taste/`<br>`stitch-design-taste/` | Taste dials, anti-default discipline, haptic micro-aesthetics, double-bezel cards |
| **Scroll & Motion** | `gsap-scrolltrigger/`<br>`gsap-core/`<br>`gsap-timeline/`<br>`gsap-plugins/`<br>`gsap-performance/` | Lenis momentum, 6 scroll archetypes, kinetic typography, pinning, GPU acceleration |
| **Core UI Design** | `skills-src/ui-design/SKILL.md`<br>`ui-design/`<br>`minimalist-ui/` | Grid systems, spacing scale, whitespace, container hierarchy, visual contrast |
| **Core UX & Flow** | `skills-src/ux-design/SKILL.md`<br>`skills-src/customer-journey/SKILL.md` | Information architecture, user flows, friction reduction, intuitive navigation |
| **Typography** | `skills-src/web-typography/SKILL.md` | Font pairing (display + sans/serif), fluid type scale (`clamp()`), line-height, letter-spacing |
| **Color & Mood** | `skills-src/color-theory/SKILL.md` | 60-30-10 rule, curated HSL palettes, dark mode depth, glassmorphism, accent harmony |
| **UI & Component Patterns** | `skills-src/ui-patterns/SKILL.md`<br>`skills-src/component-patterns/SKILL.md`<br>`ui-ux-pro-max/` | Hero sections, interactive feature grids, bento grids, pricing cards, proof bars, CTAs |
| **Conversion & Landing Pages** | `skills-src/landing-pages/SKILL.md` | High-converting structure, clear value props, social proof, zero-friction lead capture |
| **Branding & Visual Direction** | `skills-src/branding-identity/SKILL.md`<br>`skills-src/visual-direction/SKILL.md`<br>`brandkit/` | Consistent tone of voice, bespoke design tokens, brand personality |
| **Responsiveness & Media** | `skills-src/responsive-design/SKILL.md`<br>`skills-src/images-media/SKILL.md` | Mobile-first architecture, modern image formats (WebP/AVIF), SVG icons, fluid grids |
| **Accessibility & Usability** | `skills-src/accessibility/SKILL.md`<br>`skills-src/usability/SKILL.md` | WCAG 2.1 AA/AAA compliance, keyboard navigation, semantic HTML5, high readability |
| **AI / Agent UI** | `skills-src/agent-ui-design/SKILL.md` | Streaming animations, markdown rendering, chat interfaces, prompt suggestion chips |

---

## 7. Standard Operating Procedure (SOP) for Every Website Build

1. **Step 1 — Brief & Design Read**:
   - State the **Design Read** and set the three dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`).
   - Choose color scale tokens via **uicolors.app** and select premium typography pairings.
   - Generate ambient SVG textures/grain overlays inspired by **fffuel.co**.

2. **Step 2 — Architecture & Layout**:
   - Scaffold semantic HTML structure (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`).
   - Implement modern layout patterns (Asymmetrical Bento, Editorial Split, Z-axis Cascade).
   - Incorporate patterns from **21st.dev**, **Kokonut UI**, **Skipper UI**, **Vengeance UI**, **Watermelon UI**, and **componentry.fun**.

3. **Step 3 — Styling & Aesthetics (High-End Polish)**:
   - Apply the **Double-Bezel** container architecture, translucent borders, and subtle backdrop-blur (`backdrop-filter: blur(16px)`).
   - Construct **"Button-in-Button"** island CTAs with nested circular icon pills.
   - Ensure accessible text contrast with fluid `clamp()` sizing.

4. **Step 4 — Motion Choreography & Scroll Engine**:
   - Set up **Lenis** smooth scrolling synchronized with the GSAP ticker.
   - Implement appropriate **Signature Scroll Archetypes** (Sticky Bento stack, horizontal runway, text scrub, or parallax).
   - Stagger hero entrance elements and kinetic text line reveals.
   - Apply physics-based hover micro-interactions via **Anime.js** / CSS spring transforms.

5. **Step 5 — Verification & Pre-Flight Review**:
   - Audit mobile responsiveness (`gsap.matchMedia()` verifying asymmetric/horizontal desktop effects collapse gracefully on mobile).
   - Check touch targets, contrast ratios, and GPU performance (`will-change`).
   - Perform a final review against `webdesign-review/SKILL.md` before delivering to the user.

---

## 8. LinkedIn Automation & Drafting Protocols

Whenever drafting, editing, or publishing LinkedIn posts via MCP / API, **YOU MUST ALWAYS strictly adhere to the following rules**:

### A. Pre-Flight Draft Confirmation
- **Always Show First**: Present the complete, exact post draft (including attached media, links, and hashtags) to the user for review.
- **Never Auto-Publish**: Do not call `linkedin_create_text_post`, `linkedin_create_image_post`, `linkedin_create_article_post`, `update_linkedin_post`, or `delete_linkedin_post` without explicit user sign-off.

### B. Text Formatting & Anti-Truncation Rules
- **Automatic Little Text Escaping**: LinkedIn's `commentary` field parses text as a markup format. Always escape reserved characters (`\`, `(`, `)`, `[`, `]`, `{`, `}`, `<`, `>`, `*`, `_`, `~`, `@`, and non-hashtag `#`) with backslashes (e.g. `\(0.9188 AUC\)`). Failing to escape parentheses will cause LinkedIn's backend to silently truncate the post mid-sentence.
- **No Raw Markdown Code**: Never include raw markdown tags like `###`, `---`, or `**bold**` that do not render on LinkedIn. Use clean Unicode bullet points (`▪️`, `🔹`, `⚡`, `🚀`), structured emojis, and clean paragraph breaks.
- **Hook & Feed Layout Architecture**:
  - The first 3 to 4 lines appear above image attachments in the feed before the fold.
  - Front-load the hook, core metric, and repository/project link in the opening lines.

### C. Payload & Encoding Integrity
- **UTF-8 File Ingestion**: Always handle post payloads via dedicated UTF-8 files or Python string variables to avoid Windows PowerShell command-line escaping artifacts.
- **Immediate Verification**: After publishing, provide the live URL (`https://www.linkedin.com/feed/update/{urn}`) and verify the URN with the user.

