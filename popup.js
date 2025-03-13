// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Check if current tab is a YouTube video
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;
    const youtubeInfo = document.getElementById('youtubeInfo');
    
    if (url.includes('youtube.com/watch')) {
      // Extract video ID
      const videoId = new URL(url).searchParams.get('v');
      const videoTitle = currentTab.title.replace(' - YouTube', '');
      
      youtubeInfo.innerHTML = `
        <p>Current video: <strong>${videoTitle}</strong></p>
        <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" width="100%">
      `;
      
      // Set up pin current button
      document.getElementById('pinCurrent').addEventListener('click', function() {
        saveVideo(url, videoTitle, videoId);
      });
    } else {
      document.getElementById('currentPage').innerHTML = '<p>Not a YouTube video page. Use the manual entry below.</p>';
    }
  });
  
  // Set up manual pin button
  document.getElementById('pinManual').addEventListener('click', function() {
    const videoUrl = document.getElementById('videoUrl').value.trim();
    const videoTitle = document.getElementById('videoTitle').value.trim() || 'YouTube Video';
    
    if (videoUrl && videoUrl.includes('youtube.com/watch')) {
      const videoId = new URL(videoUrl).searchParams.get('v');
      saveVideo(videoUrl, videoTitle, videoId);
    } else {
      alert('Please enter a valid YouTube video URL');
    }
  });
  
  function saveVideo(url, title, videoId) {
    chrome.storage.sync.get(['pinnedVideos'], function(result) {
      const pinnedVideos = result.pinnedVideos || [];
      
      // Check if video is already pinned
      const exists = pinnedVideos.some(video => video.id === videoId);
      
      if (!exists) {
        pinnedVideos.push({
          id: videoId,
          url: url,
          title: title,
          timestamp: Date.now()
        });
        
        chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function() {
          alert('Video pinned successfully!');
        });
      } else {
        alert('This video is already pinned!');
      }
    });
  }
});