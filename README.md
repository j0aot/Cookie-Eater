# 🍪 Cookie Rejector

Extensão para Chrome/Edge que automaticamente:
- **Rejeita banners de cookies** em milhares de sites
- **Bloqueia trackers e analytics** na rede (Google Analytics, Facebook Pixel, Hotjar, etc.)

---

## Instalação

### Chrome / Edge / Brave

1. Abra o navegador e vá para `chrome://extensions`
2. Ative o **"Modo do desenvolvedor"** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `cookie-rejector`
5. ✅ Pronto! O ícone aparecerá na barra de ferramentas.

### Firefox

> O Firefox usa Manifest V2. Para portar, ajuste o manifest e use `browser.*` ao invés de `chrome.*`.

---

## O que é bloqueado

### Banners de cookies (auto-clique em "Rejeitar")
- OneTrust, Cookiebot, Didomi, Axeptio, Klaro, CookieHub, Quantcast CMP, TrustArc, e muito mais
- Detecção por seletores CSS e por texto do botão (PT, EN, ES, FR, DE)
- Retry automático para banners carregados com atraso

### Trackers bloqueados na rede (declarativeNetRequest)
| Categoria | Serviços |
|---|---|
| Analytics | Google Analytics, Matomo, Piwik PRO, Amplitude, Mixpanel, Segment |
| Heatmaps | Hotjar, Mouseflow, Crazy Egg, FullStory, Microsoft Clarity, LogRocket, Heap |
| Ads | Facebook Pixel, Google Tag Manager, DoubleClick, Twitter Ads, LinkedIn Insight, Bing Ads, Pinterest, TikTok Ads |
| Monitoramento | Sentry, Bugsnag, New Relic, Datadog |
| Chat/CRM | Intercom |

---

## Estrutura de arquivos

```
cookie-rejector/
├── manifest.json      # Configuração da extensão (Manifest V3)
├── content.js         # Script injetado nas páginas (rejeita banners)
├── background.js      # Service worker (estatísticas)
├── rules.json         # Regras de bloqueio de rede (40 domínios)
├── popup.html         # Interface do popup
├── popup.js           # Lógica do popup
└── icons/             # Ícones (adicione icon16.png, icon48.png, icon128.png)
```

---

## Adicionar ícones

Coloque imagens PNG na pasta `icons/`:
- `icon16.png` — 16×16 px
- `icon48.png` — 48×48 px  
- `icon128.png` — 128×128 px

Ou remova a seção `"icons"` do `manifest.json` para usar o ícone padrão do Chrome.

---

## Limitações conhecidas

- Alguns sites com banners muito customizados podem não ser detectados automaticamente
- O bloqueio de rede não remove scripts já embutidos no HTML (inline scripts)
- Para Firefox, é necessário adaptar para Manifest V2

---

## Contribuir / Expandir

Para adicionar mais seletores de rejeição, edite o array `REJECT_SELECTORS` em `content.js`.  
Para bloquear mais domínios de tracking, adicione entradas em `rules.json` (máximo 5000 regras no MV3).
