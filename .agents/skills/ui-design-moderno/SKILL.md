---
name: ui-design-moderno
description: Guia e regras de design de interface moderno para estilização de componentes com Tailwind CSS, ícones Lucide React, espaçamentos consistentes (escala 4px/8px), sombras suaves em camadas e microinterações táteis/hover de alta fidelidade. Use ao criar ou refatorar telas, componentes, botões, modais, formulários e layouts modernos.
---

# UI Design Moderno: Regras, Padrões e Componentes

Esta skill estabelece o guia oficial de estilo e regras de implementação para criação e evolução de interfaces modernas, elegantes, táteis (mobile-first) e altamente responsivas.

---

## 1. Princípios Fundamentais

1. **Mobile-First & Tactile**: A experiência primária deve ser pensada para touch (alvos de toque de no mínimo 44px, `touch-manipulation`, micro-feedback tátil).
2. **Camadas & Profundidade Suave**: Substituir sombras pretas duras por combinações sutis de bordas translúcidas (`border-slate-200/80` ou `ring-1 ring-black/5`) com sombras difusas e com tom de cor.
3. **Microinterações Vivas**: Elementos interativos devem responder de imediato ao passar o mouse (`hover:-translate-y-0.5`, `hover:shadow-lg`) e ao toque (`active:scale-[0.98]` ou Framer Motion `whileTap={{ scale: 0.96 }}`).
4. **Espaçamento Matemático Rigoroso**: Todo espaçamento segue a escala de 4px / 8px do Tailwind.

---

## 2. Paleta de Cores e Superfícies (Tailwind CSS)

### Superfícies e Fundos
- **Fundo Principal (App/Site)**: `bg-[#F8FAFC]` ou `bg-slate-50` (evita o branco puro estourado `#FFF`, reduz fadiga visual).
- **Cards e Superfícies Elevadas**: `bg-white` com `rounded-2xl` ou `rounded-3xl`.
- **Glassmorphism Sutil**: `bg-white/80 backdrop-blur-md` ou `bg-slate-900/90 backdrop-blur-md` para cabeçalhos fixos e barras flutuantes.
- **Bordas Elegantes**: Nunca use cinza pesado escuro. Prefira:
  - Claro: `border border-slate-100` ou `border-slate-200/70`
  - Escuro/Overlay: `border border-white/10`
  - Anéis de acabamento: `ring-1 ring-black/5`

### Tipografia e Contraste
- **Títulos de Impacto**: `text-slate-900 font-extrabold tracking-tight`
- **Títulos Secundários**: `text-slate-800 font-bold`
- **Corpo e Parágrafos**: `text-slate-600 font-medium text-sm sm:text-base leading-relaxed`
- **Metadados e Rótulos Pequenos**: `text-xs text-slate-400 font-semibold uppercase tracking-wider`
- **Destaques de Marca**: `text-emerald-600` ou `text-emerald-700`

---

## 3. Ícones Lucide React: Padrões de Uso

### Importação e Limpeza
Importe apenas os ícones necessários diretamente de `lucide-react`:
```tsx
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
```

### Escala Padronizada de Tamanhos
| Função | Classes Tailwind | Uso Recomendado |
| :--- | :--- | :--- |
| **Micro / Metadado** | `w-3.5 h-3.5` | Badges, datas, contadores, tags inline |
| **Botões & Inputs** | `w-4 h-4` ou `w-5 h-5` | Ícones de ação em botões, campos de texto |
| **Badges de Destaque** | `w-6 h-6` | Ícones dentro de círculos de destaque / recursos |
| **Hero / Empty States**| `w-8 h-8` a `w-12 h-12`| Cabeçalhos de seção, ilustrações vazias, destaques |

### Boas Práticas com Ícones
1. **Espessura Elegante**: Mantenha espessura padrão ou mais fina (`stroke-[1.75]` ou `stroke-[2]`).
2. **Alinhamento Óptico**: Sempre envolva o ícone em flexbox com gap explícito:
   ```tsx
   <div className="inline-flex items-center gap-2">
     <Check className="w-4 h-4 text-emerald-600 shrink-0" />
     <span>Confirmado</span>
   </div>
   ```
3. **Cores Dinâmicas**: Ícones neutros no estado repouso que ganham cor no hover do grupo:
   ```tsx
   <div className="group flex items-center gap-3">
     <Sparkles className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
     <span className="text-slate-700 font-semibold">Recurso Inteligente</span>
   </div>
   ```

---

## 4. Espaçamento Consistente (Escala 4px / 8px)

Nunca use valores mágicos arbitrários (como `p-[13px]`). Use a grade do Tailwind:

- **Gaps Internos Rápidos**: `gap-1.5` (6px) para ícone + texto, `gap-2` (8px) para botões compactos.
- **Gaps de Lista / Form**: `gap-3` (12px) ou `gap-4` (16px) entre campos.
- **Paddings de Componentes**:
  - **Pill / Badge**: `px-3 py-1` ou `px-2.5 py-0.5`
  - **Botão Compacto**: `px-4 py-2 text-xs sm:text-sm`
  - **Botão Principal (CTA)**: `px-5 py-3.5 sm:px-6 sm:py-4 text-sm sm:text-base min-h-[48px]`
  - **Cards Padrão**: `p-5 sm:p-6 lg:p-8`
- **Seções da Página**:
  - `py-12 sm:py-16 lg:py-24` para espaçamento respirável entre blocos.
  - `space-y-4` ou `space-y-6` para pilhas verticais de cards.

---

## 5. Sombras Suaves e Elevação em Camadas

Substitua a sombra cinza padrão por sombras em camadas coloridas e suaves:

### Nível 1: Card Estático / Superfície Sutil
```tsx
className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50"
```

### Nível 2: Card Interativo com Hover Lift
```tsx
className="bg-white rounded-2xl border border-slate-200/70 shadow-md shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/40 hover:-translate-y-1 hover:border-emerald-200 transition-all duration-200 ease-out"
```

### Nível 3: Botão de Ação com Glow Colorido (Primary CTA)
```tsx
className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
```

### Nível 4: Modais, Drawers e Menus Flutuantes
```tsx
className="bg-white/95 backdrop-blur-xl rounded-[28px] border border-slate-100 shadow-2xl shadow-black/10 ring-1 ring-black/5"
```

---

## 6. Microinterações e Feedback Visual

### Transições Recomendadas
- Transição padrão para hover: `transition-all duration-200 ease-out`
- Transição ultra-rápida para clique: `duration-100` ou `duration-150`

### Seta Deslizante em Botões (Microinteraction)
Ao passar o mouse no botão, o ícone de seta avança 2px a 4px suavemente:
```tsx
<button className="group inline-flex items-center gap-2 ...">
  <span>Continuar</span>
  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
</button>
```

### Ícone com Rotação / Pulso no Hover
```tsx
<button className="group ...">
  <Sparkles className="w-4 h-4 text-amber-500 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
</button>
```

### Foco e Acessibilidade (Focus Visible)
Sempre forneça anel de foco visível e elegante para navegação por teclado:
```tsx
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
```

---

## 7. Biblioteca de Componentes Prontos de Referência

### A. Botão Primário Moderno (CTA)
```tsx
import { ArrowRight, Sparkles } from "lucide-react";

export function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 touch-manipulation"
    >
      <span>{children}</span>
      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
    </button>
  );
}
```

### B. Card Interativo de Destaque
```tsx
import { TrendingUp, ArrowUpRight } from "lucide-react";

export function FeatureCard({ title, description, badge }: { title: string; description: string; badge: string }) {
  return (
    <div className="group relative bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-md shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/40 hover:-translate-y-1 hover:border-emerald-200 transition-all duration-200 ease-out cursor-pointer">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 shadow-xs">
          <TrendingUp className="w-6 h-6 stroke-[2]" />
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/60 group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors">
          {badge}
        </span>
      </div>

      <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center justify-between">
        <span>{title}</span>
        <ArrowUpRight className="w-4 h-4 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200 text-emerald-600" />
      </h3>
      <p className="text-slate-600 text-sm mt-2 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
```

### C. Campo de Formulário Moderno com Ícone e Focus Ring
```tsx
import { Search } from "lucide-react";

export function ModernInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
        <Search className="w-4 h-4 stroke-[2]" />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-slate-200/80 text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-150"
      />
    </div>
  );
}
```

### D. Badge / Tag com Ponto Pulsante
```tsx
export function LiveBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold shadow-xs">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span>{label}</span>
    </span>
  );
}
```

---

## 8. Checklist Rápido de Qualidade UI

Antes de dar um componente ou tela como finalizada, valide:
- [ ] **Alvos de toque**: Todos os botões e links possuem ao menos 44px de altura ou padding de toque adequado no mobile (`min-h-[44px]`).
- [ ] **Bordas**: As bordas são suaves (`border-slate-100` ou `border-slate-200/80`) e nunca pretas ou cinza escuro pesado.
- [ ] **Sombras**: Utilizou sombras com opacidade atenuada (`shadow-slate-200/50` ou `shadow-emerald-600/20`).
- [ ] **Ícones Lucide**: Estão alinhados opticamente (`flex items-center gap-X`) e com espessura coerente (`stroke-[1.75]` a `stroke-[2]`).
- [ ] **Microinterações**: O componente reage ao hover (`hover:-translate-y-0.5`, `hover:shadow-...`) e ao clique (`active:scale-[0.98]`).
- [ ] **Legibilidade**: Os textos respeitam o contraste (mínimo WCAG AA: `text-slate-900` para títulos, `text-slate-600` para corpo).
