# ResponsiveMenu Component

Reusable responsive menu component that automatically adapts based on screen size:
- **Desktop (≥ md)**: Dropdown menu
- **Mobile (< md)**: Bottom drawer (slide-up modal)

## Features

- ✅ Smooth slide-up animation on mobile (using daisyUI `modal-bottom`)
- ✅ Fixed to viewport bottom on mobile
- ✅ Closes on option selection
- ✅ Closes on overlay click or ESC key
- ✅ Focus management (restores focus to trigger button on close)
- ✅ Accessible (ARIA labels, native dialog)

## Usage

```tsx
import ResponsiveMenu from "@/components/ui/ResponsiveMenu";
import { MoreVertical, Users, Settings } from "lucide-react";

<ResponsiveMenu
  trigger={<MoreVertical size={16} />}
  title="Menu Title"
  ariaLabel="Options menu"
>
  <li>
    <Link href="/users">
      <Users size={14} className="md:inline hidden" />
      <Users size={20} className="md:hidden" />
      Users
    </Link>
  </li>
  <li>
    <Link href="/settings">
      <Settings size={14} className="md:inline hidden" />
      <Settings size={20} className="md:hidden" />
      Settings
    </Link>
  </li>
</ResponsiveMenu>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `trigger` | `ReactNode` | required | Content for the trigger button (icon or text) |
| `title` | `string` | required | Title shown in mobile drawer |
| `children` | `ReactNode` | required | Menu items (`<li>` elements) |
| `triggerClassName` | `string` | `"btn btn-ghost btn-sm btn-circle"` | Custom classes for trigger button |
| `ariaLabel` | `string` | `"Menu"` | Accessible label for screen readers |

## Icon Sizing

For optimal UX, use different icon sizes for desktop and mobile:

```tsx
<Users size={14} className="md:inline hidden" />  {/* Desktop: 14px */}
<Users size={20} className="md:hidden" />         {/* Mobile: 20px */}
```

## Real-World Examples

### Board Menu

See `src/components/board/BoardLayout.tsx`:

```tsx
<ResponsiveMenu
  trigger={<MoreVertical size={16} />}
  title="Board menu"
  ariaLabel="Board menu"
>
  <li>
    <Link href={`/r/${slug}/member`}>
      <Users size={14} className="md:inline hidden" />
      <Users size={20} className="md:hidden" />
      Members
    </Link>
  </li>
  <li>
    <Link href={`/r/${slug}/ban`}>
      <ShieldBan size={14} className="md:inline hidden" />
      <ShieldBan size={20} className="md:hidden" />
      Bans
    </Link>
  </li>
</ResponsiveMenu>
```

### Post Actions Menu

See `src/components/post/PostActions.tsx`:

```tsx
<ResponsiveMenu
  trigger={<MoreHorizontal size={16} />}
  title="Post actions"
  triggerClassName="flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300"
  ariaLabel="Post actions"
>
  <li>
    <button onClick={handleEdit} className="w-full flex items-center gap-3">
      <Edit size={20} className="md:hidden" />
      <Edit size={16} className="hidden md:inline" />
      Edit post
    </button>
  </li>
  <li>
    <button onClick={handleDelete} className="w-full flex items-center gap-3 text-error">
      <Trash2 size={20} className="md:hidden" />
      <Trash2 size={16} className="hidden md:inline" />
      Delete post
    </button>
  </li>
</ResponsiveMenu>
```

### Member Management

See `src/components/board/BoardMemberManagement.tsx`:

```tsx
<ResponsiveMenu
  trigger={<MoreHorizontal size={16} />}
  title="Member actions"
  ariaLabel="Member actions"
>
  <li>
    <button onClick={() => kickMember(userId)}>
      <UserX size={20} className="md:hidden" />
      <UserX size={16} className="hidden md:inline" />
      Kick member
    </button>
  </li>
</ResponsiveMenu>
```

### Notification Actions

See `src/app/notifications/archive/page.tsx`:

```tsx
<ResponsiveMenu
  trigger={<MoreHorizontal size={16} className="text-[#818384]" />}
  title="Notification actions"
  triggerClassName="btn btn-ghost btn-circle btn-xs"
  ariaLabel="More options"
>
  <li>
    <button onClick={() => hideNotification(id)}>
      <EyeOff size={20} className="md:hidden" />
      <EyeOff size={16} className="hidden md:inline" />
      Remove from archive
    </button>
  </li>
</ResponsiveMenu>
```

## Technical Details

### Desktop (≥ md)
- Uses daisyUI `dropdown dropdown-end`
- Positioned in top-right corner
- Standard menu styling with `bg-base-200`

### Mobile (< md)
- Uses native `<dialog>` element with `modal modal-bottom`
- Slides up from bottom with animation
- Click on menu item automatically closes the drawer
- Backdrop click or ESC key also closes
- Focus returns to trigger button on close

## Accessibility

- ✅ Uses semantic `<dialog>` element
- ✅ `aria-label` on trigger button
- ✅ Focus management with `useRef` and `useEffect`
- ✅ ESC key support (native `cancel` event)
- ✅ Keyboard navigation supported
