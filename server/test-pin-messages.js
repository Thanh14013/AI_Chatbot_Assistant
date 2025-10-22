/**
 * Test Script for Pin Messages Feature
 *
 * This script helps test the pin messages functionality
 * Run this after starting your server
 *
 * Usage:
 * 1. Update the ACCESS_TOKEN, CONVERSATION_ID, and MESSAGE_ID variables
 * 2. Run: node test-pin-messages.js
 */

const API_BASE_URL = "http://localhost:5000/api";
const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"; // Replace with actual token
const CONVERSATION_ID = "YOUR_CONVERSATION_ID_HERE"; // Replace with actual conversation ID
const MESSAGE_ID = "YOUR_MESSAGE_ID_HERE"; // Replace with actual message ID

// Test 1: Pin a message
async function testPinMessage() {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/pin`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
    } else {
    }
  } catch (error) {}
}

// Test 2: Get pinned messages
async function testGetPinnedMessages() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${CONVERSATION_ID}/messages/pinned`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
    } else {
    }
  } catch (error) {}
}

// Test 3: Unpin a message
async function testUnpinMessage() {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/unpin`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
    } else {
    }
  } catch (error) {}
}

// Test 4: Try to pin already pinned message
async function testPinAlreadyPinned() {
  try {
    // First, pin the message
    await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/pin`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    // Try to pin again
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/pin`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok && data.message.includes("already pinned")) {
    } else {
    }
  } catch (error) {}
}

// Test 5: Try to access without authentication
async function testNoAuthentication() {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/pin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.status === 401) {
    } else {
    }
  } catch (error) {}
}

// Run all tests
async function runAllTests() {
  // Validate configuration
  if (
    ACCESS_TOKEN === "YOUR_ACCESS_TOKEN_HERE" ||
    CONVERSATION_ID === "YOUR_CONVERSATION_ID_HERE" ||
    MESSAGE_ID === "YOUR_MESSAGE_ID_HERE"
  ) {
    return;
  }

  await testPinMessage();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testGetPinnedMessages();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testPinAlreadyPinned();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testUnpinMessage();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testNoAuthentication();
}

// Run tests
runAllTests();
