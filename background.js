// background.js
chrome.runtime.onInstalled.addListener(() => {
  // Initialize default categories if needed
  chrome.storage.sync.get(['categories'], function(result) {
    if (!result.categories) {
      const defaultCategories = [
        { id: 'default', name: 'Tous les pins' },
        { id: 'watchlater', name: 'À regarder plus tard' },
        { id: 'favorites', name: 'Favoris' },
        { id: 'reference', name: 'Références' }
      ];
      chrome.storage.sync.set({ 'categories': defaultCategories });
    }
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle any background tasks here
  if (request.type === 'PIN_VIDEO') {
    // Could be used for analytics or sync functionality in the future
    sendResponse({ status: 'success' });
  }
});
