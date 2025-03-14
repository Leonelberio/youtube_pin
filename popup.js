// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Charger les données
  loadData();
  
  // Ajouter les écouteurs d'événements
  document.getElementById('viewAllPins').addEventListener('click', openPinnedPage);
  document.getElementById('showOnHome').addEventListener('change', saveSettings);
  document.getElementById('showOnThumbnails').addEventListener('change', saveSettings);
  document.getElementById('showOnPlayer').addEventListener('change', saveSettings);
  document.getElementById('addCategory').addEventListener('click', addCategory);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', importData);
  document.getElementById('clearAll').addEventListener('click', clearAllData);
  
  // Fonction pour charger les données
  function loadData() {
    chrome.storage.sync.get(['pinnedVideos', 'categories', 'settings'], function(result) {
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
      
      // Mettre à jour le compteur
      document.getElementById('pinnedCount').innerText = `${pinnedVideos.length} vidéo${pinnedVideos.length !== 1 ? 's' : ''} épinglée${pinnedVideos.length !== 1 ? 's' : ''}`;
      
      // Charger les paramètres
      document.getElementById('showOnHome').checked = settings.showOnHome;
      document.getElementById('showOnThumbnails').checked = settings.showOnThumbnails;
      document.getElementById('showOnPlayer').checked = settings.showOnPlayer;
      
      // Afficher les catégories
      displayCategories(categories, pinnedVideos);
    });
  }
  
  // Fonction pour afficher les catégories
  function displayCategories(categories, pinnedVideos) {
    const categoriesContainer = document.getElementById('categories');
    categoriesContainer.innerHTML = '';
    
    categories.forEach(category => {
      // Compter le nombre de vidéos dans cette catégorie
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
    
    // Ajouter les écouteurs d'événements pour les boutons de catégorie
    document.querySelectorAll('.edit-category').forEach(button => {
      button.addEventListener('click', function() {
        const categoryId = this.getAttribute('data-id');
        editCategory(categoryId, categories);
      });
    });
    
    document.querySelectorAll('.delete-category').forEach(button => {
      button.addEventListener('click', function() {
        const categoryId = this.getAttribute('data-id');
        deleteCategory(categoryId);
      });
    });
  }
  
  // Fonction pour ajouter une catégorie
  function addCategory() {
    const input = document.getElementById('newCategory');
    const categoryName = input.value.trim();
    
    if (!categoryName) return;
    
    chrome.storage.sync.get(['categories'], function(result) {
      const categories = result.categories || [
        { id: 'default', name: 'Tous les pins' },
        { id: 'watchlater', name: 'À regarder plus tard' },
        { id: 'favorites', name: 'Favoris' },
        { id: 'reference', name: 'Références' }
      ];
      
      // Créer une nouvelle catégorie
      const categoryId = 'category_' + Date.now();
      categories.push({ id: categoryId, name: categoryName });
      
      // Sauvegarder les catégories
      chrome.storage.sync.set({ 'categories': categories }, function() {
        // Actualiser l'affichage
        input.value = '';
        loadData();
      });
    });
  }
  
  // Fonction pour modifier une catégorie
  function editCategory(categoryId, categories) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;
    
    const newName = prompt('Modifier le nom de la catégorie:', category.name);
    if (!newName || newName === category.name) return;
    
    // Mettre à jour le nom de la catégorie
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, name: newName };
      }
      return cat;
    });
    
    // Sauvegarder les catégories
    chrome.storage.sync.set({ 'categories': updatedCategories }, function() {
      // Actualiser l'affichage
      loadData();
    });
  }
  
  // Fonction pour supprimer une catégorie
  function deleteCategory(categoryId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Les vidéos seront déplacées vers "Tous les pins".')) return;
    
    // Supprimer la catégorie et réaffecter les vidéos
    chrome.storage.sync.get(['categories', 'pinnedVideos'], function(result) {
      const categories = result.categories || [];
      const pinnedVideos = result.pinnedVideos || [];
      
      // Supprimer la catégorie
      const updatedCategories = categories.filter(cat => cat.id !== categoryId);
      
      // Réaffecter les vidéos à la catégorie par défaut
      const updatedVideos = pinnedVideos.map(video => {
        if ((video.category || 'default') === categoryId) {
          return { ...video, category: 'default' };
        }
        return video;
      });
      
      // Sauvegarder les données
      chrome.storage.sync.set({
        'categories': updatedCategories,
        'pinnedVideos': updatedVideos
      }, function() {
        // Actualiser l'affichage
        loadData();
      });
    });
  }
  
  // Fonction pour sauvegarder les paramètres
  function saveSettings() {
    const settings = {
      showOnHome: document.getElementById('showOnHome').checked,
      showOnThumbnails: document.getElementById('showOnThumbnails').checked,
      showOnPlayer: document.getElementById('showOnPlayer').checked
    };
    
    chrome.storage.sync.set({ 'settings': settings }, function() {
      // Rafraîchir l'onglet actif pour appliquer les changements
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('youtube.com')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  }
  
  // Fonction pour exporter les données
  function exportData() {
    chrome.storage.sync.get(['pinnedVideos', 'categories', 'settings'], function(result) {
      const data = JSON.stringify(result, null, 2);
      
      // Créer un lien de téléchargement
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'youtube_pin_backup_' + new Date().toISOString().split('T')[0] + '.json';
      
      // Déclencher le téléchargement
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    });
  }
  
  // Fonction pour importer des données
  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          
          // Vérifier que les données sont valides
          if (!data.pinnedVideos && !data.categories && !data.settings) {
            throw new Error('Format de fichier invalide');
          }
          
          // Demander confirmation
          if (confirm('Êtes-vous sûr de vouloir importer ces données ? Cela remplacera vos données actuelles.')) {
            // Importer les données
            chrome.storage.sync.set(data, function() {
              alert('Données importées avec succès !');
              loadData();
              
              // Rafraîchir l'onglet actif pour appliquer les changements
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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
  
  // Fonction pour effacer toutes les données
  function clearAllData() {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes vos vidéos épinglées et catégories ? Cette action est irréversible.')) {
      chrome.storage.sync.clear(function() {
        alert('Toutes les données ont été effacées.');
        loadData();
        
        // Rafraîchir l'onglet actif pour appliquer les changements
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0].url.includes('youtube.com')) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    }
  }
  
  // Fonction pour ouvrir la page des pins
  function openPinnedPage() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Si nous sommes sur YouTube, envoyer un message pour afficher la page des pins
      if (tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showPinnedPage' });
        window.close();
      } else {
        // Sinon, ouvrir YouTube dans un nouvel onglet
        chrome.tabs.create({ url: 'https://www.youtube.com' }, function(tab) {
          // Attendre que la page soit chargée pour afficher la page des pins
          setTimeout(function() {
            chrome.tabs.sendMessage(tab.id, { action: 'showPinnedPage' });
          }, 3000);
        });
      }
    });
  }
});