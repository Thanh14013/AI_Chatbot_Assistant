# Testing Guide - WebSocket & Real-time Features

## 📋 Tổng quan

Hướng dẫn test toàn diện cho các tính năng WebSocket và real-time đã implement trong Sprint 3.

---

## 🔧 Chuẩn bị môi trường test

### 1. Khởi động services

```bash
# Terminal 1: Start Backend
cd server
npm run dev

# Terminal 2: Start Frontend
cd client
npm run dev
```

### 2. Verify services đang chạy

- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- WebSocket: ws://localhost:3000 (socket.io)

### 3. Tạo test accounts

Đăng ký ít nhất 2 user accounts để test multi-user scenarios:

- User A: test1@example.com / password123
- User B: test2@example.com / password123

---

## 🧪 Test Cases

## Test Group 1: WebSocket Connection Management

### TC1.1: Basic Connection

**Steps:**

1. Login với User A
2. Mở Developer Tools → Network tab
3. Filter by "WS" để xem WebSocket connections

**Expected Results:**

- ✅ Thấy WebSocket connection established
- ✅ Connection status hiển thị "Connected"
- ✅ JWT token được gửi trong auth event

**How to verify:**

```javascript
// Console command để check WebSocket service
window.__websocketService?.isConnected;
// Should return: true
```

### TC1.2: Auto-reconnection

**Steps:**

1. Login User A, wait for connection established
2. Simulate network disconnect:
   - Chrome DevTools → Network → Offline checkbox
3. Wait 5 seconds
4. Uncheck Offline

**Expected Results:**

- ✅ Connection status chuyển thành "Reconnecting..."
- ✅ Sau khi online, auto-reconnect trong 2-3 seconds
- ✅ Status chuyển về "Connected"
- ✅ Previous conversation state được restore

### TC1.3: Authentication Failure

**Steps:**

1. Login User A
2. Manually expire JWT token hoặc logout từ tab khác
3. Reload page và try connect

**Expected Results:**

- ✅ Connection rejected với auth error
- ✅ User được redirect to login page
- ✅ No infinite reconnection loops

---

## Test Group 2: Real-time Messaging

### TC2.1: Message Sending & Receiving

**Steps:**

1. Login User A tại Tab 1
2. Login User B tại Tab 2 (khác browser hoặc incognito)
3. User A create new conversation
4. User A send message: "Hello from real-time!"

**Expected Results:**

- ✅ Message status: Sending → Sent
- ✅ Message xuất hiện immediately trong chat của User A
- ✅ If User B shares conversation, message hiển thị real-time

**Debug commands:**

```javascript
// Check last sent message
window.__websocketService?.lastSentMessage;

// Check received messages count
window.__websocketService?.receivedMessagesCount;
```

### TC2.2: Message Status Indicators

**Steps:**

1. User A send message "Testing message status"
2. Observe status icon beside message
3. Simulate network error (offline mode)
4. Send another message "This should fail"
5. Go back online

**Expected Results:**

- ✅ First message: Sending → Sent (checkmark)
- ✅ Second message: Sending → Error (exclamation icon)
- ✅ Click retry button on failed message
- ✅ After retry: Error → Sending → Sent

### TC2.3: Message Streaming (Chunks)

**Steps:**

1. Send message và wait for AI response
2. Watch message bubble while AI typing

**Expected Results:**

- ✅ AI message appears word-by-word (streaming effect)
- ✅ Message updates real-time as chunks arrive
- ✅ Final complete message rendered properly
- ✅ No duplicate messages

---

## Test Group 3: Typing Indicators

### TC3.1: User Typing Detection

**Steps:**

1. User A focus vào chat input
2. Type slowly: "Hello..."
3. Stop typing for 3+ seconds
4. Continue typing

**Expected Results:**

- ✅ typing:start event emitted khi bắt đầu type
- ✅ typing:stop event emitted sau 3 seconds không type
- ✅ Events visible trong Network tab (WS frames)

**Debug:**

```javascript
// Monitor typing events
window.__websocketService?.on("debug:typing", console.log);
```

### TC3.2: AI Typing Indicator

**Steps:**

1. Send message to AI: "Tell me a long story"
2. Observe chat area while waiting for response

**Expected Results:**

- ✅ "AI is typing..." message appears with animated dots
- ✅ Dots animation smooth (bouncing effect)
- ✅ Indicator disappears khi AI response arrives
- ✅ No overlap with actual AI message

### TC3.3: Multiple User Typing

**Steps:**

1. User A và User B trong shared conversation
2. Both users type simultaneously

**Expected Results:**

- ✅ Each user sees other user's typing indicator
- ✅ Multiple typing indicators can show at same time
- ✅ Indicators disappear correctly per user

---

## Test Group 4: Multi-tab Synchronization

### TC4.1: Conversation Sync

**Steps:**

1. User A mở 2 tabs cùng app
2. Tab 1: Create new conversation "Test Sync"
3. Observe Tab 2

**Expected Results:**

- ✅ New conversation appears trong sidebar của Tab 2
- ✅ No page refresh needed
- ✅ Conversation list order consistent across tabs

### TC4.2: Message Sync

**Steps:**

1. User A mở 2 tabs với same conversation
2. Tab 1: Send message "Tab 1 message"
3. Tab 2: Send message "Tab 2 message"

**Expected Results:**

- ✅ Both messages hiển thị trong cả 2 tabs
- ✅ Message order correct chronologically
- ✅ Message status synced across tabs

### TC4.3: Conversation CRUD Sync

**Steps:**

1. User A mở 3 tabs
2. Tab 1: Rename conversation to "Renamed Conv"
3. Tab 2: Observe sidebar
4. Tab 3: Delete the conversation
5. Observe Tabs 1 & 2

**Expected Results:**

- ✅ Tab 2 shows renamed conversation immediately
- ✅ After delete, Tabs 1 & 2 redirect to home hoặc another conversation
- ✅ Deleted conversation không còn trong sidebar của any tab

---

## Test Group 5: Network & Error Handling

### TC5.1: Network Status Component

**Steps:**

1. Normal browsing - connection stable
2. Go offline (DevTools → Network → Offline)
3. Wait for detection
4. Go back online

**Expected Results:**

- ✅ Status shows "Connected" (green dot) normally
- ✅ Shows "Offline" (red dot) khi network down
- ✅ Shows "Reconnecting..." (yellow dot) during reconnect
- ✅ Status updates within 2-3 seconds of network change

### TC5.2: Graceful Degradation

**Steps:**

1. Block WebSocket port (firewall hoặc browser extension)
2. Try to use app normally

**Expected Results:**

- ✅ App still functional với HTTP-only mode
- ✅ Messages send via REST API instead of WebSocket
- ✅ No crashes hoặc infinite loading states
- ✅ Clear indication that real-time features unavailable

### TC5.3: Message Queue & Retry

**Steps:**

1. Send 5 messages rapidly
2. Go offline before all sent
3. Go back online

**Expected Results:**

- ✅ Queued messages được sent when connection restored
- ✅ Message order preserved
- ✅ No duplicate messages
- ✅ Status indicators accurate throughout

---

## Test Group 6: UI Components

### TC6.1: TypingIndicator Component

**Test directly:**

```javascript
// In browser console
const indicator = document.querySelector('[data-testid="typing-indicator"]');
// Should exist when AI typing
```

**Manual testing:**

1. Trigger AI response
2. Verify animated dots appear
3. Check animation smoothness
4. Verify accessibility (screen reader support)

### TC6.2: MessageStatus Component

**Test each status:**

1. Sending: Loading spinner visible
2. Sent: Green checkmark visible
3. Error: Red exclamation with retry button
4. Pending: Clock icon visible

**Accessibility test:**

- Tab through status icons
- Verify ARIA labels present
- Test with screen reader

### TC6.3: NetworkStatus Component

**Test positions:**

```jsx
// Test different placements
<NetworkStatus position="inline" />
<NetworkStatus position="fixed-top" />
<NetworkStatus position="fixed-bottom" />
```

---

## Test Group 7: Performance & Memory

### TC7.1: Memory Leaks

**Steps:**

1. Mở Chrome DevTools → Performance tab
2. Create 10+ conversations
3. Switch between conversations rapidly
4. Send 50+ messages
5. Check Memory tab

**Expected Results:**

- ✅ Memory usage stable (no continuous growth)
- ✅ WebSocket connections cleaned up properly
- ✅ Event listeners removed when components unmount

### TC7.2: Message Volume Performance

**Steps:**

1. Send 100+ messages in quick succession
2. Monitor app responsiveness
3. Check for UI freezing

**Expected Results:**

- ✅ UI remains responsive throughout
- ✅ Messages rendered efficiently
- ✅ Scroll performance smooth
- ✅ No browser crashes

### TC7.3: Concurrent Users

**Steps:**

1. Simulate 5+ concurrent users (different browsers/devices)
2. All users join same conversation
3. Send messages simultaneously

**Expected Results:**

- ✅ All messages delivered to all users
- ✅ No race conditions
- ✅ Correct message ordering
- ✅ Server performance stable

---

## 🔍 Debug Tools & Commands

### WebSocket Service Debug

```javascript
// Global access for debugging
window.__websocketService = websocketService;

// Check connection status
window.__websocketService.isConnected;

// Get connection state
window.__websocketService.getConnectionState();

// Manual reconnect
window.__websocketService.reconnect();

// Check event listeners count
window.__websocketService.listenerCount("message:receive");
```

### React Hook Debug

```javascript
// In component, add debug logging
useEffect(() => {
  console.log("useRealTimeChat hook state:", {
    isConnected,
    isAITyping,
    conversationId,
    messages: messages.length,
  });
}, [isConnected, isAITyping, conversationId, messages.length]);
```

### Network Monitoring

**Chrome DevTools:**

1. Network tab → WS filter → View WebSocket frames
2. Application tab → Storage → Check localStorage for tokens
3. Console tab → Monitor WebSocket events

---

## 🚨 Common Issues & Solutions

### Issue 1: WebSocket connection fails

**Symptoms:** Status always shows "Connecting..."
**Debug:**

```javascript
// Check if backend WebSocket running
fetch("http://localhost:3000/socket.io/").then((r) =>
  console.log("Backend OK")
);

// Check token validity
console.log(localStorage.getItem("authToken"));
```

### Issue 2: Messages not syncing across tabs

**Symptoms:** Messages only show in sending tab
**Debug:**

```javascript
// Check room joining
window.__websocketService.rooms;
// Should include conversation IDs
```

### Issue 3: Typing indicators stuck

**Symptoms:** "AI is typing..." never disappears
**Debug:**

```javascript
// Manually stop typing
window.__websocketService.emit("typing:stop", { conversationId: "current-id" });
```

### Issue 4: Auto-reconnect not working

**Symptoms:** Stays "Offline" even when network restored
**Debug:**

```javascript
// Force reconnection attempt
window.__websocketService.forceReconnect();

// Check reconnection config
window.__websocketService.reconnectAttempts;
```

---

## ✅ Testing Checklist

### Before Release

- [ ] All test cases pass
- [ ] No console errors during normal usage
- [ ] Memory usage stable after extended use
- [ ] WebSocket connections close properly on logout
- [ ] Multi-tab synchronization working
- [ ] Typing indicators accurate
- [ ] Message status tracking reliable
- [ ] Network status updates correctly
- [ ] Accessibility requirements met
- [ ] Mobile responsive design verified
- [ ] Error states handled gracefully

### Performance Benchmarks

- [ ] Page load time < 3 seconds
- [ ] WebSocket connection time < 1 second
- [ ] Message delivery latency < 500ms
- [ ] UI response time < 100ms
- [ ] Memory growth < 10MB after 1 hour usage

---

## 📊 Test Results Template

```markdown
## Test Session: [Date]

**Environment:**

- Browser: Chrome 120.x
- OS: Windows 11
- Network: Wifi/4G
- Backend: v1.0.0
- Frontend: v1.0.0

**Test Results:**

- WebSocket Connection: ✅ Pass
- Real-time Messaging: ✅ Pass
- Typing Indicators: ✅ Pass
- Multi-tab Sync: ❌ Fail - [Issue description]
- Network Handling: ✅ Pass
- UI Components: ✅ Pass
- Performance: ✅ Pass

**Issues Found:**

1. [Issue 1 description]
2. [Issue 2 description]

**Overall Status:** 85% Pass Rate
```

---

## 🎯 Success Criteria

**✅ Minimum Viable Product:**

- WebSocket connection stable
- Messages send/receive in real-time
- Basic error handling works
- No crashes during normal usage

**✅ Production Ready:**

- All test cases pass 95%+
- Performance benchmarks met
- Accessibility compliant
- Multi-browser support verified
- Documentation complete

**✅ Excellent User Experience:**

- Sub-second response times
- Smooth animations
- Intelligent error recovery
- Delightful micro-interactions
