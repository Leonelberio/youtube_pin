// content.js
(function() {
  // Structure de données pour les catégories
  const defaultCategories = [
    { id: 'default', name: 'Tous les pins' },
    { id: 'watchlater', name: 'À regarder plus tard' },
    { id: 'favorites', name: 'Favoris' },
    { id: 'reference', name: 'Références' }
  ];

  // Configuration pour l'auto-pinning et le floating player
  let autoPinChannels = [];
  let floatingPlayer = null;

  // Initialisation de l'extension avec debug logging
  function initializeExtension() {
    console.log('[YouTube Pin] Initializing extension...');
    
    // Vérification si nous sommes sur YouTube
    if (!window.location.hostname.includes('youtube.com')) {
      console.log('[YouTube Pin] Not on YouTube, exiting...');
      return;
    }
    
    // Charger les données sauvegardées
    chrome.storage.sync.get(['pinnedVideos', 'categories', 'autoPinChannels'], function(result) {
      console.log('[YouTube Pin] Loaded storage data:', result);
      
      const pinnedVideos = result.pinnedVideos || [];
      const categories = result.categories || defaultCategories;
      autoPinChannels = result.autoPinChannels || [];
      
      // Ajouter un délai pour s'assurer que YouTube a chargé ses éléments
      setTimeout(() => {
        // Configurer l'interface
        setupSidebar();
        setupPinButtons();
        
        // Si nous sommes sur la page d'accueil ou les abonnements
        if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
          addPinnedSection(pinnedVideos);
        }
        
        // Si nous sommes sur la page détaillée d'une vidéo
        if (window.location.pathname.includes('/watch')) {
          addPinButtonToPlayer();
          addFloatingPlayerButton();
        }
        
        // Si nous sommes sur une page de chaîne
        if (window.location.pathname.includes('/channel/') || 
            window.location.pathname.includes('/c/') || 
            window.location.pathname.includes('/user/')) {
          addChannelAutoPinButton();
        }
        
        // Observer les changements DOM pour réagir au routage SPA de YouTube
        observePageChanges();
      }, 1500); // Délai pour laisser YouTube charger
    });
  }

  // Ajouter l'onglet "Pinned Videos" dans la barre latérale
  function setupSidebar() {
    console.log('[YouTube Pin] Setting up sidebar...');
    
    // Tenter de trouver la section de navigation principale
    const guideSection = document.querySelector('ytd-guide-section-renderer');
    if (!guideSection) {
      console.log('[YouTube Pin] Guide section not found, retrying...');
      setTimeout(setupSidebar, 1000);
      return;
    }

    // Vérifier si notre élément existe déjà
    if (document.getElementById('pinned-videos-sidebar-item')) {
      console.log('[YouTube Pin] Sidebar item already exists');
      return;
    }

    // Créer notre élément de navigation
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

    // Ajouter l'écouteur d'événements
    sidebarItem.addEventListener('click', () => {
      showPinnedPage();
    });

    // Insérer dans la barre latérale
    const insertPoint = guideSection.querySelector('#sections');
    if (insertPoint) {
      insertPoint.appendChild(sidebarItem);
      console.log('[YouTube Pin] Sidebar item added successfully');
    }
  }

  // Ajouter des boutons Pin sur les miniatures
  function setupPinButtons() {
    console.log('[YouTube Pin] Setting up pin buttons...');
    
    // Sélectionner toutes les miniatures de vidéos
    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer');
    
    videoElements.forEach(videoElement => {
      // Vérifier si un bouton existe déjà
      if (videoElement.querySelector('.pin-button')) return;
      
      // Obtenir les informations de la vidéo
      const thumbnail = videoElement.querySelector('a#thumbnail');
      if (!thumbnail) return;
      
      const videoId = getVideoIdFromUrl(thumbnail.href);
      if (!videoId) return;
      
      const titleElement = videoElement.querySelector('#video-title');
      const title = titleElement ? titleElement.textContent.trim() : 'Vidéo YouTube';
      
      // Créer le bouton Pin
      const pinButton = document.createElement('button');
      pinButton.className = 'pin-button';
      pinButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" fill="currentColor"/>
        </svg>
      `;
      
      // Ajouter l'écouteur d'événements
      pinButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pinVideo(videoId, title, thumbnail.href);
      });
      
      // Ajouter le bouton à la miniature
      const thumbnailContainer = videoElement.querySelector('#thumbnail');
      if (thumbnailContainer) {
        thumbnailContainer.style.position = 'relative';
        thumbnailContainer.appendChild(pinButton);
      }
      
      // Vérifier pour l'auto-pin
      checkAndAutoPinVideo(videoElement);
    });
  }

  // Ajouter la section des vidéos épinglées sur la page d'accueil
  function addPinnedSection(pinnedVideos) {
    if (pinnedVideos.length === 0) {
      console.log('[YouTube Pin] No pinned videos to display');
      return;
    }
    
    console.log('[YouTube Pin] Adding pinned section with videos:', pinnedVideos);
    
    // Trouver l'élément parent
    const primaryContent = document.querySelector('ytd-rich-grid-renderer');
    if (!primaryContent) {
      console.log('[YouTube Pin] Primary content not found, retrying...');
      setTimeout(() => addPinnedSection(pinnedVideos), 1000);
      return;
    }
    
    // Vérifier si la section existe déjà
    if (document.getElementById('pinned-videos-section')) {
      console.log('[YouTube Pin] Pinned section already exists');
      return;
    }
    
    // Créer la section
    const section = document.createElement('div');
    section.id = 'pinned-videos-section';
    section.className = 'pinned-videos-container';
    
    // Ajouter le contenu
    section.innerHTML = `
      <h2 class="pinned-section-title">Vos vidéos épinglées</h2>
      <div class="pinned-video-grid">
        ${pinnedVideos.slice(0, 6).map(video => `
          <div class="pinned-video-card" data-video-id="${video.id}">
            <a href="${video.url}" class="thumbnail-link">
              <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
            </a>
            <div class="video-info">
              <a href="${video.url}" class="video-title">${video.title}</a>
              <div class="video-category">${video.category || 'Non classé'}</div>
            </div>
            <button class="remove-pin" data-video-id="${video.id}">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
      ${pinnedVideos.length > 6 ? `
        <div class="view-all-link">
          <a href="#" id="view-all-pins">Voir toutes vos vidéos épinglées (${pinnedVideos.length})</a>
        </div>
      ` : ''}
    `;
    
    // Ajouter les écouteurs d'événements
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
    
    // Insérer la section
    primaryContent.parentNode.insertBefore(section, primaryContent);
    console.log('[YouTube Pin] Pinned section added successfully');
  }

  // Obtenir l'ID d'une vidéo à partir de son URL
  function getVideoIdFromUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url, window.location.origin);
      let videoId = null;
      
      // Format watch?v=
      if (urlObj.pathname === '/watch') {
        videoId = urlObj.searchParams.get('v');
      }
      
      // Format /v/ ou /embed/ ou /shorts/
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

  // Obtenir l'ID d'une chaîne
  function getChannelId() {
    const path = window.location.pathname;
    const matches = path.match(/\/channel\/(UC[\w-]+)/);
    if (matches) return matches[1];
    
    // Pour les URLs personnalisées
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      const href = canonicalLink.getAttribute('href');
      const canonicalMatches = href?.match(/\/channel\/(UC[\w-]+)/);
      if (canonicalMatches) return canonicalMatches[1];
    }
    
    return null;
  }

  // Épingler une vidéo
  function pinVideo(videoId, title, url) {
    console.log('[YouTube Pin] Pinning video:', { videoId, title, url });
    
    chrome.storage.sync.get(['pinnedVideos'], function(result) {
      let pinnedVideos = result.pinnedVideos || [];
      
      // Vérifier si la vidéo est déjà épinglée
      if (pinnedVideos.some(v => v.id === videoId)) {
        showToast('Cette vidéo est déjà épinglée');
        return;
      }
      
      // Ajouter la vidéo
      const newVideo = {
        id: videoId,
        title: title,
        url: url,
        timestamp: Date.now(),
        category: 'default'
      };
      
      pinnedVideos.unshift(newVideo);
      
      // Sauvegarder
      chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function() {
        showToast('Vidéo épinglée ✅');
        
        // Actualiser la section si nous sommes sur la page d'accueil
        if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
          addPinnedSection(pinnedVideos);
        }
      });
    });
  }

  // Désépingler une vidéo
  function unpinVideo(videoId) {
    console.log('[YouTube Pin] Unpinning video:', videoId);
    
    chrome.storage.sync.get(['pinnedVideos'], function(result) {
      let pinnedVideos = result.pinnedVideos || [];
      
      // Filtrer la vidéo
      pinnedVideos = pinnedVideos.filter(v => v.id !== videoId);
      
      // Sauvegarder
      chrome.storage.sync.set({ 'pinnedVideos': pinnedVideos }, function() {
        showToast('Vidéo désépinglée');
        
        // Actualiser l'interface
        const card = document.querySelector(`.pinned-video-card[data-video-id="${videoId}"]`);
        if (card) {
          card.remove();
        }
        
        // Si plus de vidéos, masquer la section
        if (pinnedVideos.length === 0) {
          const section = document.getElementById('pinned-videos-section');
          if (section) section.remove();
        }
      });
    });
  }

  // Afficher une notification toast
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
    
    // Afficher
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Masquer après 3 secondes
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Afficher la page complète des vidéos épinglées
  function showPinnedPage() {
    console.log('[YouTube Pin] Showing pinned videos page');
    
    chrome.storage.sync.get(['pinnedVideos', 'categories'], function(result) {
      const pinnedVideos = result.pinnedVideos || [];
      const categories = result.categories || defaultCategories;
      
      // Sauvegarder le contenu actuel
      const mainContent = document.querySelector('ytd-browse');
      if (!mainContent) {
        console.log('[YouTube Pin] Main content not found');
        return;
      }
      
      const originalContent = mainContent.innerHTML;
      
      // Créer la page des vidéos épinglées
      mainContent.innerHTML = `
        <div id="pinned-videos-page">
          <div class="pinned-header">
            <h1>Mes vidéos épinglées</h1>
            <div class="view-options">
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
                  <div class="pinned-video-item" data-id="${video.id}" data-category="${video.category || 'default'}">
                    <a href="${video.url}" class="thumbnail-container">
                      <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
                    </a>
                    <div class="video-details">
                      <a href="${video.url}" class="video-title">${video.title}</a>
                      <div class="video-category">${video.category || 'Non classé'}</div>
                      <div class="video-actions">
                        <button class="category-select" data-id="${video.id}">
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" fill="currentColor"/>
                          </svg>
                          Catégorie
                        </button>
                        <button class="remove-pin" data-id="${video.id}">
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"/>
                          </svg>
                          Supprimer
                        </button>
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
      
      // Ajouter les écouteurs d'événements
      
      // Vue grille/liste
      document.getElementById('grid-view')?.addEventListener('click', function() {
        const container = document.getElementById('pinned-videos-container');
        if (container) {
          container.className = 'grid-view';
          document.getElementById('grid-view')?.classList.add('active');
          document.getElementById('list-view')?.classList.remove('active');
        }
      });
      
      document.getElementById('list-view')?.addEventListener('click', function() {
        const container = document.getElementById('pinned-videos-container');
        if (container) {
          container.className = 'list-view';
          document.getElementById('list-view')?.classList.add('active');
          document.getElementById('grid-view')?.classList.remove('active');
        }
      });
      
      // Filtrer par catégorie
      document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function(e) {
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
      
      // Ajouter une catégorie
      document.getElementById('add-category')?.addEventListener('click', function() {
        const name = prompt('Nom de la nouvelle catégorie:');
        if (!name) return;
        
        const id = 'category_' + Date.now();
        categories.push({ id, name });
        
        chrome.storage.sync.set({ categories }, function() {
          showPinnedPage(); // Recharger la page
        });
      });
      
      // Supprimer un pin
      document.querySelectorAll('.remove-pin').forEach(button => {
        button.addEventListener('click', function() {
          const videoId = this.getAttribute('data-id');
          if (videoId) {
            unpinVideo(videoId);
            showPinnedPage(); // Recharger la page
          }
        });
      });
      
      // Gérer les catégories
      document.querySelectorAll('.category-select').forEach(button => {
        button.addEventListener('click', function(e) {
          const videoId = this.getAttribute('data-id');
          if (!videoId) return;
          
          // Créer le menu de sélection
          const menu = document.createElement('div');
          menu.className = 'category-menu';
          menu.innerHTML = `
            <div class="category-menu-items">
              ${categories.map(cat => `
                <div class="category-menu-item" data-id="${cat.id}">${cat.name}</div>
              `).join('')}
            </div>
          `;
          
          // Positionner le menu
          const rect = this.getBoundingClientRect();
          menu.style.position = 'absolute';
          menu.style.top = rect.bottom + 'px';
          menu.style.left = rect.left + 'px';
          
          document.body.appendChild(menu);
          
          // Gérer la sélection
          menu.querySelectorAll('.category-menu-item').forEach(item => {
            item.addEventListener('click', function() {
              const categoryId = this.getAttribute('data-id');
              if (!categoryId) return;
              
              chrome.storage.sync.get(['pinnedVideos'], function(result) {
                let pinnedVideos = result.pinnedVideos || [];
                
                pinnedVideos = pinnedVideos.map(video => {
                  if (video.id === videoId) {
                    return { ...video, category: categoryId };
                  }
                  return video;
                });
                
                chrome.storage.sync.set({ pinnedVideos }, function() {
                  showPinnedPage(); // Recharger la page
                });
              });
              
              menu.remove();
            });
          });
          
          // Fermer le menu si on clique ailleurs
          document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== button) {
              menu.remove();
              document.removeEventListener('click', closeMenu);
            }
          });
        });
      });
      
      // Retour à YouTube
      document.getElementById('back-to-youtube')?.addEventListener('click', function() {
        mainContent.innerHTML = originalContent;
      });
    });
  }

  // Observer les changements de page
  function observePageChanges() {
    console.log('[YouTube Pin] Starting page observer...');
    
    let lastUrl = window.location.href;
    
    // Vérifier les changements d'URL
    setInterval(() => {
      if (lastUrl !== window.location.href) {
        console.log('[YouTube Pin] URL changed, updating interface...');
        lastUrl = window.location.href;
        
        chrome.storage.sync.get(['pinnedVideos'], function(result) {
          const pinnedVideos = result.pinnedVideos || [];
          
          if (window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions') {
            addPinnedSection(pinnedVideos);
          }
          
          if (window.location.pathname.includes('/watch')) {
            addPinButtonToPlayer();
            addFloatingPlayerButton();
          }
          
          if (window.location.pathname.includes('/channel/') || 
              window.location.pathname.includes('/c/') || 
              window.location.pathname.includes('/user/')) {
            addChannelAutoPinButton();
          }
          
          setupPinButtons();
        });
      }
    }, 1000);
    
    // Observer les changements du DOM
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });
      
      if (shouldUpdate) {
        setupPinButtons();
      }
    });
    
    // Observer le contenu principal
    const content = document.querySelector('ytd-app');
    if (content) {
      observer.observe(content, {
        childList: true,
        subtree: true
      });
    }
  }

  // Initialiser l'extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }
})();
