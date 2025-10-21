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
  console.log("\n🧪 TEST 1: Pin a message");
  console.log("=".repeat(50));

  try {
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/pin`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ TEST PASSED: Message pinned successfully");
    } else {
      console.log("❌ TEST FAILED:", data.message);
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
  }
}

// Test 2: Get pinned messages
async function testGetPinnedMessages() {
  console.log("\n🧪 TEST 2: Get pinned messages");
  console.log("=".repeat(50));

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
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log(`✅ TEST PASSED: Found ${data.count} pinned message(s)`);
    } else {
      console.log("❌ TEST FAILED:", data.message);
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
  }
}

// Test 3: Unpin a message
async function testUnpinMessage() {
  console.log("\n🧪 TEST 3: Unpin a message");
  console.log("=".repeat(50));

  try {
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/unpin`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ TEST PASSED: Message unpinned successfully");
    } else {
      console.log("❌ TEST FAILED:", data.message);
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
  }
}

// Test 4: Try to pin already pinned message
async function testPinAlreadyPinned() {
  console.log("\n🧪 TEST 4: Try to pin already pinned message");
  console.log("=".repeat(50));

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
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok && data.message.includes("already pinned")) {
      console.log("✅ TEST PASSED: Correctly handles already pinned message");
    } else {
      console.log("❌ TEST FAILED: Should indicate message is already pinned");
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
  }
}

// Test 5: Try to access without authentication
async function testNoAuthentication() {
  console.log("\n🧪 TEST 5: Try to access without authentication");
  console.log("=".repeat(50));

  try {
    const response = await fetch(`${API_BASE_URL}/conversations/messages/${MESSAGE_ID}/pin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log("✅ TEST PASSED: Correctly rejects unauthenticated request");
    } else {
      console.log("❌ TEST FAILED: Should return 401 Unauthorized");
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log("\n🚀 Starting Pin Messages Feature Tests");
  console.log("=".repeat(50));
  console.log("API Base URL:", API_BASE_URL);
  console.log("Conversation ID:", CONVERSATION_ID);
  console.log("Message ID:", MESSAGE_ID);
  console.log("=".repeat(50));

  // Validate configuration
  if (
    ACCESS_TOKEN === "YOUR_ACCESS_TOKEN_HERE" ||
    CONVERSATION_ID === "YOUR_CONVERSATION_ID_HERE" ||
    MESSAGE_ID === "YOUR_MESSAGE_ID_HERE"
  ) {
    console.error(
      "\n❌ ERROR: Please update ACCESS_TOKEN, CONVERSATION_ID, and MESSAGE_ID in the script"
    );
    console.log("\nHow to get these values:");
    console.log(
      "1. ACCESS_TOKEN: Login to your app and get the access token from the auth response"
    );
    console.log("2. CONVERSATION_ID: Create or get an existing conversation ID");
    console.log("3. MESSAGE_ID: Send a message to the conversation and get its ID");
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

  console.log("\n" + "=".repeat(50));
  console.log("🎉 All tests completed!");
  console.log("=".repeat(50));
}

// Run tests
runAllTests();
