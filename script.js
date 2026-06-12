const storageKey = "h28Parts";
const photoBucket = "parts";
const supabaseConfig = window.H28_SUPABASE_CONFIG || {};
const supabaseUrl = supabaseConfig.url || "";
const supabaseAnonKey = supabaseConfig.anonKey || "";
const isSupabaseConfigured = (
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("COLE_AQUI") &&
  !supabaseAnonKey.includes("COLE_AQUI") &&
  window.supabase
);
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const tabButtons = document.querySelectorAll(".tab-button");
const screens = document.querySelectorAll(".screen");
const partForm = document.querySelector("#partForm");
const formMessage = document.querySelector("#formMessage");
const searchInput = document.querySelector("#searchInput");
const results = document.querySelector("#results");
const itemsCounter = document.querySelector("#itemsCounter");
const connectionStatus = document.querySelector("#connectionStatus");
const refreshStatusButton = document.querySelector("#refreshStatusButton");
const confirmModal = document.querySelector("#confirmModal");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmMessage = document.querySelector("#confirmMessage");
const cancelActionButton = document.querySelector("#cancelAction");
const confirmActionButton = document.querySelector("#confirmAction");
const deletePasswordLabel = document.querySelector("#deletePasswordLabel");
const deletePasswordInput = document.querySelector("#deletePassword");
const editModal = document.querySelector("#editModal");
const editForm = document.querySelector("#editForm");
const cancelEditModalButton = document.querySelector("#cancelEditModal");
const photoModal = document.querySelector("#photoModal");
const expandedPhoto = document.querySelector("#expandedPhoto");
const closePhotoModalButton = document.querySelector("#closePhotoModal");
const successToast = document.querySelector("#successToast");
const editToast = document.querySelector("#editToast");
const deleteToast = document.querySelector("#deleteToast");
const warningToast = document.querySelector("#warningToast");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");

let partIdPendingDelete = null;
let partIdPendingEdit = null;
let partIdBeingEdited = null;
let editPassword = "";
let partsCache = [];
let confirmNeedsPassword = false;
let searchTimer = null;
let lastSearchToken = 0;
let loadingCount = 0;

document.querySelector("#photo").required = false;
document.querySelector("#editPhoto").required = false;

document.addEventListener("gesturestart", (event) => {
  event.preventDefault();
});

function withTimeout(promise, message = "A conexão demorou demais. Tente novamente.") {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), 15000);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function showLoading(message = "Carregando...") {
  loadingCount += 1;

  if (loadingText) {
    loadingText.textContent = message;
  }

  loadingOverlay?.classList.add("active");
  loadingOverlay?.setAttribute("aria-hidden", "false");
}

function hideLoading() {
  loadingCount = Math.max(loadingCount - 1, 0);

  if (loadingCount > 0) {
    return;
  }

  loadingOverlay?.classList.remove("active");
  loadingOverlay?.setAttribute("aria-hidden", "true");
}

function getLocalParts() {
  return JSON.parse(localStorage.getItem(storageKey)) || [];
}

function saveLocalParts(parts) {
  localStorage.setItem(storageKey, JSON.stringify(parts));
}

function mapDatabasePart(part) {
  return {
    id: part.id,
    photo: part.photo || "",
    photoLoaded: Boolean(part.photo),
    name: part.name,
    code: part.code,
    drawingNumber: part.drawing_number,
    application: part.application,
    registeredBy: part.registered_by || "NAO INFORMADO",
    createdAt: part.created_at || "",
    updatedAt: part.updated_at || part.created_at || ""
  };
}

function mapSitePart(part) {
  return {
    id: part.id,
    photo: part.photo || "",
    name: part.name,
    code: part.code,
    drawing_number: part.drawingNumber,
    application: part.application,
    registered_by: part.registeredBy || "NAO INFORMADO",
    updated_at: new Date().toISOString()
  };
}

async function loadParts(searchValue = "") {
  const normalizedSearch = normalizeText(searchValue);

  if (!normalizedSearch) {
    partsCache = [];
    return;
  }

  if (!supabaseClient) {
    partsCache = getLocalParts()
      .filter((part) => partMatchesSearch(part, normalizedSearch))
      .slice(0, 50);
    return;
  }

  const safeSearchTerm = normalizeInputValue(searchValue).replace(/[%,()]/g, " ").trim();
  let query = supabaseClient
    .from("parts")
    .select("id, name, code, drawing_number, application, photo")
    .order("created_at", { ascending: false })
    .limit(50);

  if (safeSearchTerm) {
    query = query.or([
      `name.ilike.%${safeSearchTerm}%`,
      `code.ilike.%${safeSearchTerm}%`,
      `drawing_number.ilike.%${safeSearchTerm}%`,
      `application.ilike.%${safeSearchTerm}%`
    ].join(","));
  }

  const { data, error } = await withTimeout(
    query,
    "Não foi possível carregar os itens. Verifique sua internet."
  );

  if (error) {
    throw new Error(error.message || "Não foi possível carregar os itens.");
  }

  partsCache = data.map(mapDatabasePart);
}

async function loadItemsCount() {
  if (!itemsCounter) {
    return false;
  }

  if (!supabaseClient) {
    const total = getLocalParts().length;
    itemsCounter.textContent = `Itens: ${total}`;
    return true;
  }

  try {
    const { count, error } = await withTimeout(
      supabaseClient
        .from("parts")
        .select("id", { count: "exact", head: true }),
      "Não foi possível carregar a quantidade de itens."
    );

    if (error) {
      throw error;
    }

    itemsCounter.textContent = `Itens: ${count || 0}`;
    return true;
  } catch (error) {
    itemsCounter.textContent = "Itens: indisponível";
    return false;
  }
}

function setConnectionStatus(status) {
  if (!connectionStatus) {
    return;
  }

  connectionStatus.classList.remove("is-online", "is-offline", "is-checking");

  if (status === "online") {
    connectionStatus.classList.add("is-online");
    connectionStatus.innerHTML = '<span class="status-dot"></span>Conexão: online';
    return;
  }

  if (status === "offline") {
    connectionStatus.classList.add("is-offline");
    connectionStatus.innerHTML = '<span class="status-dot"></span>Conexão: offline';
    return;
  }

  connectionStatus.classList.add("is-checking");
  connectionStatus.innerHTML = '<span class="status-dot"></span>Conexão: verificando';
}

async function refreshFooterStatus({ showLoader = true } = {}) {
  const startedAt = Date.now();

  setConnectionStatus("checking");

  if (showLoader) {
    showLoading("Atualizando...");
  }

  if (refreshStatusButton) {
    refreshStatusButton.disabled = true;
    refreshStatusButton.textContent = "Atualizando...";
  }

  const isOnline = await loadItemsCount();
  setConnectionStatus(isOnline ? "online" : "offline");

  if (showLoader) {
    await wait(Math.max(0, 3000 - (Date.now() - startedAt)));
    hideLoading();
  }

  if (refreshStatusButton) {
    refreshStatusButton.disabled = false;
    refreshStatusButton.textContent = "Atualizar";
  }
}

function isStorageUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function isBase64Photo(value) {
  return /^data:image\//i.test(value || "");
}

async function loadPartPhoto(partId) {
  const part = partsCache.find((item) => item.id === partId);

  if (part?.photo) {
    return part.photo;
  }

  if (!supabaseClient) {
    const localPart = getLocalParts().find((item) => item.id === partId);
    return localPart?.photo || "";
  }

  const { data, error } = await withTimeout(
    supabaseClient
      .from("parts")
      .select("photo")
      .eq("id", partId)
      .single(),
    "Não foi possível carregar a foto. Tente novamente."
  );

  if (error) {
    throw new Error(error.message || "Não foi possível carregar a foto.");
  }

  return data?.photo || "";
}

async function addPart(part) {
  if (partsCache.some((item) => normalizeText(item.code) === normalizeText(part.code))) {
    throw new Error("O item já está cadastrado no sistema.");
  }

  if (!supabaseClient) {
    const parts = getLocalParts();
    parts.push(part);
    saveLocalParts(parts);
    partsCache = [part, ...partsCache];
    return;
  }

  const { error } = await withTimeout(
    supabaseClient.from("parts").insert(mapSitePart(part)),
    "Cadastro demorou demais. Verifique sua internet e tente novamente."
  );

  if (error) {
    if (isDuplicatePartError(error)) {
      throw new Error("O item já está cadastrado no sistema.");
    }

    throw new Error(error.message || "Não foi possível cadastrar o item.");
  }
}

async function updatePart(part, password) {
  if (partsCache.some((item) => item.id !== part.id && normalizeText(item.code) === normalizeText(part.code))) {
    throw new Error("O item já está cadastrado no sistema.");
  }

  if (!supabaseClient) {
    if (password !== "1236") {
      throw new Error("Senha incorreta.");
    }

    const parts = getLocalParts().map((item) => item.id === part.id ? part : item);
    saveLocalParts(parts);
    partsCache = parts;
    return;
  }

  const rpcPayload = {
    part_id_input: part.id,
    password_input: password,
    photo_input: part.photoChanged ? part.photo : null,
    name_input: part.name,
    code_input: part.code,
    drawing_number_input: part.drawingNumber,
    application_input: part.application,
    registered_by_input: part.registeredBy || "NAO INFORMADO"
  };

  let { error } = await withTimeout(
    supabaseClient.rpc("update_part_with_password", rpcPayload),
    "Edição demorou demais. Verifique sua internet e tente novamente."
  );

  if (isMissingFunctionError(error)) {
    const legacyResult = await withTimeout(
      supabaseClient.rpc("update_part_with_password", {
        ...rpcPayload,
        assembly_input: "NAO INFORMADO"
      }),
      "Edição demorou demais. Verifique sua internet e tente novamente."
    );

    error = legacyResult.error;
  }

  if (error) {
    if (isDuplicatePartError(error)) {
      throw new Error("O item já está cadastrado no sistema.");
    }

    throw new Error(error.message || "Não foi possível atualizar o item.");
  }
}

async function removePart(partId, password) {
  if (!supabaseClient) {
    if (password !== "1236") {
      throw new Error("Senha incorreta.");
    }

    const parts = getLocalParts().filter((part) => part.id !== partId);
    saveLocalParts(parts);
    partsCache = parts;
    return;
  }

  const { error } = await withTimeout(
    supabaseClient.rpc("delete_part_with_password", {
      part_id_input: partId,
      password_input: password
    }),
    "Exclusão demorou demais. Verifique sua internet e tente novamente."
  );

  if (error) {
    throw new Error(error.message || "Não foi possível excluir o item.");
  }
}

function showScreen(screenId) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screenId);
  });

  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  if (screenId === "searchScreen") {
    renderResults();
  }
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Selecione uma imagem válida."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxWidth = 480;
        const maxHeight = 360;
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Não foi possível comprimir a foto."));
            return;
          }

          resolve(blob);
        }, "image/jpeg", 0.5);
      };

      image.onerror = () => reject(new Error("Não foi possível comprimir a foto. Tente escolher outra imagem."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Não foi possível carregar a foto."));
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível carregar a foto."));
    reader.readAsDataURL(blob);
  });
}

async function preparePhoto(file, partId) {
  if (!file) {
    return "";
  }

  const compressedBlob = await compressImageFile(file);

  if (!supabaseClient) {
    return blobToBase64(compressedBlob);
  }

  const path = `${partId}/${Date.now()}.jpg`;
  const { error } = await withTimeout(
    supabaseClient.storage
      .from(photoBucket)
      .upload(path, compressedBlob, {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: true
      }),
    "Não foi possível enviar a foto. Verifique sua internet e tente novamente."
  );

  if (error) {
    throw new Error(error.message || "Não foi possível enviar a foto.");
  }

  const { data } = supabaseClient.storage.from(photoBucket).getPublicUrl(path);
  return data.publicUrl;
}

function createPartId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeInputValue(value) {
  return value.trim().toUpperCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function partMatchesSearch(part, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  return [part.name, part.code, part.drawingNumber, part.application]
    .some((value) => normalizeText(value).includes(searchTerm));
}

function isDuplicatePartError(error) {
  const message = normalizeText(error.message || "");
  const code = error.code || "";

  return (
    code === "23505" ||
    message.includes("DUPLICATE") ||
    message.includes("PARTS_CODE_UNIQUE") ||
    message.includes("JA ESTA CADASTRADO")
  );
}

function isMissingFunctionError(error) {
  if (!error) {
    return false;
  }

  const message = normalizeText(error.message || "");
  return error.code === "PGRST202" || message.includes("COULD NOT FIND THE FUNCTION") || message.includes("SCHEMA CACHE");
}

function createPartCard(part) {
  const card = document.createElement("article");
  card.className = "part-card";

  const media = createPartMedia(part);
  const info = document.createElement("div");
  info.className = "part-info";

  const title = document.createElement("h3");
  title.textContent = part.name;

  const code = createInfoLine("Código do item:", part.code);
  const drawingNumber = createInfoLine("Número do desenho:", part.drawingNumber);
  const application = createInfoLine("Aplicação:", part.application);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editButton = document.createElement("button");
  editButton.className = "icon-button primary-button";
  editButton.type = "button";
  editButton.title = "Editar item";
  editButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';
  editButton.addEventListener("click", () => requestEditPart(part.id));

  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Excluir item";
  deleteButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
  deleteButton.addEventListener("click", () => deletePart(part.id));

  actions.append(editButton, deleteButton);
  info.append(title, code, drawingNumber, application, actions);
  card.append(media, info);

  return card;
}

function createPartMedia(part) {
  if (!part.photo) {
    const placeholder = document.createElement("div");
    placeholder.className = "part-photo-placeholder";
    placeholder.textContent = "Sem foto";
    return placeholder;
  }

  if (isStorageUrl(part.photo) || isBase64Photo(part.photo)) {
    const button = document.createElement("button");
    button.className = "part-photo-load-button";
    button.type = "button";
    button.title = "Ver foto";
    button.setAttribute("aria-label", "Ver foto");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    button.addEventListener("click", () => openPhotoModal(part));
    return button;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "part-photo-placeholder";
  placeholder.textContent = "Sem foto";
  return placeholder;
}

function createInfoLine(label, value) {
  const line = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = label;
  line.append(strong, ` ${value || "-"}`);
  return line;
}

function showToast(toast, timerName, message = "") {
  if (!toast) {
    return;
  }

  if (message) {
    const text = toast.querySelector("p");
    if (text) {
      text.textContent = message;
    }
  }

  clearTimeout(window[timerName]);
  toast.classList.remove("active");
  toast.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => toast.classList.add("active"));

  window[timerName] = setTimeout(() => {
    toast.classList.remove("active");
    toast.setAttribute("aria-hidden", "true");
  }, 1900);
}

function showSuccessToast() {
  showToast(successToast, "successToastTimer");
}

function showEditToast() {
  showToast(editToast, "editToastTimer");
}

function showDeleteToast() {
  showToast(deleteToast, "deleteToastTimer");
}

function showWarningToast(message) {
  showToast(warningToast, "warningToastTimer", message);
}

function fillEditModal(part) {
  partIdBeingEdited = part.id;
  document.querySelector("#editName").value = part.name;
  document.querySelector("#editCode").value = part.code;
  document.querySelector("#editDrawingNumber").value = part.drawingNumber;
  document.querySelector("#editApplication").value = part.application;
  document.querySelector("#editPhoto").value = "";
}

function closeEditModal() {
  partIdBeingEdited = null;
  editPassword = "";
  editForm.reset();
  editModal.classList.remove("active");
  editModal.setAttribute("aria-hidden", "true");
}

function openEditPart(partId) {
  const part = partsCache.find((item) => item.id === partId);

  if (!part) {
    return;
  }

  fillEditModal(part);
  editModal.classList.add("active");
  editModal.setAttribute("aria-hidden", "false");
  document.querySelector("#editName").focus();
}

function openPhotoModal(part) {
  expandedPhoto.src = part.photo;
  expandedPhoto.alt = `Foto ampliada do item ${part.name}`;
  photoModal.classList.add("active");
  photoModal.setAttribute("aria-hidden", "false");
  closePhotoModalButton.focus();
}

function closePhotoModal() {
  photoModal.classList.remove("active");
  photoModal.setAttribute("aria-hidden", "true");
  expandedPhoto.src = "";
  expandedPhoto.alt = "";
}

function openConfirmModal({ title, message, actionLabel, actionClass, needsPassword = false }) {
  confirmNeedsPassword = needsPassword;
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmActionButton.textContent = actionLabel;
  confirmActionButton.className = actionClass;
  deletePasswordInput.value = "";
  deletePasswordLabel.classList.toggle("hidden", !needsPassword);
  confirmModal.classList.add("active");
  confirmModal.setAttribute("aria-hidden", "false");

  if (needsPassword) {
    deletePasswordInput.focus();
  } else {
    cancelActionButton.focus();
  }
}

function renderResults() {
  results.innerHTML = "";

  if (partsCache.length === 0) {
    results.innerHTML = searchInput.value.trim()
      ? '<p class="empty-state">Nenhum item encontrado.</p>'
      : '<p class="empty-state">Digite uma pesquisa para consultar os itens.</p>';
    return;
  }

  partsCache.forEach((part) => {
    results.appendChild(createPartCard(part));
  });
}

async function refreshResults({ loading = false } = {}) {
  const token = ++lastSearchToken;

  if (loading) {
    showLoading("Pesquisando...");
  }

  try {
    await loadParts(searchInput.value);

    if (token === lastSearchToken) {
      renderResults();
    }
  } catch (error) {
    if (token === lastSearchToken) {
      results.innerHTML = `<p class="empty-state">${error.message}</p>`;
    }
  } finally {
    if (loading) {
      hideLoading();
    }
  }
}

function scheduleRefreshResults() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => refreshResults({ loading: true }), 350);
}

function deletePart(partId) {
  partIdPendingDelete = partId;
  openConfirmModal({
    title: "Confirmar exclusão",
    message: "Digite a senha para excluir este item.",
    actionLabel: "Excluir",
    actionClass: "delete-button",
    needsPassword: true
  });
}

function requestEditPart(partId) {
  partIdPendingEdit = partId;
  openConfirmModal({
    title: "Confirmar edição",
    message: "Digite a senha para editar este item.",
    actionLabel: "Editar",
    actionClass: "primary-button",
    needsPassword: true
  });
}

function closeConfirmModal() {
  partIdPendingDelete = null;
  partIdPendingEdit = null;
  confirmNeedsPassword = false;
  deletePasswordInput.value = "";
  deletePasswordLabel.classList.add("hidden");
  confirmModal.classList.remove("active");
  confirmModal.setAttribute("aria-hidden", "true");
}

async function confirmDeletePart() {
  if (!partIdPendingDelete) {
    return;
  }

  const password = deletePasswordInput.value.trim();

  if (!password) {
    confirmMessage.textContent = "Digite a senha para excluir este item.";
    deletePasswordInput.focus();
    return;
  }

  showLoading("Excluindo...");

  try {
    await removePart(partIdPendingDelete, password);
    closeConfirmModal();
    showDeleteToast();
    refreshFooterStatus({ showLoader: false });
    refreshResults();
  } catch (error) {
    confirmMessage.textContent = error.message;
  } finally {
    hideLoading();
  }
}

function confirmEditPart() {
  if (!partIdPendingEdit) {
    return;
  }

  const password = deletePasswordInput.value.trim();

  if (!password) {
    confirmMessage.textContent = "Digite a senha para editar este item.";
    deletePasswordInput.focus();
    return;
  }

  if (password !== "1236") {
    confirmMessage.textContent = "Senha incorreta.";
    deletePasswordInput.focus();
    return;
  }

  const partId = partIdPendingEdit;
  editPassword = password;
  closeConfirmModal();
  openEditPart(partId);
}

function confirmPendingAction() {
  if (partIdPendingDelete) {
    confirmDeletePart();
    return;
  }

  if (partIdPendingEdit) {
    confirmEditPart();
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

searchInput.addEventListener("input", scheduleRefreshResults);
cancelActionButton.addEventListener("click", closeConfirmModal);
confirmActionButton.addEventListener("click", confirmPendingAction);
cancelEditModalButton.addEventListener("click", closeEditModal);
closePhotoModalButton.addEventListener("click", closePhotoModal);
refreshStatusButton?.addEventListener("click", refreshFooterStatus);
confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmModal();
  }
});

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) {
    closeEditModal();
  }
});

photoModal.addEventListener("click", (event) => {
  if (event.target === photoModal) {
    closePhotoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && confirmModal.classList.contains("active")) {
    closeConfirmModal();
  }

  if (event.key === "Escape" && editModal.classList.contains("active")) {
    closeEditModal();
  }

  if (event.key === "Escape" && photoModal.classList.contains("active")) {
    closePhotoModal();
  }
});

deletePasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && confirmNeedsPassword) {
    event.preventDefault();
    confirmPendingAction();
  }
});

partForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = partForm.querySelector("button[type='submit']");
  const photoFile = document.querySelector("#photo").files[0];
  const partId = createPartId();

  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";
  formMessage.textContent = "";
  showLoading("Salvando...");

  try {
    const photoUrl = await preparePhoto(photoFile, partId);
    const part = {
      id: partId,
      photo: photoUrl,
      photoLoaded: Boolean(photoUrl),
      name: normalizeInputValue(document.querySelector("#name").value),
      code: normalizeInputValue(document.querySelector("#code").value),
      drawingNumber: normalizeInputValue(document.querySelector("#drawingNumber").value),
      application: normalizeInputValue(document.querySelector("#application").value),
      registeredBy: "NAO INFORMADO",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await addPart(part);
    partForm.reset();
    showSuccessToast();
    refreshFooterStatus({ showLoader: false });
    refreshResults();
  } catch (error) {
    if (isDuplicatePartError(error)) {
      showWarningToast("O item já está cadastrado no sistema.");
      return;
    }

    formMessage.textContent = error.message;
  } finally {
    hideLoading();
    submitButton.disabled = false;
    submitButton.textContent = "Salvar item";
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = editForm.querySelector("button[type='submit']");
  const currentPart = partsCache.find((part) => part.id === partIdBeingEdited);

  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";
  showLoading("Salvando...");

  if (!currentPart) {
    hideLoading();
    submitButton.disabled = false;
    submitButton.textContent = "Salvar edição";
    closeEditModal();
    renderResults();
    return;
  }

  try {
    const photoFile = document.querySelector("#editPhoto").files[0];
    const hasNewPhoto = Boolean(photoFile);
    const photoUrl = hasNewPhoto ? await preparePhoto(photoFile, currentPart.id) : currentPart.photo;
    const updatedPart = {
      id: currentPart.id,
      photo: photoUrl,
      photoChanged: hasNewPhoto,
      photoLoaded: currentPart.photoLoaded || hasNewPhoto,
      name: normalizeInputValue(document.querySelector("#editName").value),
      code: normalizeInputValue(document.querySelector("#editCode").value),
      drawingNumber: normalizeInputValue(document.querySelector("#editDrawingNumber").value),
      application: normalizeInputValue(document.querySelector("#editApplication").value),
      registeredBy: currentPart.registeredBy || "NAO INFORMADO",
      createdAt: currentPart.createdAt
    };

    await updatePart(updatedPart, editPassword);
    closeEditModal();
    showEditToast();
    refreshResults();
  } catch (error) {
    if (isDuplicatePartError(error)) {
      showWarningToast("O item já está cadastrado no sistema.");
      return;
    }

    showWarningToast(error.message);
  } finally {
    hideLoading();
    submitButton.disabled = false;
    submitButton.textContent = "Salvar edição";
  }
});

renderResults();
refreshFooterStatus({ showLoader: false });
