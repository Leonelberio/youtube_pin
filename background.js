// Initialize default categories on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['categories'], function (result) {
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
  if (request.type === 'PIN_VIDEO') {
    // Placeholder for future analytics or sync functionality
    sendResponse({ status: 'success' });
  } else if (request.action === 'showPinnedPage') {
    sendResponse({ status: 'received' });
  }
});