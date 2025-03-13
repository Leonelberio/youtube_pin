// newtab.js
document.addEventListener('DOMContentLoaded', function() {
  const videosContainer = document.getElementById('videosContainer');
  
  // Load pinned videos from storage
  chrome.storage.sync.get(['pinnedVideos'], function(result) {
    const pinnedVideos = result.pinnedVideos || [];
    
    if (pinnedVideos.length === 0) {
      videosContainer.innerHTML = `
        <div class="empty-state">
          <h2>No videos pinned yet</h2>
          <p>Visit a YouTube video and click the extension icon to pin videos here.</p>
        </div>
      `;
      return;
    }
    
    // Sort videos by timestamp (newest first)
    pinnedVideos.sort((a, b) => b.timestamp - a.timestamp);
    
    // Render videos
    pinnedVideos.forEach(video => {
      const videoCard = document.createElement('div');
      videoCard.className = 'video-card';
      videoCard.innerHTML = `
        <img class="thumbnail" src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
        <div class="video-info">
          <div class="video-title">${video.title}</div>
          <div class="video-actions">
            <button class="btn btn-watch" data-url="${video.url}">Watch</button>
            <button class="btn btn-remove" data-id="${video.id}">Remove</button>
          </div>
        </div>
      `;
      videosContainer.appendChild(videoCard);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.btn-watch').forEach(button => {
      button.addEventListener('click', function() {
        window.location.href = this.getAttribute('data-url');
      });
    });
    
    document.querySelectorAll('.btn-remove').forEach(button => {
      button.addEventListener('click', function() {
        const videoId = this.getAttribute('data-id');
        removeVideo(videoId);
      });
    });
  });
  
  function removeVideo(videoId) {
    chrome.storage.sync.get(['pinnedVideos'], function(result) {
      let pinnedVideos = result.pinnedVideos || [];
      
      // Filter out the video to remove
      pinnedVideos = pinnedVideos.filter(video => video.id !== videoId);
      
      // Save updated list
      chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function() {
        // Refresh the page to update the display
        location.reload();
      });
    });
  }
});