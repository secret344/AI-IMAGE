# AI Image Quality Analyzer - V1

[中文版 README](README_cn.md)

## Overview

**AI Image Quality Analyzer** is a privacy-first browser tool for photographers to assess and improve their work through AI analysis. It features zero-backend storage, multi-persona evaluation from 5 photographer styles, and detailed scoring across 4 dimensions (composition, lighting, color, subject).

**Supported Languages**: English, Simplified Chinese, Japanese

**Key Features:**

- 🔐 **Privacy-First**: All processing in-browser; images never upload to servers
- 🎯 **5 Photographer Personas**: Cartier-Bresson, Ansel Adams, Fan Ho, Peter Lindbergh, Kodak Portra
- 📊 **4-Dimension Scoring**: Composition, Lighting, Color, Subject (0-100 scale)
- 💬 **AI-Powered Discussion**: Chat with evaluation results for deeper analysis
- 🖼️ **XMP Export**: Direct Lightroom integration
- 🔑 **BYOK Model**: Bring your own API keys (no subscriptions)

---

## Quick Start

1. **Upload** → Drag & drop JPEG, PNG, WebP (≤50MB recommended ≤10MB)
2. **Wait** → Auto style recognition (~1-2s)
3. **Review** → Select photographer style and view AI scores
4. **Discuss** → Chat with the agent to explore deeper insights
5. **Export** → Download Lightroom XMP sidecar file

---

## Features

### Core Workflow

- **Image Upload**: Drag-drop or click; auto Canvas compression (4096px max, 0.85 quality)
- **Style Recognition**: Rule engine classification into 16 style categories
- **AI Evaluation**: Multi-persona scoring with dimension-specific reasoning
- **Result Discussion**: Chat with AI to explore feedback and ask follow-up questions
- **Smart History**: IndexedDB storage of last 10 evaluations with one-click re-evaluation
- **XMP Export**: Generate Lightroom-compatible sidecar files

### Photographer Styles

| Style            | Photographer    | Focus                             |
| :--------------- | :-------------- | :-------------------------------- |
| Street Narrative | Cartier-Bresson | Decisive moments, composition     |
| Landscape Epic   | Ansel Adams     | Tonal range, depth                |
| Urban Geometry   | Fan Ho          | Light/shadow geometry, minimalism |
| Portrait Texture | Peter Lindbergh | Texture, eye light, naturalness   |
| Film Color       | Kodak Portra    | Soft tones, color richness        |

### Privacy & Security

- **EXIF Cleanup**: Remove GPS, device S/N; keep exposure data
- **Key Encryption**: AES-GCM 256-bit local storage
- **Offline Processing**: No backend needed
- **GDPR Compliant**: No tracking, one-button data clear

---

## Technology Stack

| Component      | Technology            | Purpose           |
| :------------- | :-------------------- | :---------------- |
| **Build**      | Vite 5.0+             | Fast bundling     |
| **Framework**  | React 18 + TypeScript | UI & logic        |
| **Styling**    | Tailwind + ShadcnUI   | Design system     |
| **State**      | Zustand               | Global state      |
| **Storage**    | IndexedDB (Dexie)     | Task history      |
| **Crypto**     | Web Crypto API        | AES-GCM keys      |
| **i18n**       | react-i18next         | EN/ZH/JP support  |
| **AI**         | OpenAI/Gemini/Claude  | Evaluation engine |
| **Deployment** | Vercel/Netlify        | Static hosting    |

---

## Installation & Setup

```bash
# Clone repository
git clone <repository-url>
cd ai-image

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check
```

### Configuration

1. **Add API Keys** in Settings panel:
   - OpenAI Vision: https://platform.openai.com/api-keys
   - Google Gemini: https://aistudio.google.com/app/apikey
   - Claude: https://console.anthropic.com (for testing)

2. **Keys are encrypted locally** (AES-GCM) and never sent to third parties

3. **For local development with Ollama**:
   - Install Ollama: https://ollama.ai
   - Pull a vision model: `ollama pull llama2-vision`
   - No API key needed

---

## Design Principles

### 🔐 Privacy First

- Images never uploaded to servers
- All computation in-browser
- EXIF data auto-cleaned (GPS, serial numbers removed)
- API keys encrypted locally (AES-GCM 256-bit)

### 💰 BYOK Model (Bring Your Own Key)

- No account required
- No subscriptions
- Full cost transparency
- Users control their API spending

### ⚡ Zero Backend

- Static deployment only (Vercel/Netlify/GitHub Pages)
- No server maintenance
- Global CDN support
- Optional CORS proxy for API calls

---

## API Cost Guidelines

| Provider        | Per-Image Cost | Notes                        |
| :-------------- | :------------- | :--------------------------- |
| OpenAI Vision   | ~$0.01-0.03    | Based on image size + prompt |
| Google Gemini   | ~$0.005-0.01   | Character-based billing      |
| Claude 3 Vision | ~$0.01-0.02    | Input/output tokens          |

**Cost Tips**:

- Use Ollama for local, free evaluation
- Re-evaluate same image with same agent = zero cost (cached)
- Message history is automatically limited to prevent token bloat

---

## Security & Privacy

### Data Protection

- **EXIF Cleanup**: Removes GPS coordinates, device serial numbers
- **Key Encryption**: AES-GCM 256-bit encryption for all API keys
- **Local Only**: Images stored only in IndexedDB; never transmitted
- **No Tracking**: Zero third-party analytics or cookies

### GDPR Compliant

- Data minimization (images not persisted on servers)
- One-click "Clear All Data" option
- No personal data collection
- Optional encrypted passphrase for key storage

---

## Documentation & Support

- 📖 **Technical Specification**: [V1_TECHNICAL_SPEC_EN.md](V1_TECHNICAL_SPEC_EN.md)
- 🌐 **中文 README**: [README_cn.md](README_cn.md)
- ✅ **Completion Checklist**: [COMPLETION_CHECKLIST.md](COMPLETION_CHECKLIST.md)
- 🔄 **Sync Status**: [SYNC_STATUS.md](SYNC_STATUS.md)

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear description

## License

MIT License - See LICENSE file

---

**Version**: 1.0.0  
**Status**: ✅ Active Development  
**Last Updated**: 2026-02-08
