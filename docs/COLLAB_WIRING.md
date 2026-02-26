# Real-Time Collaboration -- Integration Reference

This document describes how to wire the existing real-time collaboration hooks and UI components into the Studio editor. The hooks and components were built in v0.6.0 but are not yet imported or used. Integration is planned for [v0.11.0](releases/v0.11.0.md).

---

## What Already Exists

- **Hook**: `useRealtimeCollaboration()` in `apps/web/lib/studio/realtime.ts` -- subscribes to Supabase Realtime channel `screen:${screenId}`, tracks presence, broadcasts spec updates
- **User hook**: `useCurrentUser()` in the same file -- gets authenticated user's ID and name
- **UI components** in `apps/web/components/studio/presence-indicators.tsx`:
  - `PresenceAvatars` -- coloured circles with initials in the top bar
  - `PresenceCursors` -- coloured cursor SVGs positioned on the canvas
  - `PresenceNodeHighlights` -- CSS outlines on nodes selected by remote users

None of these are currently imported or used anywhere.

---

## Integration Points

### 1. EditorLayout -- initialise collab and render presence avatars

In `apps/web/components/studio/editor-layout.tsx`:

- Import `useRealtimeCollaboration`, `useCurrentUser` from `@/lib/studio/realtime`
- Import `PresenceAvatars`, `PresenceNodeHighlights` from `./presence-indicators`
- Call `useCurrentUser()` to get the authenticated user
- Call `useRealtimeCollaboration(screenName, user?.id, user?.name, callbacks)` with:
  - `onRemoteSpecChange`: call `setSpec()` to apply remote tree updates
  - `onPresenceChange`: no-op (state managed inside the hook)
- Pass `presenceUsers` to `PresenceAvatars` in the TopBar
- Render `PresenceNodeHighlights` at the top of the editor (injects CSS)
- On node selection change: call `updatePresence({ selectedNodeId })`
- On save: call `broadcastSpecUpdate(spec.tree)` after successful save

### 2. TopBar -- show presence avatars

Add a `presenceUsers` prop to the TopBar and render `PresenceAvatars` between the screen name and the action buttons.

### 3. EditorCanvas -- track mouse and render remote cursors

In `apps/web/components/studio/editor-canvas.tsx`:

- Accept `presenceUsers` and `onMouseMove` callback as props
- Attach an `onMouseMove` handler to the canvas wrapper that calls `updatePresence({ cursor: { x, y } })` (throttled to ~50ms)
- Render `PresenceCursors` inside the canvas container (absolute positioned)

### 4. Guard for non-Supabase mode

The hooks already check for `currentUserId` being null and no-op. `useCurrentUser()` returns null when not authenticated. In filesystem mode, collab simply won't activate -- no conditional wrapping needed.

---

## How to Test

1. Open `http://localhost:3000/studio` in Chrome, log in, open a screen
2. Open an incognito window (or a different browser), go to the same URL, log in with a **different account**
3. Both windows should show:
   - The other user's avatar in the top bar
   - The other user's coloured cursor moving on the canvas
   - A coloured outline on whichever node the other user selects

**Note**: You need two Supabase accounts. Create a second one via `/signup` if you don't have one.

---

## Files to Modify

- `apps/web/components/studio/editor-layout.tsx` -- main integration
- `apps/web/components/studio/editor-canvas.tsx` -- cursor tracking + render remote cursors
