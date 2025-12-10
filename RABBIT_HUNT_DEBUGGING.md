# Rabbit Hunt - Debugging Guide

## Issue: Click Not Working

If the rabbit hunt cards appear but clicking doesn't trigger the reveal, follow these steps to debug:

---

## Step 1: Check Browser Console

Open your browser's developer console (F12) and look for these log messages:

### When Cards Render:
```
[RABBIT-HUNT] Component render - rabbitHunt: {available: true, revealed: false, cardCount: 5, cards: null}
[RABBIT-HUNT] Component render - onTriggerRabbitHunt: function
```

**What to check:**
- ✅ `rabbitHunt.available` should be `true`
- ✅ `rabbitHunt.revealed` should be `false`
- ✅ `onTriggerRabbitHunt` should be `'function'` (not `'undefined'`)

**If `onTriggerRabbitHunt` is undefined:**
- The prop is not being passed from PokerRoom to PokerTable correctly
- Check that PokerTable is receiving and passing the prop

---

### When You Click a Card:
```
[RABBIT-HUNT] Card clicked, triggering rabbit hunt
[RABBIT-HUNT] handleTriggerRabbitHunt called
[RABBIT-HUNT] Socket exists: true
[RABBIT-HUNT] Socket connected: true
[RABBIT-HUNT] Emitting rabbit-hunt event
```

**What to check:**
- ✅ First log confirms click handler is firing
- ✅ Socket should exist and be connected
- ✅ Event should be emitted

**If you see an error:**
```
[RABBIT-HUNT] onTriggerRabbitHunt handler is not defined!
```
- The handler prop is not being passed correctly

**If socket is not connected:**
```
[RABBIT-HUNT] Socket connected: false
```
- Wait for socket to reconnect
- Check network connection

---

### Server Response:
Look for server logs or errors:
```
[RABBIT-HUNT] Player triggered rabbit hunt: <socketId>
[RABBIT-HUNT] Success! Revealing cards: ['Ah', 'Kd', ...]
```

**Or error messages:**
```
Rabbit hunt is disabled in this room
Rabbit hunt already revealed
No cards available for rabbit hunt
```

---

## Step 2: Check Network Tab

1. Open Network tab in browser console
2. Filter by "WS" (WebSocket)
3. Click a rabbit hunt card
4. Look for outgoing message: `rabbit-hunt`

**What you should see:**
```json
{
  "type": "rabbit-hunt"
}
```

**And incoming response:**
```json
{
  "type": "rabbit-hunt-revealed",
  "data": {
    "cards": ["Ah", "Kd", ...],
    "gameState": {...}
  }
}
```

---

## Step 3: Verify Room Settings

Check that rabbit hunt is enabled in room settings:

```javascript
// In server console or database
room.settings.allowRabbitHunt === true
```

If `false`, no reveal will happen (server will reject request).

---

## Step 4: Check Game State

Verify the game state has rabbit hunt data:

```javascript
// In browser console
console.log(roomState?.gameState?.rabbitHunt)
```

**Expected output:**
```javascript
{
  available: true,
  revealed: false,
  cardCount: 5, // or 2, or 1 depending on when hand ended
  cards: null   // null until revealed
}
```

**If `available` is `false`:**
- Hand might have gone to river (all cards dealt)
- Setting might be disabled
- Cards might already be revealed

---

## Step 5: Test Click Handler Directly

In browser console, try triggering manually:

```javascript
// Get the socket from window (if exposed) or try:
const socket = window.socket || io()

// Emit event directly
socket.emit('rabbit-hunt')
```

**If this works:**
- The issue is with the click handler or prop passing
- Check React component hierarchy

**If this doesn't work:**
- The issue is with the socket or server
- Check server logs for errors

---

## Common Issues & Fixes

### Issue 1: Handler Not Defined
**Symptom:** `onTriggerRabbitHunt handler is not defined!`

**Fix:** Verify prop is passed through component tree:
```jsx
// PokerRoom.jsx
<PokerTable
  onTriggerRabbitHunt={handleTriggerRabbitHunt}  // ✓ Must be here
  // ... other props
/>

// PokerTable.jsx
<RabbitHuntCards
  onTriggerRabbitHunt={onTriggerRabbitHunt}  // ✓ Must be here
  // ... other props
/>
```

---

### Issue 2: CSS Blocking Clicks
**Symptom:** Hover works but click doesn't

**Fix:** Already applied:
```css
.rabbit-hunt-card {
  pointer-events: auto;  /* ✓ Card is clickable */
  z-index: 10;           /* ✓ Card is on top */
}

.rabbit-hunt-card .rabbit-emoji {
  pointer-events: none;  /* ✓ Clicks pass through emoji */
}
```

---

### Issue 3: Cards Already Revealed
**Symptom:** Cards show but can't click again

**Check:**
```javascript
rabbitHunt.revealed === true  // Already revealed
```

**Fix:** This is expected behavior - can only trigger once per hand

---

### Issue 4: Socket Not Connected
**Symptom:** `Socket connected: false`

**Fix:**
- Wait for reconnection
- Check server is running
- Check network connection
- Refresh page

---

### Issue 5: Server Error
**Symptom:** Cards don't reveal, error in network tab

**Check server console for:**
```
[ERROR] Side pot calculation mismatch
[ERROR] Not enough cards in deck
```

**Fix:**
- Restart server
- Check game state integrity
- File a bug report with reproduction steps

---

## Quick Test Steps

1. **Start a game with 2+ players**
2. **Fold on the flop** (or go all-in preflop)
3. **Check console for:** `[RABBIT-HUNT] Component render`
4. **See 🐰 cards appear** below community cards
5. **Click any card**
6. **Check console for:** `[RABBIT-HUNT] Card clicked`
7. **Cards should reveal** (face-up cards replace 🐰 cards)

---

## If Still Not Working

**Please provide:**
1. Full browser console log (all `[RABBIT-HUNT]` messages)
2. Network tab WebSocket messages
3. Server console output
4. Game state at time of click: `console.log(roomState)`
5. Steps to reproduce

**Common overlooked issues:**
- ⚠️ Browser blocking WebSocket connections
- ⚠️ Ad blocker interfering with events
- ⚠️ Multiple tabs open (socket might be in different tab)
- ⚠️ Server not restarted after code changes

---

## Verification Checklist

Run through this checklist:

- [ ] Server restarted after code changes
- [ ] Client rebuilt (if using build process)
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] Console shows no JavaScript errors
- [ ] WebSocket connected (check Network tab)
- [ ] Room setting `allowRabbitHunt: true`
- [ ] Game state has `rabbitHunt` object
- [ ] `onTriggerRabbitHunt` prop is passed
- [ ] Click event fires (see console)
- [ ] Socket emits `rabbit-hunt` event
- [ ] Server receives and processes event
- [ ] Server broadcasts `rabbit-hunt-revealed`
- [ ] Client receives and updates state

---

## Debug Mode

To enable detailed logging, set:

```javascript
// In browser console
localStorage.setItem('DEBUG', 'socket.io-client:*')
```

Then refresh page. You'll see all socket events in console.

To disable:
```javascript
localStorage.removeItem('DEBUG')
```
