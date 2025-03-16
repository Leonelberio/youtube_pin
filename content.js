(function () {
  // Data structure for default categories
  const defaultCategories = [
    { id: 'default', name: 'Tous les pins' },
    { id: 'watchlater', name: 'À regarder plus tard' },
    { id: 'favorites', name: 'Favoris' },
    { id: 'reference', name: 'Références' }
  ];

  // Configuration for auto-pinning and floating player
  let autoPinChannels = [];
  let floatingPlayer = null;

  // Initialize the extension
  function initializeExtension() {
    console.log('[YouTube Pin] Initializing extension...');

    // Check if we're on YouTube
    if (!window.location.hostname.includes('youtube.com')) {
      console.log('[YouTube Pin] Not on YouTube, exiting...');
      return;
    }

    // Load saved data with fallback if chrome.storage is unavailable
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['pinnedVideos', 'categories', 'autoPinChannels', 'settings'], function (result) {
        console.log('[YouTube Pin] Loaded storage data:', result);

        const pinnedVideos = result.pinnedVideos || [];
        const categories = result.categories || defaultCategories;
        autoPinChannels = result.autoPinChannels || [];
        const settings = result.settings || {
          showOnHome: true,
          showOnThumbnails: true,
          showOnPlayer: true
        };

        // Delay to ensure YouTube DOM is loaded
        setTimeout(() => {
          // Setup UI elements based on settings
          setupSidebar();
          if (settings.showOnThumbnails) setupPinButtons();
          if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
            if (settings.showOnHome) addPinnedSection(pinnedVideos);
          }
          if (window.location.pathname.includes('/watch')) {
            if (settings.showOnPlayer) addPinButtonToPlayer();
            addFloatingPlayerButton();
          }
          if (window.location.pathname.includes('/channel/') ||
            window.location.pathname.includes('/c/') ||
            window.location.pathname.includes('/user/')) {
            addChannelAutoPinButton();
          }

          // Observe page changes for SPA navigation
          observePageChanges();
        }, 1500);
      });
    } else {
      console.error('[YouTube Pin] chrome.storage.sync is not available. Running in fallback mode.');
      const pinnedVideos = [];
      const categories = defaultCategories;
      autoPinChannels = [];
      const settings = { showOnHome: true, showOnThumbnails: true, showOnPlayer: true };
      setTimeout(() => {
        setupSidebar();
        if (settings.showOnThumbnails) setupPinButtons();
        if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
          if (settings.showOnHome) addPinnedSection(pinnedVideos);
        }
        if (window.location.pathname.includes('/watch')) {
          if (settings.showOnPlayer) addPinButtonToPlayer();
          addFloatingPlayerButton();
        }
        if (window.location.pathname.includes('/channel/') ||
          window.location.pathname.includes('/c/') ||
          window.location.pathname.includes('/user/')) {
          addChannelAutoPinButton();
        }
        observePageChanges();
      }, 1500);
    }
  }

  // Add "Pinned Videos" tab to YouTube sidebar
  function setupSidebar() {
    console.log('[YouTube Pin] Setting up sidebar...');

    const guideSection = document.querySelector('ytd-guide-section-renderer');
    if (!guideSection) {
      console.log('[YouTube Pin] Guide section not found, retrying...');
      setTimeout(setupSidebar, 1000);
      return;
    }

    if (document.getElementById('pinned-videos-sidebar-item')) {
      console.log('[YouTube Pin] Sidebar item already exists');
      return;
    }

    const sidebarItem = document.createElement('ytd-guide-entry-renderer');
    sidebarItem.className = 'style-scope ytd-guide-section-renderer';
    sidebarItem.id = 'pinned-videos-sidebar-item';

    sidebarItem.innerHTML = `
      <a class="yt-simple-endpoint style-scope ytd-guide-entry-renderer" tabindex="0">
        <yt-icon class="guide-icon style-scope ytd-guide-entry-renderer">
          <svg viewBox="0 0 24 24" class="style-scope yt-icon">
            <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="currentColor"/>
          </svg>
        </yt-icon>
        <span class="title style-scope ytd-guide-entry-renderer">Vidéos épinglées</span>
      </a>
    `;

    sidebarItem.addEventListener('click', () => {
      showPinnedPage();
    });

    const insertPoint = guideSection.querySelector('#sections');
    if (insertPoint) {
      insertPoint.appendChild(sidebarItem);
      console.log('[YouTube Pin] Sidebar item added successfully');
    }
  }

  // Add Pin buttons to video thumbnails
  function setupPinButtons() {
    console.log('[YouTube Pin] Setting up pin buttons...');

    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer');
    videoElements.forEach(videoElement => {
      if (videoElement.querySelector('.pin-button')) return;

      const thumbnail = videoElement.querySelector('a#thumbnail');
      if (!thumbnail) return;

      const videoId = getVideoIdFromUrl(thumbnail.href);
      if (!videoId) return;

      const titleElement = videoElement.querySelector('#video-title');
      const title = titleElement ? titleElement.textContent.trim() : 'Vidéo YouTube';

      const pinButton = document.createElement('button');
      pinButton.className = 'pin-button';
      pinButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="currentColor"/>
        </svg>
      `;

      pinButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pinVideo(videoId, title, thumbnail.href);
      });

      const thumbnailContainer = videoElement.querySelector('#thumbnail');
      if (thumbnailContainer) {
        thumbnailContainer.style.position = 'relative';
        thumbnailContainer.appendChild(pinButton);
      }

      // Call auto-pin check
      checkAndAutoPinVideo(videoElement);
    });
  }

  // Add Pin button to video player
  function addPinButtonToPlayer() {
    const player = document.querySelector('.html5-video-player');
    if (!player || player.querySelector('.pin-button')) return;

    const pinButton = document.createElement('button');
    pinButton.className = 'pin-button';
    pinButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="currentColor"/>
      </svg>
    `;
    pinButton.addEventListener('click', () => {
      const videoId = getVideoIdFromUrl(window.location.href);
      const title = document.querySelector('#title h1')?.textContent || 'Vidéo YouTube';
      pinVideo(videoId, title, window.location.href);
    });

    const controls = player.querySelector('.ytp-right-controls');
    if (controls) {
      controls.prepend(pinButton);
    }
  }

  // Add floating player button
  function addFloatingPlayerButton() {
    const player = document.querySelector('.html5-video-player');
    if (!player || player.querySelector('.floating-player-button')) return;

    const button = document.createElement('button');
    button.className = 'floating-player-button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M21,3H3C1.89,3 1,3.89 1,5V19C1,20.11 1.89,21 3,21H21C22.11,21 23,20.11 23,19V5C23,3.89 22.11,3 21,3M21,19H3V5H21V19Z" fill="currentColor"/>
      </svg>
    `;
    button.addEventListener('click', toggleFloatingPlayer);

    const controls = player.querySelector('.ytp-right-controls');
    if (controls) {
      controls.prepend(button);
    }
  }

  // Toggle floating player
  function toggleFloatingPlayer() {
    if (floatingPlayer) {
      floatingPlayer.remove();
      floatingPlayer = null;
      return;
    }

    const video = document.querySelector('video');
    if (!video) return;

    floatingPlayer = document.createElement('div');
    floatingPlayer.className = 'floating-player';
    floatingPlayer.innerHTML = `
      <div class="floating-player-header">
        <span class="floating-player-title">${document.querySelector('#title h1')?.textContent || 'Vidéo'}</span>
        <button class="floating-player-close">×</button>
      </div>
      <video src="${video.src}" controls autoplay></video>
    `;
    document.body.appendChild(floatingPlayer);

    floatingPlayer.querySelector('.floating-player-close').addEventListener('click', () => toggleFloatingPlayer());
    makeDraggable(floatingPlayer);
  }

  // Make floating player draggable
  function makeDraggable(el) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    el.querySelector('.floating-player-header').addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener('mousemove', elementDrag);
      document.addEventListener('mouseup', closeDragElement);
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + 'px';
      el.style.left = (el.offsetLeft - pos1) + 'px';
    }

    function closeDragElement() {
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('mouseup', closeDragElement);
    }
  }

  // Add pinned section to homepage
  function addPinnedSection(pinnedVideos) {
    if (pinnedVideos.length === 0) {
      console.log('[YouTube Pin] No pinned videos to display');
      return;
    }

    console.log('[YouTube Pin] Adding pinned section with videos:', pinnedVideos);

    const primaryContent = document.querySelector('ytd-rich-grid-renderer');
    if (!primaryContent) {
      console.log('[YouTube Pin] Primary content not found, retrying...');
      setTimeout(() => addPinnedSection(pinnedVideos), 1000);
      return;
    }

    if (document.getElementById('pinned-videos-section')) {
      console.log('[YouTube Pin] Pinned section already exists');
      return;
    }

    const section = document.createElement('div');
    section.id = 'pinned-videos-section';
    section.className = 'pinned-videos-container';

    section.innerHTML = `
      <h2 class="pinned-section-title">Vos vidéos épinglées</h2>
      <div class="pinned-video-wrapper">
        <button class="scroll-chevron left-chevron" id="scroll-left">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
          </svg>
        </button>
        <div class="pinned-video-grid">
          ${pinnedVideos.map(video => `
            <div class="pinned-video-card" data-video-id="${video.id}">
              <a href="${video.url}" class="thumbnail-container">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
              </a>
              <button class="remove-pin" data-video-id="${video.id}">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"/>
                </svg>
              </button>
              <div class="video-info">
                <a href="${video.url}" class="video-title">${video.title}</a>
                <div class="video-category">
                  ${video.category || 'Non classé'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="scroll-chevron right-chevron" id="scroll-right">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      ${pinnedVideos.length > 6 ? `
        <div class="view-all-link">
          <a href="#" id="view-all-pins">Voir toutes vos vidéos épinglées (${pinnedVideos.length})</a>
        </div>
      ` : ''}
    `;

    // Add event listeners for remove buttons
    section.querySelectorAll('.remove-pin').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const videoId = button.dataset.videoId;
        unpinVideo(videoId);
      });
    });

    // Add event listener for view all link
    const viewAllLink = section.querySelector('#view-all-pins');
    if (viewAllLink) {
      viewAllLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPinnedPage();
      });
    }

    // Add scroll event listeners for chevrons
    const grid = section.querySelector('.pinned-video-grid');
    const scrollLeft = section.querySelector('#scroll-left');
    const scrollRight = section.querySelector('#scroll-right');

    scrollLeft.addEventListener('click', () => {
      grid.scrollBy({ left: -200, behavior: 'smooth' });
    });

    scrollRight.addEventListener('click', () => {
      grid.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // Update chevron visibility based on scroll position
    grid.addEventListener('scroll', () => {
      scrollLeft.style.display = grid.scrollLeft > 0 ? 'block' : 'none';
      scrollRight.style.display = grid.scrollWidth > grid.clientWidth + grid.scrollLeft ? 'block' : 'none';
    });

    primaryContent.parentNode.insertBefore(section, primaryContent);
    console.log('[YouTube Pin] Pinned section added successfully');
  }

  // Get video ID from URL
  function getVideoIdFromUrl(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url, window.location.origin);
      let videoId = null;

      if (urlObj.pathname === '/watch') {
        videoId = urlObj.searchParams.get('v');
      }

      if (!videoId) {
        const matches = urlObj.pathname.match(/\/(v|embed|shorts)\/([^/?&]+)/);
        if (matches) videoId = matches[2];
      }

      return videoId;
    } catch (e) {
      console.error('[YouTube Pin] Error parsing video URL:', e);
      return null;
    }
  }

  // Get channel ID from the current page
  function getChannelId() {
    const path = window.location.pathname;
    const matches = path.match(/\/channel\/(UC[\w-]+)/);
    if (matches) return matches[1];

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      const href = canonicalLink.getAttribute('href');
      const canonicalMatches = href?.match(/\/channel\/(UC[\w-]+)/);
      if (canonicalMatches) return canonicalMatches[1];
    }

    return null;
  }

  // Get channel ID from a video element
  function getChannelIdFromElement(videoElement) {
    const channelLink = videoElement.querySelector('a[href*="/channel/"]') || videoElement.querySelector('a[href*="/user/"]') || videoElement.querySelector('a[href*="@"]');
    if (channelLink) {
      const href = channelLink.getAttribute('href');
      const matches = href.match(/\/(channel|user|@)([^/?&]+)/);
      if (matches) return matches[2];
    }
    return null;
  }

  // Pin a video
  function pinVideo(videoId, title, url) {
    console.log('[YouTube Pin] Pinning video:', { videoId, title, url });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['pinnedVideos'], function (result) {
        let pinnedVideos = result.pinnedVideos || [];

        if (pinnedVideos.some(v => v.id === videoId)) {
          showToast('Cette vidéo est déjà épinglée');
          return;
        }

        const newVideo = {
          id: videoId,
          title: title,
          url: url,
          timestamp: Date.now(),
          category: 'default'
        };

        // Add to storage
        pinnedVideos.unshift(newVideo);
        chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function () {
          showToast('Vidéo épinglée ✅');
        });

        // Update UI in real time
        if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
          const existingSection = document.getElementById('pinned-videos-section');
          if (!existingSection) {
            addPinnedSection(pinnedVideos);
            const addedCard = document.querySelector(`.pinned-video-card[data-video-id="${videoId}"]`);
            if (addedCard) {
              addedCard.classList.add('new');
              setTimeout(() => addedCard.classList.remove('new'), 300);
            }
          } else {
            const grid = existingSection.querySelector('.pinned-video-grid');
            if (grid) {
              const videoCard = document.createElement('div');
              videoCard.className = 'pinned-video-card new';
              videoCard.dataset.videoId = videoId;
              videoCard.innerHTML = `
                <a href="${url}" class="thumbnail-container">
                  <img src="https://i.ytimg.com/vi/${videoId}/mqdefault.jpg" alt="${title}">
                </a>
                <button class="remove-pin" data-video-id="${videoId}">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"/>
                  </svg>
                </button>
                <div class="video-info">
                  <a href="${url}" class="video-title">${title}</a>
                  <div class="video-category">Non classé</div>
                </div>
              `;

              videoCard.querySelector('.remove-pin').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                unpinVideo(videoId);
              });

              if (grid.firstChild) {
                grid.insertBefore(videoCard, grid.firstChild);
              } else {
                grid.appendChild(videoCard);
              }

              // Remove excess cards
              const cards = grid.querySelectorAll('.pinned-video-card');
              if (cards.length > 6) {
                const lastCard = cards[cards.length - 1];
                lastCard.style.opacity = '0';
                lastCard.style.transform = 'translateY(20px)';
                setTimeout(() => lastCard.remove(), 300);
              }

              // Update view all link count
              const viewAllLink = existingSection.querySelector('#view-all-pins');
              if (viewAllLink) {
                viewAllLink.textContent = `Voir toutes vos vidéos épinglées (${pinnedVideos.length})`;
              }

              setTimeout(() => videoCard.classList.remove('new'), 300);
            }
          }
        }
      });
    } else {
      console.warn('[YouTube Pin] Storage not available, pinning skipped.');
      showToast('Pin failed: Storage unavailable');
    }
  }

  // Unpin a video
  function unpinVideo(videoId) {
    console.log('[YouTube Pin] Unpinning video:', videoId);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['pinnedVideos'], function (result) {
        let pinnedVideos = result.pinnedVideos || [];

        pinnedVideos = pinnedVideos.filter(v => v.id !== videoId);

        chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function () {
          showToast('Vidéo désépinglée');
          const card = document.querySelector(`.pinned-video-card[data-video-id="${videoId}"]`);
          if (card) {
            card.remove();
          }
          if (pinnedVideos.length === 0) {
            const section = document.getElementById('pinned-videos-section');
            if (section) section.remove();
          }
        });
      });
    } else {
      console.warn('[YouTube Pin] Storage not available, unpinning skipped.');
      showToast('Unpin failed: Storage unavailable');
    }
  }

  // Show toast notification
  function showToast(message) {
    console.log('[YouTube Pin] Showing toast:', message);

    let toast = document.getElementById('pin-toast');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pin-toast';
      document.body.appendChild(toast);
    }

    toast.className = 'pin-toast';
    toast.textContent = message;

    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Show full pinned videos page
  function showPinnedPage() {
    console.log('[YouTube Pin] Showing pinned videos page');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['pinnedVideos', 'categories'], function (result) {
        const pinnedVideos = result.pinnedVideos || [];
        const categories = result.categories || defaultCategories;

        const mainContent = document.querySelector('ytd-browse');
        if (!mainContent) {
          console.log('[YouTube Pin] Main content not found');
          return;
        }

        const originalContent = mainContent.innerHTML;

        mainContent.innerHTML = `
          <div id="pinned-videos-page">
            <div class="pinned-header">
              <h1>Mes vidéos épinglées</h1>
              <div class="view-options">
                <input type="text" id="searchPins" placeholder="Rechercher..." class="search-input">
                <button id="grid-view" class="view-button active">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d="M3,3H11V11H3V3M3,13H11V21H3V13M13,3H21V11H13V3M13,13H21V21H13V13Z" fill="currentColor"/>
                  </svg>
                </button>
                <button id="list-view" class="view-button">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d="M3,4H21V8H3V4M3,10H21V14H3V10M3,16H21V20H3V16Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="categories-nav">
              <ul id="categories-list">
                ${categories.map(cat => `
                  <li class="category-item" data-id="${cat.id}">
                    <a href="#" class="${cat.id === 'default' ? 'active' : ''}">${cat.name}</a>
                  </li>
                `).join('')}
                <li class="category-add">
                  <button id="add-category">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor"/>
                    </svg>
                    Nouvelle catégorie
                  </button>
                </li>
              </ul>
            </div>
            <div class="pinned-content ${pinnedVideos.length === 0 ? 'empty' : ''}">
              ${pinnedVideos.length === 0 ? `
                <div class="empty-state">
                  <svg viewBox="0 0 24 24" width="64" height="64">
                    <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="#aaaaaa"/>
                  </svg>
                  <h2>Vous n'avez pas encore de vidéos épinglées</h2>
                  <p>Naviguez sur YouTube et cliquez sur le bouton "Pin" pour ajouter des vidéos ici.</p>
                </div>
              ` : `
                <div id="pinned-videos-container" class="grid-view">
                  ${pinnedVideos.map(video => `
                     <div class="pinned-video-card" data-video-id="${video.id}">
              <a href="${video.url}" class="thumbnail-container">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
              </a>
              <button class="remove-pin" data-video-id="${video.id}">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"/>
                </svg>
              </button>
              <div class="video-info">
                <a href="${video.url}" class="video-title">${video.title}</a>
                <div class="video-category">
                  ${video.category || 'Non classé'}
                </div>
              </div>
            </div>
                  `).join('')}
                </div>
              `}
            </div>
            <button id="back-to-youtube" class="back-button">
              Retour à YouTube
            </button>
          </div>
        `;

        // Grid/List view toggle
        document.getElementById('grid-view')?.addEventListener('click', function () {
          const container = document.getElementById('pinned-videos-container');
          if (container) {
            container.className = 'grid-view';
            document.getElementById('grid-view')?.classList.add('active');
            document.getElementById('list-view')?.classList.remove('active');
          }
        });

        document.getElementById('list-view')?.addEventListener('click', function () {
          const container = document.getElementById('pinned-videos-container');
          if (container) {
            container.className = 'list-view';
            document.getElementById('list-view')?.classList.add('active');
            document.getElementById('grid-view')?.classList.remove('active');
          }
        });

        // Search functionality
        document.getElementById('searchPins')?.addEventListener('input', function (e) {
          const query = e.target.value.toLowerCase();
          document.querySelectorAll('.pinned-video-item').forEach(item => {
            const title = item.querySelector('.video-title')?.textContent.toLowerCase() || '';
            item.style.display = title.includes(query) ? '' : 'none';
          });
        });

        // Filter by category
        document.querySelectorAll('.category-item').forEach(item => {
          item.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.category-item a').forEach(a => a.classList.remove('active'));
            this.querySelector('a')?.classList.add('active');

            const categoryId = this.getAttribute('data-id');
            const container = document.getElementById('pinned-videos-container');

            if (container) {
              if (categoryId === 'default') {
                document.querySelectorAll('.pinned-video-item').forEach(item => {
                  item.style.display = '';
                });
              } else {
                document.querySelectorAll('.pinned-video-item').forEach(item => {
                  if (item.getAttribute('data-category') === categoryId) {
                    item.style.display = '';
                  } else {
                    item.style.display = 'none';
                  }
                });
              }
            }
          });
        });

        // Add a category
        document.getElementById('add-category')?.addEventListener('click', function () {
          const name = prompt('Nom de la nouvelle catégorie:');
          if (!name) return;

          const id = 'category_' + Date.now();
          categories.push({ id, name });

          chrome.storage.sync.set({ categories }, function () {
            showPinnedPage();
          });
        });

        // Remove a pin
        document.querySelectorAll('.remove-pin').forEach(button => {
          button.addEventListener('click', function () {
            const videoId = this.getAttribute('data-id');
            if (videoId) {
              unpinVideo(videoId);
              showPinnedPage();
            }
          });
        });

        // Manage categories
        document.querySelectorAll('.category-select').forEach(button => {
          button.addEventListener('click', function (e) {
            const videoId = this.getAttribute('data-id');
            if (!videoId) return;

            const menu = document.createElement('div');
            menu.className = 'category-menu';
            menu.innerHTML = `
              <div class="category-menu-items">
                ${categories.map(cat => `
                  <div class="category-menu-item" data-id="${cat.id}">${cat.name}</div>
                `).join('')}
              </div>
            `;

            const rect = this.getBoundingClientRect();
            menu.style.position = 'absolute';
            menu.style.top = rect.bottom + 'px';
            menu.style.left = rect.left + 'px';

            document.body.appendChild(menu);

            menu.querySelectorAll('.category-menu-item').forEach(item => {
              item.addEventListener('click', function () {
                const categoryId = this.getAttribute('data-id');
                if (!categoryId) return;

                chrome.storage.sync.get(['pinnedVideos'], function (result) {
                  let pinnedVideos = result.pinnedVideos || [];
                  pinnedVideos = pinnedVideos.map(video => {
                    if (video.id === videoId) {
                      return { ...video, category: categoryId };
                    }
                    return video;
                  });
                  chrome.storage.sync.set({ pinnedVideos }, function () {
                    showPinnedPage();
                  });
                });

                menu.remove();
              });
            });

            document.addEventListener('click', function closeMenu(e) {
              if (!menu.contains(e.target) && e.target !== button) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
              }
            });
          });
        });

        // Drag and Drop for categories
        document.querySelectorAll('.pinned-video-item').forEach(item => {
          item.setAttribute('draggable', true);
          item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.id);
          });
        });

        document.querySelectorAll('.category-item a').forEach(cat => {
          cat.addEventListener('dragover', (e) => e.preventDefault());
          cat.addEventListener('drop', (e) => {
            e.preventDefault();
            const videoId = e.dataTransfer.getData('text');
            const categoryId = cat.parentElement.dataset.id;
            chrome.storage.sync.get(['pinnedVideos'], (result) => {
              let pinnedVideos = result.pinnedVideos || [];
              pinnedVideos = pinnedVideos.map(video => video.id === videoId ? { ...video, category: categoryId } : video);
              chrome.storage.sync.set({ pinnedVideos }, () => showPinnedPage());
            });
          });
        });

        // Back to YouTube
        document.getElementById('back-to-youtube')?.addEventListener('click', function () {
          mainContent.innerHTML = originalContent;
        });
      });
    } else {
      console.warn('[YouTube Pin] Storage not available, showing empty pinned page.');
      const mainContent = document.querySelector('ytd-browse');
      if (mainContent) {
        mainContent.innerHTML = `
          <div id="pinned-videos-page">
            <div class="pinned-header">
              <h1>Mes vidéos épinglées</h1>
            </div>
            <div class="empty-state">
              <h2>Échec du chargement</h2>
              <p>Le stockage n'est pas disponible. Veuillez recharger l'extension.</p>
            </div>
          </div>
        `;
      }
    }
  }

  // Add auto-pin button to channel pages
  function addChannelAutoPinButton() {
    const channelId = getChannelId();
    if (!channelId || document.querySelector('.auto-pin-toggle')) return;

    const toggle = document.createElement('div');
    toggle.className = 'auto-pin-toggle';
    if (autoPinChannels.includes(channelId)) toggle.classList.add('active');
    toggle.innerHTML = `
      Auto-Pin
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="currentColor"/>
      </svg>
    `;
    toggle.addEventListener('click', () => {
      if (toggle.classList.contains('active')) {
        autoPinChannels = autoPinChannels.filter(id => id !== channelId);
        toggle.classList.remove('active');
      } else {
        autoPinChannels.push(channelId);
        toggle.classList.add('active');
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ autoPinChannels });
      } else {
        console.warn('[YouTube Pin] Storage not available, auto-pin settings not saved.');
      }
    });

    const header = document.querySelector('#channel-header');
    if (header) {
      header.appendChild(toggle);
    }
  }

  // Check and auto-pin videos
  function checkAndAutoPinVideo(videoElement) {
    const channelId = getChannelIdFromElement(videoElement);
    if (channelId && autoPinChannels.includes(channelId)) {
      const thumbnail = videoElement.querySelector('a#thumbnail');
      if (!thumbnail) return;
      const videoId = getVideoIdFromUrl(thumbnail.href);
      if (!videoId) return;
      const title = videoElement.querySelector('#video-title')?.textContent || 'Vidéo YouTube';
      pinVideo(videoId, title, thumbnail.href);
    }
  }

  // Observe page changes
  function observePageChanges() {
    console.log('[YouTube Pin] Starting page observer...');

    let lastUrl = window.location.href;

    setInterval(() => {
      if (lastUrl !== window.location.href) {
        console.log('[YouTube Pin] URL changed, updating interface...');
        lastUrl = window.location.href;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['pinnedVideos', 'settings'], function (result) {
            const pinnedVideos = result.pinnedVideos || [];
            const settings = result.settings || { showOnHome: true, showOnThumbnails: true, showOnPlayer: true };

            if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
              if (settings.showOnHome) addPinnedSection(pinnedVideos);
            }
            if (window.location.pathname.includes('/watch')) {
              if (settings.showOnPlayer) addPinButtonToPlayer();
              addFloatingPlayerButton();
            }
            if (window.location.pathname.includes('/channel/') ||
              window.location.pathname.includes('/c/') ||
              window.location.pathname.includes('/user/')) {
              addChannelAutoPinButton();
            }
            if (settings.showOnThumbnails) setupPinButtons();
          });
        } else {
          const pinnedVideos = [];
          const settings = { showOnHome: true, showOnThumbnails: true, showOnPlayer: true };
          if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
            if (settings.showOnHome) addPinnedSection(pinnedVideos);
          }
          if (window.location.pathname.includes('/watch')) {
            if (settings.showOnPlayer) addPinButtonToPlayer();
            addFloatingPlayerButton();
          }
          if (window.location.pathname.includes('/channel/') ||
            window.location.pathname.includes('/c/') ||
            window.location.pathname.includes('/user/')) {
            addChannelAutoPinButton();
          }
          if (settings.showOnThumbnails) setupPinButtons();
        }
      }
    }, 1000);

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['settings'], (result) => {
            const settings = result.settings || { showOnThumbnails: true };
            if (settings.showOnThumbnails) setupPinButtons();
          });
        } else {
          const settings = { showOnThumbnails: true };
          if (settings.showOnThumbnails) setupPinButtons();
        }
      }
    });

    const content = document.querySelector('ytd-app');
    if (content) {
      observer.observe(content, {
        childList: true,
        subtree: true
      });
    }
  }

  // Initialize the extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }
})();
