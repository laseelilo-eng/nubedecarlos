// script.js adaptado para IndexedDB y asincronía
(() => {
  'use strict';

  // Constantes y selectores
  const LS_SESSION_KEY = 'seguridadCR_session';

  // Elementos login/registro
  const authContainer = document.getElementById('auth-container');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const registerForm = document.getElementById('register-form');
  const registerUsernameInput = document.getElementById('register-username');
  const registerPasswordInput = document.getElementById('register-password');
  const registerPassword2Input = document.getElementById('register-password2');
  const registerError = document.getElementById('register-error');
  const toRegisterBtn = document.getElementById('to-register');
  const toLoginBtn = document.getElementById('to-login');

  // Elementos app
  const app = document.getElementById('app');
  const logoutBtn = document.getElementById('logout-btn');
  const foldersContainer = document.getElementById('folders-container');
  const createFolderBtn = document.getElementById('create-folder-btn');
  const uploadInput = document.getElementById('upload-input');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');

  const folderNameDialog = document.getElementById('folder-name-dialog');
  const folderNameInput = document.getElementById('folder-name-input');
  const folderNameForm = document.getElementById('folder-name-form');
  const folderError = document.getElementById('folder-error');
  const cancelFolderNameBtn = document.getElementById('cancel-folder-name');

  // Visor imágenes
  const imageViewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const viewerCloseBtn = document.getElementById('viewer-close');
  const viewerPrevBtn = document.getElementById('viewer-prev');
  const viewerNextBtn = document.getElementById('viewer-next');

  // Estado
  let users = {};
  let sessionUser = null;
  let dataUser = null;
  let editingFolderId = null;
  let viewerCurrentPhoto = null;

  // Utilidades
  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function normUser(str) {
    return str.trim().toLowerCase();
  }

  // --- IndexedDB helpers ---

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FotosSegurasDB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveUserDB(user) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const req = store.put(user);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function loadUsersDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const req = store.getAll();
      req.onsuccess = () => {
        const usersArray = req.result;
        const usersObj = {};
        usersArray.forEach(u => usersObj[u.username] = u);
        resolve(usersObj);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Cambiar saveUsers para llamar async a saveUserDB para el usuario actual
  async function saveUsers() {
    if (!sessionUser || !dataUser) return;
    try {
      await saveUserDB(dataUser);
      // console.log('Guardado usuario en IndexedDB', sessionUser);
    } catch (e) {
      alert('Error: No se pudo guardar los datos. Puede que no haya espacio disponible.');
      console.error(e);
    }
  }

  // Reemplaza loadUsers() por llamado async a IndexedDB
  async function loadUsers() {
    try {
      return await loadUsersDB();
    } catch {
      return {};
    }
  }

  // Cambia saveCurrentUserData para guardar con IndexedDB asíncrono
  async function saveCurrentUserData() {
    if (!sessionUser || !dataUser) return;
    users[sessionUser] = dataUser;
    await saveUsers();
  }

  // Sesión guardada en localStorage/sessionStorage para saber quién está logueado
  function saveSession(username) {
    try {
      localStorage.setItem(LS_SESSION_KEY, username);
      sessionStorage.setItem(LS_SESSION_KEY, username);
    } catch (e) {
      alert('Error guardando sesión.');
      console.error(e);
    }
  }

  function loadSession() {
    const ses = localStorage.getItem(LS_SESSION_KEY) || sessionStorage.getItem(LS_SESSION_KEY);
    if (!ses) return null;
    if (ses in users) return ses;
    return null;
  }

  function clearSession() {
    localStorage.removeItem(LS_SESSION_KEY);
    sessionStorage.removeItem(LS_SESSION_KEY);
  }

  function isValidUsername(u) {
    return /^[a-z0-9_-]{3,20}$/i.test(u);
  }

  function isValidPassword(p) {
    return p.length >= 6;
  }

  function showError(element, msg) {
    element.textContent = msg;
  }

  function clearErrors() {
    showError(loginError, '');
    showError(registerError, '');
    showError(folderError, '');
  }

  // Login / Register UI
  function showLogin() {
    clearErrors();
    loginForm.reset();
    registerForm.reset();
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  }

  function showRegister() {
    clearErrors();
    loginForm.reset();
    registerForm.reset();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  }

  // Init async
  async function initAuth() {
    users = await loadUsers();

    sessionUser = loadSession();

    if (sessionUser && users[sessionUser]) {
      dataUser = users[sessionUser];
      goToApp();
      return;
    }

    showLogin();
    setupBackgroundText();
  }

  // Login submit
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    clearErrors();
    const u = normUser(loginUsernameInput.value);
    const p = loginPasswordInput.value;

    if (!isValidUsername(u)) {
      showError(loginError, 'Usuario inválido');
      return;
    }
    if (!isValidPassword(p)) {
      showError(loginError, 'Contraseña inválida');
      return;
    }
    if (!(u in users)) {
      showError(loginError, 'Usuario no registrado');
      return;
    }
    if (users[u].password !== p) {
      showError(loginError, 'Contraseña incorrecta');
      return;
    }

    sessionUser = u;
    dataUser = users[u];
    saveSession(u);
    goToApp();
  });

  // Register submit
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();

    const uRaw = registerUsernameInput.value;
    const p1 = registerPasswordInput.value;
    const p2 = registerPassword2Input.value;

    const u = normUser(uRaw);

    if (!isValidUsername(u)) {
      showError(registerError, 'Usuario inválido: 3-20 caracteres. Solo letras, números, guion y guion bajo.');
      return;
    }
    if (p1 !== p2) {
      showError(registerError, 'Las contraseñas no coinciden');
      return;
    }
    if (!isValidPassword(p1)) {
      showError(registerError, 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (u in users) {
      showError(registerError, 'Usuario ya registrado');
      return;
    }

    const newUser = {
      username: u,
      password: p1,
      folders: {},
    };

    users[u] = newUser;
    dataUser = newUser;
    sessionUser = u;

    await saveUsers(); // guardar nuevo usuario en DB

    saveSession(u);
    goToApp();
  });

  toRegisterBtn.addEventListener('click', showRegister);
  toLoginBtn.addEventListener('click', showLogin);

  // Go to app
  function goToApp() {
    authContainer.classList.add('hidden');
    app.classList.remove('hidden');
    renderFolders();
    updateDeleteBtnState();
    setupBackgroundText();
  }

  // Logout
  logoutBtn.addEventListener('click', () => {
    clearSession();
    sessionUser = null;
    dataUser = null;
    foldersContainer.innerHTML = '';
    app.classList.add('hidden');
    showLogin();
    setupBackgroundText();
  });

  // Render folders
  function renderFolders() {
    foldersContainer.innerHTML = '';

    const folderIds = Object.keys(dataUser.folders);
    if (folderIds.length === 0) {
      const noFolderElem = document.createElement('p');
      noFolderElem.className = 'empty-msg';
      noFolderElem.textContent = 'No tienes carpetas. Usa el botón "Nueva carpeta" para crear una.';
      foldersContainer.appendChild(noFolderElem);
      return;
    }

    for (const id of folderIds) {
      renderFolder(dataUser.folders[id]);
    }
  }

  function renderFolder(folder) {
    const folderDiv = document.createElement('section');
    folderDiv.className = 'folder';
    folderDiv.setAttribute('data-folderid', folder.id);
    folderDiv.setAttribute('aria-label', `Carpeta "${folder.name}" con ${folder.photos.length} fotos`);

    // Header
    const header = document.createElement('header');
    header.className = 'folder-header';
    const nameTitle = document.createElement('small');
    nameTitle.textContent = folder.name;
    nameTitle.title = folder.name;

    nameTitle.classList.add('editable-folder-name');
    nameTitle.tabIndex = 0;
    nameTitle.setAttribute('role', 'textbox');
    nameTitle.setAttribute('aria-label', 'Nombre de la carpeta (clic para editar)');

    nameTitle.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        renameFolderStart(folder.id);
      }
    });
    nameTitle.addEventListener('click', () => renameFolderStart(folder.id));

    header.appendChild(nameTitle);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'folder-delete';
    delBtn.setAttribute('title', `Eliminar carpeta "${folder.name}"`);
    delBtn.setAttribute('aria-label', `Eliminar carpeta ${folder.name}`);
    delBtn.innerHTML = '🗑️';
    delBtn.addEventListener('click', async () => {
      if (confirm(`¿Eliminar la carpeta "${folder.name}" y todas sus fotos? Esta acción es irreversible.`)) {
        await deleteFolder(folder.id);
      }
    });
    header.appendChild(delBtn);

    folderDiv.appendChild(header);

    // Photos
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'folder-body';
    if (folder.photos.length === 0) {
      const noPhotosMsg = document.createElement('p');
      noPhotosMsg.className = 'empty-msg';
      noPhotosMsg.textContent = 'No hay fotos aquí.';
      bodyDiv.appendChild(noPhotosMsg);
    } else {
      bodyDiv.style.display = 'grid';
      bodyDiv.style.gridTemplateColumns = 'repeat(auto-fill,minmax(105px,1fr))';
      bodyDiv.style.gap = '10px';
      folder.photos.forEach((photo, idx) => {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'image-thumb';
        thumbDiv.setAttribute('data-folderid', folder.id);
        thumbDiv.setAttribute('data-photoindex', idx);
        thumbDiv.tabIndex = 0;
        thumbDiv.setAttribute('role', 'listitem');
        thumbDiv.setAttribute('aria-label', `Foto ${idx + 1} en carpeta ${folder.name}`);

        const img = document.createElement('img');
        img.src = photo.dataURL;
        img.alt = photo.name || `Foto ${idx + 1}`;
        img.draggable = false;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'image-select';
        checkbox.title = 'Seleccionar para eliminar';
        checkbox.tabIndex = -1;
        checkbox.addEventListener('click', e => {
          e.stopPropagation();
          updateDeleteBtnState();
        });

        // Botón descargar
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'image-download-btn';
        downloadBtn.title = 'Descargar foto';
        downloadBtn.setAttribute('aria-label', 'Descargar foto');
        downloadBtn.textContent = '⬇';
        downloadBtn.tabIndex = -1;

        downloadBtn.addEventListener('click', e => {
          e.stopPropagation();

          // Crear enlace descarga
          const a = document.createElement('a');
          a.href = photo.dataURL;
          a.download = photo.name || `foto_${idx + 1}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });

        thumbDiv.addEventListener('click', e => {
          if (e.target === checkbox || e.target === downloadBtn) return;
          openImageViewer(folder.id, idx);
        });
        thumbDiv.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openImageViewer(folder.id, idx);
          }
        });

        thumbDiv.appendChild(img);
        thumbDiv.appendChild(checkbox);
        thumbDiv.appendChild(downloadBtn);
        bodyDiv.appendChild(thumbDiv);
      });
    }
    folderDiv.appendChild(bodyDiv);
    foldersContainer.appendChild(folderDiv);
  }

  // Crear carpeta
  createFolderBtn.addEventListener('click', () => {
    editingFolderId = null;
    folderNameInput.value = '';
    folderError.textContent = '';
    folderNameDialog.showModal();
    folderNameInput.focus();
  });

  folderNameForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = folderNameInput.value.trim();
    if (name.length < 1) {
      folderError.textContent = 'El nombre no puede estar vacío';
      return;
    }
    if (name.length > 30) {
      folderError.textContent = 'Nombre demasiado largo (máx 30 caracteres)';
      return;
    }
    const nameExists = Object.values(dataUser.folders).some(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== editingFolderId);
    if (nameExists) {
      folderError.textContent = 'Ya existe una carpeta con ese nombre';
      return;
    }

    if (editingFolderId) {
      dataUser.folders[editingFolderId].name = name;
    } else {
      const id = generateId();
      dataUser.folders[id] = { id, name, photos: [] };
    }
    await saveCurrentUserData();
    renderFolders();
    folderNameDialog.close();
  });

  cancelFolderNameBtn.addEventListener('click', () => {
    folderNameDialog.close();
  });

  function renameFolderStart(folderId) {
    const f = dataUser.folders[folderId];
    if (!f) return;
    editingFolderId = folderId;
    folderNameInput.value = f.name;
    folderError.textContent = '';
    folderNameDialog.showModal();
    folderNameInput.focus();
  }

  async function deleteFolder(folderId) {
    if (!dataUser.folders[folderId]) return;
    delete dataUser.folders[folderId];
    await saveCurrentUserData();
    renderFolders();
    updateDeleteBtnState();
  }

  // Subir fotos
  uploadInput.addEventListener('change', async e => {
    const files = [...e.target.files];
    if (files.length === 0) return;

    const folderIds = Object.keys(dataUser.folders);
    if (folderIds.length === 0) {
      alert('Primero crea una carpeta para subir fotos.');
      uploadInput.value = '';
      return;
    }

    const folderNamePrompt = prompt(
      `¿A qué carpeta quieres subir las ${files.length} foto(s)?\nEscribe el nombre EXACTO:\n\n${folderIds.map(id => dataUser.folders[id].name).join('\n')}`,
      dataUser.folders[folderIds[0]].name
    );
    if (!folderNamePrompt) {
      uploadInput.value = '';
      return;
    }

    const targetFolderId = folderIds.find(id => dataUser.folders[id].name.toLowerCase() === folderNamePrompt.trim().toLowerCase());
    if (!targetFolderId) {
      alert('No existe ninguna carpeta con ese nombre.');
      uploadInput.value = '';
      return;
    }

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const dataURL = await readFileAsDataURL(file);
        const photoObj = {
          id: generateId(),
          name: file.name,
          dataURL,
        };
        dataUser.folders[targetFolderId].photos.push(photoObj);
      }
      await saveCurrentUserData();
      renderFolders();
    } catch (err) {
      alert('Error al cargar una o más fotos.');
      console.error(err);
    }

    uploadInput.value = '';
  });

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = evt => resolve(evt.target.result);
      reader.onerror = () => {
        alert(`Error leyendo el archivo ${file.name}`);
        reject(new Error('Error lectura archivo'));
      };
      reader.readAsDataURL(file);
    });
  }

  // Botón eliminar fotos seleccionadas
  deleteSelectedBtn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar todas las fotos seleccionadas? Esta acción es irreversible.')) return;

    const selectedPhotos = {};
    const checkboxes = document.querySelectorAll('.image-select:checked');
    checkboxes.forEach(chk => {
      const thumb = chk.parentElement;
      const folderId = thumb.getAttribute('data-folderid');
      const photoIndex = Number(thumb.getAttribute('data-photoindex'));
      if (!selectedPhotos[folderId]) selectedPhotos[folderId] = [];
      selectedPhotos[folderId].push(photoIndex);
    });

    for (const folderId in selectedPhotos) {
      const indexes = selectedPhotos[folderId];
      indexes.sort((a, b) => b - a);
      for (const idx of indexes) {
        dataUser.folders[folderId].photos.splice(idx, 1);
      }
    }

    await saveCurrentUserData();
    renderFolders();
    updateDeleteBtnState();
  });

  function updateDeleteBtnState() {
    const anySelected = !!document.querySelector('.image-select:checked');
    deleteSelectedBtn.disabled = !anySelected;
  }

  // Visor imágen
  function openImageViewer(folderId, photoIdx) {
    viewerCurrentPhoto = { folderId, photoIdx };
    const photo = getPhotoByIdx(folderId, photoIdx);
    if (!photo) return;

    viewerImg.src = photo.dataURL;
    viewerImg.alt = photo.name || `Foto ${photoIdx + 1}`;

    imageViewer.showModal();
    viewerCloseBtn.focus();
  }

  function getPhotoByIdx(folderId, photoIdx) {
    const folder = dataUser.folders[folderId];
    if (!folder || photoIdx < 0 || photoIdx >= folder.photos.length) return null;
    return folder.photos[photoIdx];
  }

  viewerCloseBtn.addEventListener('click', () => {
    imageViewer.close();
    viewerImg.src = '';
    viewerCurrentPhoto = null;
  });

  viewerPrevBtn.addEventListener('click', () => {
    if (!viewerCurrentPhoto) return;
    let { folderId, photoIdx } = viewerCurrentPhoto;
    const folder = dataUser.folders[folderId];
    if (!folder) return;
    photoIdx--;
    if (photoIdx < 0) photoIdx = folder.photos.length - 1;
    openImageViewer(folderId, photoIdx);
  });

  viewerNextBtn.addEventListener('click', () => {
    if (!viewerCurrentPhoto) return;
    let { folderId, photoIdx } = viewerCurrentPhoto;
    const folder = dataUser.folders[folderId];
    if (!folder) return;
    photoIdx++;
    if (photoIdx >= folder.photos.length) photoIdx = 0;
    openImageViewer(folderId, photoIdx);
  });

  imageViewer.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      imageViewer.close();
      viewerImg.src = '';
      viewerCurrentPhoto = null;
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      viewerPrevBtn.click();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      viewerNextBtn.click();
      return;
    }
  });

  // Background anim
  function setupBackgroundText() {
    const bg = document.getElementById('background-text');
    const text = 'Carlos Restrepo ';
    const repeatsPerLine = 20;
    const linesCount = 30;
    bg.innerHTML = ''; // Limpiar contenido previo

    for (let i = 0; i < linesCount; i++) {
      const span = document.createElement('span');
      span.className = 'background-text-line';
      span.textContent = text.repeat(repeatsPerLine);
      bg.appendChild(span);
    }
  }

  initAuth();

})();
