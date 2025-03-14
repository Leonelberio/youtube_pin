document.addEventListener('DOMContentLoaded', function () {
  loadData();

  document.getElementById('viewAllPins').addEventListener('click', openPinnedPage);
  document.getElementById('showOnHome').addEventListener('change', saveSettings);
  document.getElementById('showOnThumbnails').addEventListener('change', saveSettings);
  document.getElementById('showOnPlayer').addEventListener('change', saveSettings);
  document.getElementById('addCategory').addEventListener('click', addCategory);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', importData);
  document.getElementById('clearAll').addEventListener('click', clearAllData);

  function loadData() {
    chrome.storage.sync.get(['pinnedVideos', 'categories', 'settings'], function (result) {
      const pinnedVideos = result.pinnedVideos || [];
      const categories = result.categories || [
        { id: 'default', name: 'Tous les pins' },
        { id: 'watchlater', name: 'À regarder plus tard' },
        { id: 'favorites', name: 'Favoris' },
        { id: 'reference', name: 'Références' }
      ];
      const settings = result.settings || {
        showOnHome: true,
        showOnThumbnails: true,
        showOnPlayer: true
      };

      document.getElementById('pinnedCount').innerText = `${pinnedVideos.length} vidéo${pinnedVideos.length !== 1 ? 's' : ''} épinglée${pinnedVideos.length !== 1 ? 's' : ''}`;
      document.getElementById('showOnHome').checked = settings.showOnHome;
      document.getElementById('showOnThumbnails').checked = settings.showOnThumbnails;
      document.getElementById('showOnPlayer').checked = settings.showOnPlayer;
      displayCategories(categories, pinnedVideos);
    });
  }

  function displayCategories(categories, pinnedVideos) {
    const categoriesContainer = document.getElementById('categories');
    categoriesContainer.innerHTML = '';

    categories.forEach(category => {
      const count = pinnedVideos.filter(video => (video.category || 'default') === category.id).length;
      const categoryElement = document.createElement('div');
      categoryElement.className = 'category-item';
      categoryElement.innerHTML = `
        <div>
          <div class="category-name">${category.name}</div>
          <div class="category-count">${count} vidéo${count !== 1 ? 's' : ''}</div>
        </div>
        <div class="category-actions">
          ${category.id !== 'default' ? `
            <button class="edit-category" data-id="${category.id}">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" fill="currentColor"></path>
              </svg>
            </button>
            <button class="delete-category" data-id="${category.id}">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor"></path>
              </svg>
            </button>
          ` : ''}
        </div>
      `;
      categoriesContainer.appendChild(categoryElement);
    });

    document.querySelectorAll('.edit-category').forEach(button => {
      button.addEventListener('click', function () {
        const categoryId = this.getAttribute('data-id');
        editCategory(categoryId, categories);
      });
    });

    document.querySelectorAll('.delete-category').forEach(button => {
      button.addEventListener('click', function () {
        const categoryId = this.getAttribute('data-id');
        deleteCategory(categoryId);
      });
    });
  }

  function addCategory() {
    const input = document.getElementById('newCategory');
    const categoryName = input.value.trim();
    if (!categoryName) return;

    chrome.storage.sync.get(['categories'], function (result) {
      const categories = result.categories || [
        { id: 'default', name: 'Tous les pins' },
        { id: 'watchlater', name: 'À regarder plus tard' },
        { id: 'favorites', name: 'Favoris' },
        { id: 'reference', name: 'Références' }
      ];

      const categoryId = 'category_' + Date.now();
      categories.push({ id: categoryId, name: categoryName });

      chrome.storage.sync.set({ 'categories': categories }, function () {
        input.value = '';
        loadData();
      });
    });
  }

  function editCategory(categoryId, categories) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const newName = prompt('Modifier le nom de la catégorie:', category.name);
    if (!newName || newName === category.name) return;

    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, name: newName };
      }
      return cat;
    });

    chrome.storage.sync.set({ 'categories': updatedCategories }, function () {
      loadData();
    });
  }

  function deleteCategory(categoryId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Les vidéos seront déplacées vers "Tous les pins".')) return;

    chrome.storage.sync.get(['categories', 'pinnedVideos'], function (result) {
      const categories = result.categories || [];
      const pinnedVideos = result.pinnedVideos || [];

      const updatedCategories = categories.filter(cat => cat.id !== categoryId);
      const updatedVideos = pinnedVideos.map(video => {
        if ((video.category || 'default') === categoryId) {
          return { ...video, category: 'default' };
        }
        return video;
      });

      chrome.storage.sync.set({
        'categories': updatedCategories,
        'pinnedVideos': updatedVideos
      }, function () {
        loadData();
      });
    });
  }

  function saveSettings() {
    const settings = {
      showOnHome: document.getElementById('showOnHome').checked,
      showOnThumbnails: document.getElementById('showOnThumbnails').checked,
      showOnPlayer: document.getElementById('showOnPlayer').checked
    };

    chrome.storage.sync.set({ 'settings': settings }, function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0].url.includes('youtube.com')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  }

  function exportData() {
    chrome.storage.sync.get(['pinnedVideos', 'categories', 'settings'], function (result) {
      const data = JSON.stringify(result, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'youtube_pin_backup_' + new Date().toISOString().split('T')[0] + '.json';
      document.body.appendChild(a);
      a.click();

      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    });
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.pinnedVideos && !data.categories && !data.settings) {
            throw new Error('Format de fichier invalide');
          }
          if (confirm('Êtes-vous sûr de vouloir importer ces données ? Cela remplacera vos données actuelles.')) {
            chrome.storage.sync.set(data, function () {
              alert('Données importées avec succès !');
              loadData();
              chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0].url.includes('youtube.com')) {
                  chrome.tabs.reload(tabs[0].id);
                }
              });
            });
          }
        } catch (error) {
          alert('Erreur lors de l\'importation : ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function clearAllData() {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes vos vidéos épinglées et catégories ? Cette action est irréversible.')) {
      chrome.storage.sync.clear(function () {
        alert('Toutes les données ont été effacées.');
        loadData();
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0].url.includes('youtube.com')) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    }
  }

  function openPinnedPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showPinnedPage' });
        window.close();
      } else {
        chrome.tabs.create({ url: 'https://www.youtube.com' }, function (tab) {
          setTimeout(function () {
            chrome.tabs.sendMessage(tab.id, { action: 'showPinnedPage' });
          }, 3000);
        });
      }
    });
  }
});