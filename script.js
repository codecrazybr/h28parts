const storageKey = "h28Parts";
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
let partIdPendingDelete = null;
let partIdPendingEdit = null;
let partIdBeingEdited = null;
let editPassword = "";
let successToastTimer = null;
let editToastTimer = null;
let deleteToastTimer = null;
let warningToastTimer = null;
let partsCache = [];
let confirmNeedsPassword = false;

document.querySelector("#photo").required = false;
document.querySelector("#editPhoto").required = false;

function getParts() {
  return partsCache;
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
    photo: part.photo,
    name: part.name,
    code: part.code,
    drawingNumber: part.drawing_number,
    application: part.application,
    assembly: part.assembly || "",
    registeredBy: part.registered_by || "",
    createdAt: part.created_at || "",
    updatedAt: part.updated_at || part.created_at || ""
  };
}

function mapSitePart(part) {
  return {
    id: part.id,
    photo: part.photo,
    name: part.name,
    code: part.code,
    drawing_number: part.drawingNumber,
    application: part.application,
    assembly: part.assembly,
    registered_by: part.registeredBy,
    updated_at: new Date().toISOString()
  };
}

async function loadParts() {
  if (!supabaseClient) {
    partsCache = getLocalParts();
    return;
  }

  const { data, error } = await supabaseClient
    .from("parts")
    .select("id, photo, name, code, drawing_number, application, assembly, registered_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    results.innerHTML = '<p class="empty-state">Não foi possível carregar os itens.</p>';
    return;
  }

  partsCache = data.map(mapDatabasePart);
}

async function addPart(part) {
  if (partsCache.some((item) => normalizeText(item.code) === normalizeText(part.code))) {
    throw new Error("O item já está cadastrado no sistema.");
  }

  if (!supabaseClient) {
    const parts = getLocalParts();
    parts.push(part);
    saveLocalParts(parts);
    partsCache = parts;
    return;
  }

  const { error } = await supabaseClient
    .from("parts")
    .insert(mapSitePart(part));

  if (error) {
    if (isDuplicatePartError(error)) {
      throw new Error("O item já está cadastrado no sistema.");
    }

    throw new Error(error.message || "Não foi possível cadastrar o item.");
  }

  partsCache = [part, ...partsCache];
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

  const { error } = await supabaseClient.rpc("update_part_with_password", {
    part_id_input: part.id,
    password_input: password,
    photo_input: part.photoChanged ? part.photo : null,
    name_input: part.name,
    code_input: part.code,
    drawing_number_input: part.drawingNumber,
    application_input: part.application,
    assembly_input: part.assembly,
    registered_by_input: part.registeredBy
  });

  if (error) {
    if (isDuplicatePartError(error)) {
      throw new Error("O item já está cadastrado no sistema.");
    }

    throw new Error(error.message || "Não foi possível atualizar o item.");
  }

  partsCache = partsCache.map((item) => item.id === part.id ? {
    ...part,
    updatedAt: new Date().toISOString()
  } : item);
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

  const { error } = await supabaseClient.rpc("delete_part_with_password", {
    part_id_input: partId,
    password_input: password
  });

  if (error) {
    throw new Error(error.message || "Não foi possível excluir o item.");
  }

  await loadParts();
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxWidth = 900;
        const maxHeight = 700;
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.74));
      };

      image.onerror = () => resolve(reader.result);
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Não foi possível carregar a foto."));
    reader.readAsDataURL(file);
  });
}

function normalizeText(value) {
  return value.toLowerCase().trim();
}

function normalizeInputValue(value) {
  return value.trim().toUpperCase();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function isDuplicatePartError(error) {
  const message = normalizeText(error.message || "");
  const code = error.code || "";

  return (
    code === "23505" ||
    message.includes("já está cadastrada") ||
    message.includes("ja esta cadastrada") ||
    message.includes("já está cadastrado") ||
    message.includes("ja esta cadastrado") ||
    message.includes("duplicate") ||
    message.includes("parts_code_unique")
  );
}

function partMatchesSearch(part, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  return [
    part.name,
    part.code,
    part.drawingNumber,
    part.application
  ].some((field) => normalizeText(field).includes(searchTerm));
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
  const registeredBy = createInfoLine("Cadastrado por:", part.registeredBy || "-");
  const createdAt = createInfoLine("Data de cadastro:", formatDateTime(part.createdAt));
  const updatedAt = createInfoLine("Última atualização:", formatDateTime(part.updatedAt));

  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Excluir item";
  deleteButton.setAttribute("aria-label", "Excluir item");
  deleteButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M6 6l1 15h10l1-15"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
  deleteButton.addEventListener("click", () => deletePart(part.id));

  const editButton = document.createElement("button");
  editButton.className = "icon-button edit-button";
  editButton.type = "button";
  editButton.title = "Editar item";
  editButton.setAttribute("aria-label", "Editar item");
  editButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
    </svg>
  `;
  editButton.addEventListener("click", () => requestEditPart(part.id));

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(editButton, deleteButton);

  info.append(title, code, drawingNumber, application, registeredBy, createdAt, updatedAt, actions);
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

  const image = document.createElement("img");
  image.src = part.photo;
  image.alt = `Foto do item ${part.name}`;
  image.title = "Clique para ampliar";
  image.addEventListener("click", () => openPhotoModal(part));

  return image;
}

function createInfoLine(label, value) {
  const line = document.createElement("p");
  const strong = document.createElement("strong");

  strong.textContent = label;
  line.append(strong, ` ${value}`);

  return line;
}

function createPartId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showSuccessToast() {
  clearTimeout(successToastTimer);
  successToast.classList.remove("active");
  successToast.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    successToast.classList.add("active");
  });

  successToastTimer = setTimeout(() => {
    successToast.classList.remove("active");
    successToast.setAttribute("aria-hidden", "true");
  }, 1900);
}

function showEditToast() {
  clearTimeout(editToastTimer);
  editToast.classList.remove("active");
  editToast.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    editToast.classList.add("active");
  });

  editToastTimer = setTimeout(() => {
    editToast.classList.remove("active");
    editToast.setAttribute("aria-hidden", "true");
  }, 1900);
}

function showDeleteToast() {
  clearTimeout(deleteToastTimer);
  deleteToast.classList.remove("active");
  deleteToast.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    deleteToast.classList.add("active");
  });

  deleteToastTimer = setTimeout(() => {
    deleteToast.classList.remove("active");
    deleteToast.setAttribute("aria-hidden", "true");
  }, 1900);
}

function showWarningToast(message) {
  const warningMessage = warningToast.querySelector("p");

  warningMessage.textContent = message;
  clearTimeout(warningToastTimer);
  warningToast.classList.remove("active");
  warningToast.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    warningToast.classList.add("active");
  });

  warningToastTimer = setTimeout(() => {
    warningToast.classList.remove("active");
    warningToast.setAttribute("aria-hidden", "true");
  }, 1900);
}

function fillEditModal(part) {
  partIdBeingEdited = part.id;
  document.querySelector("#editName").value = part.name;
  document.querySelector("#editCode").value = part.code;
  document.querySelector("#editDrawingNumber").value = part.drawingNumber;
  document.querySelector("#editApplication").value = part.application;
  document.querySelector("#editRegisteredBy").value = part.registeredBy || "";
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
  const part = getParts().find((item) => item.id === partId);

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
  const parts = getParts();
  const searchTerm = normalizeText(searchInput.value);
  const filteredParts = parts.filter((part) => partMatchesSearch(part, searchTerm));

  results.innerHTML = "";

  if (parts.length === 0) {
    results.innerHTML = '<p class="empty-state">Nenhum item cadastrado.</p>';
    return;
  }

  if (filteredParts.length === 0) {
    results.innerHTML = '<p class="empty-state">Nenhum item encontrado.</p>';
    return;
  }

  filteredParts.forEach((part) => {
    results.appendChild(createPartCard(part));
  });
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

  try {
    await removePart(partIdPendingDelete, password);
    closeConfirmModal();
    showDeleteToast();
    renderResults();
  } catch (error) {
    confirmMessage.textContent = error.message;
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

searchInput.addEventListener("input", renderResults);
cancelActionButton.addEventListener("click", closeConfirmModal);
confirmActionButton.addEventListener("click", confirmPendingAction);
cancelEditModalButton.addEventListener("click", closeEditModal);

deletePasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && confirmNeedsPassword) {
    event.preventDefault();
    confirmPendingAction();
  }
});

confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmModal();
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

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) {
    closeEditModal();
  }
});

closePhotoModalButton.addEventListener("click", closePhotoModal);

photoModal.addEventListener("click", (event) => {
  if (event.target === photoModal) {
    closePhotoModal();
  }
});

partForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = partForm.querySelector("button[type='submit']");
  const photoFile = document.querySelector("#photo").files[0];
  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";

  const part = {
    id: createPartId(),
    photo: photoFile ? await fileToBase64(photoFile) : "",
    name: normalizeInputValue(document.querySelector("#name").value),
    code: normalizeInputValue(document.querySelector("#code").value),
    drawingNumber: normalizeInputValue(document.querySelector("#drawingNumber").value),
    application: normalizeInputValue(document.querySelector("#application").value),
    assembly: "NAO INFORMADO",
    registeredBy: normalizeInputValue(document.querySelector("#registeredBy").value)
  };

  try {
    await addPart(part);
    partForm.reset();
    formMessage.textContent = "";
    showSuccessToast();
    renderResults();
  } catch (error) {
    if (isDuplicatePartError(error)) {
      showWarningToast("O item já está cadastrado no sistema.");
      return;
    }

    formMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar item";
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = editForm.querySelector("button[type='submit']");
  const parts = getParts();
  const currentPart = parts.find((part) => part.id === partIdBeingEdited);
  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";

  if (!currentPart) {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar edição";
    closeEditModal();
    renderResults();
    return;
  }

  const photoFile = document.querySelector("#editPhoto").files[0];
  const hasNewPhoto = Boolean(photoFile);
  const updatedPart = {
    id: currentPart.id,
    photo: hasNewPhoto ? await fileToBase64(photoFile) : currentPart.photo,
    photoChanged: hasNewPhoto,
    name: normalizeInputValue(document.querySelector("#editName").value),
    code: normalizeInputValue(document.querySelector("#editCode").value),
    drawingNumber: normalizeInputValue(document.querySelector("#editDrawingNumber").value),
    application: normalizeInputValue(document.querySelector("#editApplication").value),
    assembly: currentPart.assembly || "NAO INFORMADO",
    registeredBy: normalizeInputValue(document.querySelector("#editRegisteredBy").value),
    createdAt: currentPart.createdAt
  };

  try {
    await updatePart(updatedPart, editPassword);
    closeEditModal();
    showEditToast();
    renderResults();
  } catch (error) {
    if (isDuplicatePartError(error)) {
      showWarningToast("O item já está cadastrado no sistema.");
      return;
    }

    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar edição";
  }
});

loadParts().then(renderResults);
