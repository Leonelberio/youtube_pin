document.addEventListener('DOMContentLoaded', function () {
  const videosContainer = document.getElementById('videosContainer');

  chrome.storage.sync.get(['pinnedVideos'], function (result) {
    const pinnedVideos = result.pinnedVideos || [];

    if (pinnedVideos.length === 0) {
      videosContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="64" height="64">
            <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" />
          </svg>
          <h2>No videos pinned yet</h2>
          <p>Visit YouTube and click the pin button on videos to save them here</p>
        </div>
      `;
      return;
    }

    pinnedVideos.sort((a, b) => b.timestamp - a.timestamp);

    pinnedVideos.forEach(video => {
      const videoCard = document.createElement('div');
      videoCard.className = 'video-card';
      videoCard.innerHTML = `
        <div class="thumbnail-container">
          <img class="thumbnail" src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
        </div>
        <div class="video-info">
          <div class="video-title">${video.title}</div>
          <div class="video-actions">
            <button class="btn btn-watch" data-url="${video.url}">
              <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right: 6px">
                <path d="M8,5.14V19.14L19,12.14L8,5.14Z" fill="currentColor"/>
              </svg>
              Watch
            </button>
            <button class="btn btn-remove" data-id="${video.id}" title="Remove video">
              <svg viewBox="0 0 24 24">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
              </svg>
            </button>
          </div>
        </div>
      `;
      videosContainer.appendChild(videoCard);
    });

    document.querySelectorAll('.btn-watch').forEach(button => {
      button.addEventListener('click', function () {
        window.location.href = this.getAttribute('data-url');
      });
    });

    document.querySelectorAll('.btn-remove').forEach(button => {
      button.addEventListener('click', function () {
        const videoId = this.getAttribute('data-id');
        removeVideo(videoId);
      });
    });
  });

  function removeVideo(videoId) {
    chrome.storage.sync.get(['pinnedVideos'], function (result) {
      let pinnedVideos = result.pinnedVideos || [];
      pinnedVideos = pinnedVideos.filter(video => video.id !== videoId);
      chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function () {
        location.reload();
      });
    });
  }
});
