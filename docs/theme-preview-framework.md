# Theme Preview Framework Design

This document outlines the architecture, design philosophy, and implementation details of the DaisyUI Theme Preview system implemented at `/preview/theme`.

## 1. Purpose

The `/preview/theme` page serves as an interactive playground for developers and designers to:

- **Visualize** how Tailwind v4 and DaisyUI theme variables affect various UI components.
- **Prototype** color schemes in real-time using live color pickers.
- **Export** finalized CSS variables directly into `globals.css`.
- **Audit** project-specific custom components (`Avatar`, `VotePill`, etc.) against theme changes.

## 2. Architecture & Design

### Technology Stack

- **Tailwind CSS v4**: Utilizes the `@theme` block in CSS for variable definition.
- **DaisyUI**: Provides the CSS component framework and theme system (`light`, `black`).
- **React (Next.js)**: Manages local state for color adjustments and tabbed navigation.
- **Dynamic CSS Injection**: Uses a `<style>` tag to override global CSS variables with local state values in real-time.

### Data Model

Colors are managed via constants in `page.tsx`:

- `PRIMARY_COLORS`: Core DaisyUI variables (`--color-primary`, `--color-secondary`, etc.).
- `STATE_COLORS`: Semantic feedback colors (`--color-info`, `--color-success`, etc.).

```typescript
type ThemeColor = {
  name: string;
  variable: string;
  defaultVal: string;
};
```

## 3. Core Implementation Details

### Live Color Preview

The page maintains a `colors` state object. A `useEffect` hook generates a CSS string that targets the `:root` and applies these overrides. This ensures the preview is non-destructive to the actual global theme until the user chooses to copy-paste.

```typescript
useEffect(() => {
  const css = `:root { ${Object.entries(colors)
    .map(([v, c]) => `${v}: ${c};`)
    .join(" ")} }`;
  const style = document.createElement("style");
  style.innerHTML = css;
  document.head.appendChild(style);
  return () => document.head.removeChild(style);
}, [colors]);
```

### Tabbed Organization

To keep the interface clean, previews are grouped into logical sections:

1. **Colors**: Primary controls for theme variables.
2. **Buttons**: Variants, sizes, and states.
3. **Inputs**: Form elements and validation states.
4. **Badges**: Status indicators and flair badges.
5. **Typography**: Font family and heading hierarchy verification.
6. **Feedback**: Alerts and `react-hot-toast` notifications.
7. **Components**: Project-specific UI components (`Avatar`, `SearchBar`, `VotePill`).

## 4. Extension Guidelines

### Adding New DaisyUI Components

1. Locate the relevant tab section in `src/app/preview/theme/page.tsx`.
2. Wrap the new component in a responsive container (e.g., `flex wrap gap-4`).
3. Use DaisyUI classes (e.g., `btn`, `input`, `badge`) or project-specific components.

### Adding New Theme Variables

1. Add the variable definition to `PRIMARY_COLORS` or `STATE_COLORS`.
2. Update the `initialColors` state in the `ThemePreviewPage` component.
3. The color picker will automatically render in the **Colors** tab.

## 5. Deployment & Usage

The preview page is intended for development environments only but can be served in production if password-protected or restricted to admin routes. Users can customize their theme, click **Copy CSS Vars**, and paste the output into the `@theme` block of `src/app/globals.css`.
