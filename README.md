# Rupantor

**Rupantor** (রূপান্তর) is a web-based language conversion platform that transforms text between Bengali, Banglish, and English while applying 13 distinct emotional/tone registers. Built with modern web technologies and powered by Google's Gemini AI, it delivers corrections, translations, and stylistic transformations with a polished liquid-glass UI.

## 📖 Overview

Rupantor bridges language barriers by converting text across three languages with unique tone styling:

- **Multilingual Support**: Bengali (Bangla), Banglish (Romanized Bengali), and English
- **13 Tone Registers**: Professional, Semi-Professional, Friendly, Lovely, Sad, Funny, Angry, Informal, Optimistic, Pessimistic, Sarcastic, Serious, and Normal
- **Gemini AI-Powered**: Leverages Google Gemini models for accurate semantic conversion
- **History Persistence**: Conversion history stored in browser localStorage
- **Theme Support**: Light and dark mode with smooth animated transitions
- **One-Click Copy**: Copy results and semantic registers instantly
- **Client-Side**: 100% runs in browser, no server connected

### 📸 Screenshot

![Rupantor Screenshot](assets/screenshots/dark-mode.png#gh-dark-mode-only)


## 🛠 Tech Stack

![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=white&style=for-the-badge)
![Vite](https://img.shields.io/badge/-Vite-646CFF?logo=vite&logoColor=white&style=for-the-badge)
![Tailwind](https://img.shields.io/badge/-TailwindCSS-38B2AC?logo=tailwind-css&logoColor=white&style=for-the-badge)
![Framer](https://img.shields.io/badge/-Framer%20Motion-0055FF?logo=framer&logoColor=white&style=for-the-badge)
![Lucide](https://img.shields.io/badge/-Lucide-000000?logo=lucide&logoColor=white&style=for-the-badge)
![Recharts](https://img.shields.io/badge/-Recharts-F68B1E?logo=recharts&logoColor=white&style=for-the-badge)
![Supabase](https://img.shields.io/badge/-Supabase-3ECF8E?logo=supabase&logoColor=white&style=for-the-badge)
![DnD](https://img.shields.io/badge/-@dnd--kit-8B5CF6?logo=react&logoColor=white&style=for-the-badge)


## 🚀 Deployment

<p style="background: #1e293b; padding: 12px; border-radius: 8; margin: 16px 0;">
  <strong>Live Demo:</strong> <a href="https://rupantor.vercel.app" style="color: #a78bfa; text-decoration: none;">https://rupantor.vercel.app</a> |
  <strong>Platform:</strong> Vercel
</p>

```bash
# Deploy to Vercel
vercel
vercel --prod
```

## 📦 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# TypeScript type check
npm run typecheck
```

## 🔐 API Setup

1. Obtain a free Google AI Studio API key: <https://aistudio.google.com/api-keys>
2. Enter the key via the modal interface or store in localStorage
3. The app will auto-detect available Gemini models


## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

*Rupantor - One language, many forms*