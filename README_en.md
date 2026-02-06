# AI Image Quality Analyzer - V1

## Overview

**AI Image Quality Analyzer** is a privacy-first browser tool that helps photographers quickly assess and improve their work through intelligent AI analysis. It features zero-backend storage architecture, provides multi-persona evaluation from 5 photographer styles, and delivers real-time feedback across 4 dimensions (composition, lighting, color, subject), along with actionable Lightroom/Photoshop retouching steps.

**Key Features:**

- 🔐 **Zero Backend Storage**: All processing happens in your browser; images never upload to servers
- 🎯 **Multi-Persona AI**: 5 photographer style evaluations (Cartier-Bresson, Ansel Adams, Fan Ho, Peter Lindbergh, Kodak Portra)
- 📊 **Structured Feedback**: 4-dimension scoring with detailed reasoning
- 🖼️ **Plug-and-Play Export**: Generate Lightroom-compatible XMP files
- ⚡ **Privacy-First**: Auto EXIF cleanup, encrypted API keys, data cleared on refresh

---

## Quick Start

### 1. Upload Photo

- Drag & drop or click to upload JPEG, PNG, WebP formats
- Max size: 50MB (recommend ≤10MB)
- EXIF data auto-extracted and cleaned (privacy protection)

### 2. Choose Evaluation Style

Select from 5 photographer styles:

- **Street Narrative**: Decisive moments, compositional narrative (Cartier-Bresson)
- **Landscape Epic**: Tonal range, depth layers (Ansel Adams)
- **Urban Geometry**: Light-shadow geometry, minimalism (Fan Ho)
- **Portrait Texture**: Texture fidelity, eye light, naturalness (Peter Lindbergh)
- **Film Color**: Soft tones, color richness (Kodak Portra)

### 3. Get AI Scores

Get instant 4-dimension scoring:

- ✅ **Composition**: Subject placement, visual flow, negative space
- ✅ **Lighting**: Exposure accuracy, contrast, light quality
- ✅ **Color**: Tonal harmony, saturation, color mood
- ✅ **Subject**: Sharpness, focus accuracy, texture richness

### 4. Export Results

- Download Lightroom XMP sidecar file for one-click import
- Review retouching steps (exposure, clarity, tone curves, etc.)
- Support iterative evaluation with task linking

---

## Features

### Image Upload & Processing

- **Drag-drop or click** to upload JPEG, PNG, WebP, HEIC, RAW formats
- **Auto-compression** via Canvas API (4096px max edge, 0.85 JPEG quality)
- **EXIF Cleanup**: Remove location & device S/N, keep exposure data (ISO, aperture, shutter)
- **File limits**: Max 50MB per file; ≤10MB recommended for best performance

### Style Recognition

- Auto multi-label classification (urban, documentary, landscape, portrait, street, etc. - 10 categories)
- Top-3 style weights guide Agent recommendations
- Lightweight rule engine (MVP) or MobileNet model (Phase 2)

### AI Multi-Persona Evaluation

- **5 photographer styles** with unique aesthetic standards
- **4-dimension scoring** (composition, lighting, color, subject), 0-100 scale + reasoning
- **Dynamic prompting** combining system, agent-specific, EXIF, and style context
- **Multi-AI provider support**: OpenAI Vision, Google Gemini, Claude 3

### Retouching Guidance

- **Structured steps** (Lightroom/Photoshop) with specific parameters
- **Parameter mapping** directly corresponds to Lightroom slider adjustments
- **Style-aware suggestions** based on chosen photographer style
- **XMP sidecar generation** for direct Lightroom import

### Local History & Task Linking

- **IndexedDB storage** of last 10 evaluations with thumbnails
- **Task linking** via parentTaskId for iterative improvement workflow
- **One-click re-evaluation** with history browsing
- **One-button data clear** removes all local data

---

## System Architecture

```
Browser SPA (Vite + React 18 + Tailwind + ShadcnUI)
├── Upload & Preprocessing
│   ├── Canvas compression & format conversion
│   ├── EXIF extraction & cleanup
│   └── Thumbnail generation
├── Style Recognition
│   ├── Rule engine (MVP) or MobileNet (Phase 2)
│   └── Top-3 label weighting
├── Agent Recommendation
│   ├── Tag-to-persona matching
│   └── Scoring algorithm
├── Dynamic Prompt Assembly
│   ├── System prompt templates
│   ├── Agent-specific prompts
│   ├── EXIF context injection
│   └── Style tag context
├── AI API Integration
│   ├── OpenAI Vision
│   ├── Google Gemini Pro Vision
│   └── Anthropic Claude 3
├── Result Validation
│   ├── JSON schema validation
│   └── Error handling & fallbacks
├── Result Display
│   ├── Radar chart (4 dimensions)
│   ├── Score cards
│   └── Step-by-step guidance
└── Export Engine
    ├── XMP sidecar generation
    └── Preset file downloads

Storage:
├── IndexedDB: Task history (max 10)
└── LocalStorage: Encrypted API keys (AES-GCM)
```

---

## Photographer Styles

| Style                | Representative        | Focus                                          |
| :------------------- | :-------------------- | :--------------------------------------------- |
| **Street Narrative** | Henri Cartier-Bresson | Decisive moments, compositional story, tension |
| **Landscape Epic**   | Ansel Adams           | Tonal range, depth, horizon balance            |
| **Urban Geometry**   | Fan Ho                | Light-shadow geometry, minimalism, contrast    |
| **Portrait Texture** | Peter Lindbergh       | Texture fidelity, eye light, naturalness       |
| **Film Color**       | Kodak Portra          | Soft tones, highlight rolloff, color layers    |

---

## Technology Stack

| Layer              | Technology           | Purpose                  |
| :----------------- | :------------------- | :----------------------- |
| **Build**          | Vite 5.0+            | Fast bundling & HMR      |
| **Framework**      | React 18+            | UI components & state    |
| **Styling**        | Tailwind 3.3+        | Design system            |
| **Components**     | ShadcnUI             | Professional UI kit      |
| **Language**       | TypeScript 5.0+      | Type safety              |
| **State**          | Zustand              | State management         |
| **Storage**        | IndexedDB (Dexie.js) | Local task history       |
| **Encryption**     | Web Crypto API       | AES-GCM key storage      |
| **Images**         | Canvas API, exif-js  | Compression & EXIF       |
| **AI Integration** | LangChain.js         | Multi-vendor abstraction |
| **Deployment**     | Vercel / Netlify     | Static hosting           |

---

## Development Roadmap

### Phase 1: MVP (Weeks 1-2)

**Goal**: Core upload-to-evaluation workflow

**Key Tasks**:

- [ ] Project initialization (Vite + React + TypeScript)
- [ ] Image upload & Canvas compression
- [ ] EXIF extraction & cleanup
- [ ] Style recognition (rule engine)
- [ ] AI evaluation & prompt assembly
- [ ] Result display & XMP export
- [ ] Error handling & fallback strategies

**Acceptance Criteria**:

- Users can upload images and get AI evaluation
- 4-dimension scoring with detailed reasoning
- XMP export works in Lightroom

### Phase 2: Enhancement (Weeks 3-4)

**Goal**: Improve UX, add persistence & export features

**Key Tasks**:

- [ ] IndexedDB history storage
- [ ] Task linking & re-evaluation
- [ ] Style recognition upgrade (MobileNet)
- [ ] Multi-AI provider support
- [ ] Mobile responsive layout
- [ ] Loading states & error messages

**Acceptance Criteria**:

- 10 history records with thumbnails
- Mobile UI fully functional
- All providers available (OpenAI/Gemini/Claude)

### Phase 3: Optimization (Weeks 5-6)

**Goal**: Advanced features, performance & cost control

**Key Tasks**:

- [ ] RAW format support (.ARW)
- [ ] HEIC format support
- [ ] Image hash deduplication
- [ ] PWA offline support
- [ ] Custom Agent configuration
- [ ] Cost monitoring & quotas

**Acceptance Criteria**:

- RAW/HEIC format support
- Duplicate images use cache (zero cost)
- PWA works offline

---

## Core Design Principles

### Zero Backend Storage

✅ Images never upload to servers  
✅ No database persistence  
✅ All computation in-browser  
✅ Refresh clears all data

### Privacy-First

✅ EXIF auto-cleanup (location removed)  
✅ API keys encrypted locally (AES-GCM)  
✅ No third-party tracking  
✅ Optional "burn after reading" mode

### Static Deployment

✅ Vercel, Netlify, GitHub Pages compatible  
✅ CORS proxy for API calls  
✅ Zero server maintenance  
✅ Global CDN distribution

### BYOK Model (Bring Your Own Key)

✅ Users provide their own API keys  
✅ No account registration needed  
✅ No subscription fees  
✅ Complete cost transparency

---

## Getting Started

### Installation

```bash
git clone <repository-url>
cd ai-image
npm install
npm run dev
```

### Configuration

1. **Add API Keys** (Settings panel):
   - OpenAI Vision: https://platform.openai.com/api-keys
   - Google Gemini: https://aistudio.google.com/app/apikey
   - Claude: https://console.anthropic.com/account/keys

2. **Key Storage**:
   - AES-GCM encrypted
   - Stored only in browser localStorage
   - Never sent to third parties

3. **First Evaluation**:
   - Click "Upload Photo" or drag file
   - Wait for style recognition (~1-2s)
   - View recommended Agent
   - Select preferred style
   - Review results & download XMP

---

## API Cost Estimation

| Provider                   | Per-Image Cost | Notes                           |
| :------------------------- | :------------- | :------------------------------ |
| **OpenAI Vision (GPT-4V)** | ~$0.015-0.03   | Based on prompt & output length |
| **Google Gemini Pro**      | ~$0.005-0.01   | Character-based billing         |
| **Claude 3 Vision**        | ~$0.005-0.015  | Similar to Gemini               |

**Cost Optimization**:

- Image hash deduplication: Save 20-30%
- Style pre-filtering: Skip low-confidence images
- User quotas: 5 free images/day

---

## Security & Compliance

### Data Protection

- EXIF cleanup: Remove GPS, device S/N
- Key encryption: AES-GCM 256-bit (Web Crypto API)
- No third-party services: Zero tracking
- Threat model: API key leakage, prompt injection

### GDPR Compliance

✅ Data minimization (images not stored)  
✅ User consent on first use  
✅ "Clear all data" button  
✅ No personal data collection

---

## Documentation

- 📖 **Full Technical Spec**: [V1_TECHNICAL_SPEC_EN.md](V1_TECHNICAL_SPEC_EN.md)
- 🌐 **Chinese Version**: [README_cn.md](README_cn.md)
- 📊 **Sync Status**: [SYNC_STATUS.md](SYNC_STATUS.md)
- ✅ **Completion Checklist**: [COMPLETION_CHECKLIST.md](COMPLETION_CHECKLIST.md)

---

## Support

- 🐛 **Report Issues**: [GitHub Issues](../../issues)
- 💬 **Discussions**: [GitHub Discussions](../../discussions)
- 📧 **Contact**: [contact-info]

---

## License

MIT License - See LICENSE file

---

**Last Updated**: 2026-01-28  
**Status**: ✅ Ready for Phase 1 development  
**Version**: 1.0.0
