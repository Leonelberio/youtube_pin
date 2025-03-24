(function () {
  const defaultCategories = [
    { id: 'default', name: 'Tous les pins' },
    { id: 'watchlater', name: 'À regarder plus tard' },
    { id: 'favorites', name: 'Favoris' },
    { id: 'reference', name: 'Références' }
  ];

  let autoPinChannels = [];
  let floatingPlayer = null;
  let isFocusMode = false;

  // Initialize the extension
  function initializeExtension() {
    console.log('[YouTube Pin] Initializing extension...');

    if (!window.location.hostname.includes('youtube.com')) {
      console.log('[YouTube Pin] Not on YouTube, exiting...');
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['pinnedVideos', 'categories', 'autoPinChannels', 'settings', 'focusMode'], function (result) {
        const pinnedVideos = result.pinnedVideos || [];
        const categories = result.categories || defaultCategories;
        autoPinChannels = result.autoPinChannels || [];
        const settings = result.settings || {
          showOnHome: true,
          showOnThumbnails: true,
          showOnPlayer: true
        };
        isFocusMode = result.focusMode || false;

        setTimeout(() => {
          if (isFocusMode && window.location.pathname.includes('/watch')) {
            document.body.setAttribute('focus-mode', 'true');
          }
          setupUI(settings, pinnedVideos);
          observePageChanges();
        }, 1500);
      });
    } else {
      console.error('[YouTube Pin] chrome.storage.sync is not available');
    }
  }

  function setupUI(settings, pinnedVideos) {
    setupSidebar();
    if (settings.showOnThumbnails) setupPinButtons();
    if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
      if (settings.showOnHome) addPinnedSection(pinnedVideos);
    }
    if (window.location.pathname.includes('/watch')) {
      if (settings.showOnPlayer) addPinButtonToPlayer();
      addFloatingPlayerButton();
      addFocusModeButton();
    }
    if (window.location.pathname.includes('/channel/') ||
        window.location.pathname.includes('/c/') ||
        window.location.pathname.includes('/user/')) {
      addChannelAutoPinButton();
    }
  }

  function setupSidebar() {
    const guideSection = document.querySelector('ytd-guide-section-renderer');
    if (!guideSection) {
      setTimeout(setupSidebar, 1000);
      return;
    }

    if (document.getElementById('pinned-videos-sidebar-item')) return;

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

    sidebarItem.addEventListener('click', () => showPinnedPage());
    const insertPoint = guideSection.querySelector('#sections');
    if (insertPoint) insertPoint.appendChild(sidebarItem);
  }

  function setupPinButtons() {
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

      // Check if video is pinned
      chrome.storage.sync.get(['pinnedVideos'], function(result) {
        const pinnedVideos = result.pinnedVideos || [];
        const video = pinnedVideos.find(v => v.id === videoId);
        if (video) {
          pinButton.classList.add('active');
        }
      });

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

      checkAndAutoPinVideo(videoElement);
    });
  }

  function addFocusModeButton() {
    const player = document.querySelector('.html5-video-player');
    if (!player || player.querySelector('.focus-mode-button')) return;

    // Create focus mode button
    const focusModeButton = document.createElement('button');
    focusModeButton.className = 'focus-mode-button';
    focusModeButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.79-13.29a.996.996 0 0 0-1.41 0L12 9.09 9.62 6.71a.996.996 0 1 0-1.41 1.41L10.59 10.5 8.21 12.88a.996.996 0 1 0 1.41 1.41L12 11.91l2.38 2.38a.996.996 0 1 0 1.41-1.41L13.41 10.5l2.38-2.38c.39-.39.39-1.02 0-1.41z" fill="currentColor"/>
      </svg>
    `;

    // Get saved focus mode state
    chrome.storage.sync.get(['focusMode'], function(result) {
      isFocusMode = result.focusMode || false;
      if (isFocusMode) {
        focusModeButton.classList.add('active');
        document.body.setAttribute('focus-mode', 'true');
      }
    });

    // Add click event listener
    focusModeButton.addEventListener('click', toggleFocusMode);

    // Add button to player controls
    const controls = player.querySelector('.ytp-right-controls');
    if (controls) {
      controls.prepend(focusModeButton);
    }
  }

  function toggleFocusMode() {
    isFocusMode = !isFocusMode;
    
    // Update button state
    const focusModeButton = document.querySelector('.focus-mode-button');
    if (focusModeButton) {
      if (isFocusMode) {
        focusModeButton.classList.add('active');
      } else {
        focusModeButton.classList.remove('active');
      }
    }

    // Update body attribute to trigger CSS changes
    document.body.setAttribute('focus-mode', isFocusMode);

    // Save state
    chrome.storage.sync.set({ focusMode: isFocusMode }, function() {
      showToast(isFocusMode ? 'Focus mode activé' : 'Focus mode désactivé');
    });
  }

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

  function makeDraggable(el) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = el.querySelector('.floating-player-header');
    
    if (header) {
      header.addEventListener('mousedown', dragMouseDown);
    }

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

  function addPinnedSection(pinnedVideos) {
    if (pinnedVideos.length === 0) return;

    const primaryContent = document.querySelector('ytd-rich-grid-renderer');
    if (!primaryContent) {
      setTimeout(() => addPinnedSection(pinnedVideos), 1000);
      return;
    }

    if (document.getElementById('pinned-videos-section')) return;

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
            <div class="pinned-video-card" data-video-id="${video.id}" data-category="${video.category || 'default'}">
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

    setupSectionEventListeners(section);
    primaryContent.parentNode.insertBefore(section, primaryContent);
  }

  function setupSectionEventListeners(section) {
    section.querySelectorAll('.remove-pin').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const videoId = button.dataset.videoId;
        unpinVideo(videoId);
      });
    });

    const viewAllLink = section.querySelector('#view-all-pins');
    if (viewAllLink) {
      viewAllLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPinnedPage();
      });
    }

    const grid = section.querySelector('.pinned-video-grid');
    const scrollLeft = section.querySelector('#scroll-left');
    const scrollRight = section.querySelector('#scroll-right');

    scrollLeft?.addEventListener('click', () => {
      grid.scrollBy({ left: -200, behavior: 'smooth' });
    });

    scrollRight?.addEventListener('click', () => {
      grid.scrollBy({ left: 200, behavior: 'smooth' });
    });

    grid?.addEventListener('scroll', () => {
      if (scrollLeft) scrollLeft.style.display = grid.scrollLeft > 0 ? 'block' : 'none';
      if (scrollRight) scrollRight.style.display = 
        grid.scrollWidth > grid.clientWidth + grid.scrollLeft ? 'block' : 'none';
    });
  }

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

        pinnedVideos.unshift(newVideo);
        chrome.storage.sync.set({ pinnedVideos }, function () {
          showToast('Vidéo épinglée ✅');
          if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
            const existingSection = document.getElementById('pinned-videos-section');
            if (!existingSection) {
              addPinnedSection(pinnedVideos);
            } else {
              refreshPinnedSection(pinnedVideos, newVideo);
            }
          }
        });
      });
    } else {
      showToast('Pin failed: Storage unavailable');
    }
  }

    function refreshPinnedSection(pinnedVideos, newVideo) {
      const grid = document.querySelector('.pinned-video-grid');
      if (!grid) return;
      
      const videoCard = document.createElement('div');
      videoCard.className = 'pinned-video-card new';
      videoCard.dataset.videoId = newVideo.id;
      videoCard.dataset.category = newVideo.category || 'default';
      videoCard.innerHTML = `
        <a href="${newVideo.url}" class="thumbnail-container">
          <img src="https://i.ytimg.com/vi/${newVideo.id}/mqdefault.jpg" alt="${newVideo.title}">
        </a>
        <button class="remove-pin" data-video-id="${newVideo.id}">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"/>
          </svg>
        </button>
        <div class="video-info">
          <a href="${newVideo.url}" class="video-title">${newVideo.title}</a>
          <div class="video-category">${newVideo.category || 'Non classé'}</div>
        </div>
      `;
      
      // Add new video card at the beginning
      grid.insertBefore(videoCard, grid.firstChild);
      
      // Setup event listeners for the new card
      const removeButton = videoCard.querySelector('.remove-pin');
      if (removeButton) {
        removeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          unpinVideo(newVideo.id);
        });
      }
    }

    function unpinVideo(videoId) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['pinnedVideos'], function (result) {
        let pinnedVideos = result.pinnedVideos || [];
        pinnedVideos = pinnedVideos.filter(v => v.id !== videoId);

        chrome.storage.sync.set({ pinnedVideos }, function () {
          showToast('Vidéo désépinglée');
          const card = document.querySelector(`.pinned-video-card[data-video-id="${videoId}"]`);
          if (card) {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => card.remove(), 300);
          }
          if (pinnedVideos.length === 0) {
            const section = document.getElementById('pinned-videos-section');
            if (section) section.remove();
          }
        });
      });
    } else {
      showToast('Unpin failed: Storage unavailable');
    }
  }

  function showToast(message) {
    let toast = document.getElementById('pin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pin-toast';
      document.body.appendChild(toast);
    }

    toast.className = 'pin-toast';
    toast.textContent = message;
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function checkAndAutoPinVideo(videoElement) {
    const channelLink = videoElement.querySelector('a[href*="/channel/"], a[href*="/user/"], a[href*="/@"]');
    if (!channelLink) return;

    const href = channelLink.getAttribute('href');
    const matches = href?.match(/\/(channel|user|@)([^/?&]+)/);
    if (!matches) return;

    const channelId = matches[2];
    if (autoPinChannels.includes(channelId)) {
      const thumbnail = videoElement.querySelector('a#thumbnail');
      if (!thumbnail) return;

      const videoId = getVideoIdFromUrl(thumbnail.href);
      const titleElement = videoElement.querySelector('#video-title');
      const title = titleElement ? titleElement.textContent.trim() : 'Vidéo YouTube';
      
      if (videoId) {
        pinVideo(videoId, title, thumbnail.href);
      }
    }
  }

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
        mainContent.innerHTML = generatePinnedPageHTML(pinnedVideos, categories);
        setupEventListeners(originalContent);
      });
    } else {
      showEmptyState();
    }
  }

  function generatePinnedPageHTML(pinnedVideos, categories) {
    return `
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
             <button id="back-to-youtube" class="back-button">
          Retour à YouTube
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
          ${pinnedVideos.length === 0 ? generateEmptyState() : generateVideoGrid(pinnedVideos)}
        </div>
       
      </div>
    `;
  }

  function generateVideoGrid(pinnedVideos) {
    return `
      <div id="pinned-videos-container" class="grid-view">
        ${pinnedVideos.map(video => `
          <div class="pinned-video-card" data-video-id="${video.id}" data-category="${video.category || 'default'}">
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
              <div class="video-category">${video.category || 'Non classé'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function setupEventListeners(originalContent) {
    setupViewToggle();
    setupSearch();
    setupCategoryFilter();
    setupRemoveButtons();
    setupAddCategory();
    setupBackButton(originalContent);
  }

  function setupViewToggle() {
    const gridView = document.getElementById('grid-view');
    const listView = document.getElementById('list-view');
    const container = document.getElementById('pinned-videos-container');

    gridView?.addEventListener('click', () => {
      container?.classList.remove('list-view');
      container?.classList.add('grid-view');
      gridView.classList.add('active');
      listView?.classList.remove('active');
    });

    listView?.addEventListener('click', () => {
      container?.classList.remove('grid-view');
      container?.classList.add('list-view');
      listView.classList.add('active');
      gridView?.classList.remove('active');
    });
  }

  function setupSearch() {
    const searchInput = document.getElementById('searchPins');
    if (searchInput) {
      searchInput.value = '';
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.pinned-video-card').forEach(item => {
          const title = item.querySelector('.video-title')?.textContent.toLowerCase() || '';
          item.style.display = title.includes(query) ? '' : 'none';
        });
      });
    }
  }

  function setupCategoryFilter() {
    document.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const links = document.querySelectorAll('.category-item a');
        links.forEach(link => link.classList.remove('active'));
        item.querySelector('a')?.classList.add('active');

        const categoryId = item.getAttribute('data-id');
        document.querySelectorAll('.pinned-video-card').forEach(video => {
          const videoCategory = video.getAttribute('data-category');
          video.style.display = (categoryId === 'default' || videoCategory === categoryId) ? '' : 'none';
        });
      });
    });
  }

  function setupAddCategory() {
    const addButton = document.getElementById('add-category');
    if (addButton) {
      addButton.addEventListener('click', () => {
        const name = prompt('Nom de la nouvelle catégorie:');
        if (!name) return;

        const id = 'category_' + Date.now();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['categories'], function (result) {
            const categories = result.categories || defaultCategories;
            categories.push({ id, name });
            chrome.storage.sync.set({ categories }, () => showPinnedPage());
          });
        }
      });
    }
  }

  function setupRemoveButtons() {
    document.querySelectorAll('.remove-pin').forEach(button => {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const videoId = this.getAttribute('data-video-id');
        if (videoId) {
          unpinVideo(videoId);
        }
      });
    });
  }

  function setupBackButton(originalContent) {
    const backButton = document.getElementById('back-to-youtube');
    if (backButton) {
      backButton.addEventListener('click', () => {
        const mainContent = document.querySelector('ytd-browse');
        if (mainContent) mainContent.innerHTML = originalContent;
      });
    }
  }

  function observePageChanges() {
    let lastUrl = window.location.href;

    setInterval(() => {
      if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['pinnedVideos', 'settings', 'focusMode'], function (result) {
            const pinnedVideos = result.pinnedVideos || [];
            const settings = result.settings || { showOnHome: true, showOnThumbnails: true, showOnPlayer: true };
            const focusMode = result.focusMode || false;

            if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
              if (settings.showOnHome) addPinnedSection(pinnedVideos);
            }
            if (window.location.pathname.includes('/watch')) {
              if (settings.showOnPlayer) addPinButtonToPlayer();
              addFloatingPlayerButton();
              addFocusModeButton();
              // Restore focus mode state
              if (focusMode) {
                document.body.setAttribute('focus-mode', 'true');
              }
            }
            if (settings.showOnThumbnails) setupPinButtons();
          });
        }
      }
    }, 1000);

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = mutations.some(mutation => mutation.addedNodes.length > 0);
      if (shouldUpdate) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['settings'], (result) => {
            const settings = result.settings || { showOnThumbnails: true };
            if (settings.showOnThumbnails) setupPinButtons();
          });
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

  function generateEmptyState() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="64" height="64">
          <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="#aaaaaa"/>
        </svg>
        <h2>Vous n'avez pas encore de vidéos épinglées</h2>
        <p>Naviguez sur YouTube et cliquez sur le bouton "Pin" pour ajouter des vidéos ici.</p>
      </div>
    `;
  }

  function showEmptyState() {
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

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

  // Add message listener for popup actions
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[YouTube Pin] Received message:', request);
    if (request.action === 'showPinnedPage') {
      console.log('[YouTube Pin] Showing pinned page from popup');
      showPinnedPage();
      sendResponse({ status: 'success' });
    }
    return true;
  });
})();
