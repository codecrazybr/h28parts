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
const deleteToast = document.querySelector("#deleteToast");
let partIdPendingDelete = null;
let partIdPendingEdit = null;
let partIdBeingEdited = null;
let successToastTimer = null;
let deleteToastTimer = null;
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
    application: part.application
  };
}

function mapSitePart(part) {
  return {
    id: part.id,
    photo: part.photo,
    name: part.name,
    code: part.code,
    drawing_number: part.drawingNumber,
    application: part.application
  };
}

async function loadParts() {
  if (!supabaseClient) {
    partsCache = getLocalParts();
    return;
  }

  const { data, error } = await supabaseClient
    .from("parts")
    .select("id, photo, name, code, drawing_number, application, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    results.innerHTML = '<p class="empty-state">Não foi possível carregar as peças.</p>';
    return;
  }

  partsCache = data.map(mapDatabasePart);
}

async function addPart(part) {
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
    throw new Error("Não foi possível cadastrar a peça.");
  }

  await loadParts();
}

async function updatePart(part) {
  if (!supabaseClient) {
    const parts = getLocalParts().map((item) => item.id === part.id ? part : item);
    saveLocalParts(parts);
    partsCache = parts;
    return;
  }

  const { error } = await supabaseClient
    .from("parts")
    .update(mapSitePart(part))
    .eq("id", part.id);

  if (error) {
    throw new Error("Não foi possível atualizar a peça.");
  }

  await loadParts();
}

async function removePart(partId, password) {
  if (!supabaseClient) {
    if (password !== "h28@nadir") {
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
    throw new Error(error.message || "Não foi possível excluir a peça.");
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

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível carregar a foto."));
    reader.readAsDataURL(file);
  });
}

function normalizeText(value) {
  return value.toLowerCase().trim();
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

  const code = createInfoLine("Código da peça:", part.code);
  const drawingNumber = createInfoLine("Número do desenho:", part.drawingNumber);
  const application = createInfoLine("Aplicação:", part.application);

  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Excluir peça";
  deleteButton.setAttribute("aria-label", "Excluir peça");
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
  editButton.title = "Editar peça";
  editButton.setAttribute("aria-label", "Editar peça");
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

  const image = document.createElement("img");
  image.src = part.photo;
  image.alt = `Foto da peça ${part.name}`;
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
  expandedPhoto.alt = `Foto ampliada da peça ${part.name}`;
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
    results.innerHTML = '<p class="empty-state">Nenhuma peça cadastrada.</p>';
    return;
  }

  if (filteredParts.length === 0) {
    results.innerHTML = '<p class="empty-state">Nenhuma peça encontrada.</p>';
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
    message: "Digite a senha para excluir esta peça.",
    actionLabel: "Excluir",
    actionClass: "delete-button",
    needsPassword: true
  });
}

function requestEditPart(partId) {
  partIdPendingEdit = partId;
  openConfirmModal({
    title: "Confirmar edição",
    message: "Deseja editar esta peça?",
    actionLabel: "Editar",
    actionClass: "primary-button"
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
    confirmMessage.textContent = "Digite a senha para excluir esta peça.";
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

  const partId = partIdPendingEdit;
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

  const photoFile = document.querySelector("#photo").files[0];

  const part = {
    id: createPartId(),
    photo: photoFile ? await fileToBase64(photoFile) : "",
    name: document.querySelector("#name").value.trim(),
    code: document.querySelector("#code").value.trim(),
    drawingNumber: document.querySelector("#drawingNumber").value.trim(),
    application: document.querySelector("#application").value.trim()
  };

  try {
    await addPart(part);
    partForm.reset();
    formMessage.textContent = "";
    showSuccessToast();
    renderResults();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const parts = getParts();
  const currentPart = parts.find((part) => part.id === partIdBeingEdited);

  if (!currentPart) {
    closeEditModal();
    renderResults();
    return;
  }

  const photoFile = document.querySelector("#editPhoto").files[0];
  const updatedPart = {
    id: currentPart.id,
    photo: photoFile ? await fileToBase64(photoFile) : currentPart.photo,
    name: document.querySelector("#editName").value.trim(),
    code: document.querySelector("#editCode").value.trim(),
    drawingNumber: document.querySelector("#editDrawingNumber").value.trim(),
    application: document.querySelector("#editApplication").value.trim()
  };

  try {
    await updatePart(updatedPart);
    closeEditModal();
    renderResults();
  } catch (error) {
    alert(error.message);
  }
});

loadParts().then(renderResults);

if (supabaseClient) {
  setInterval(async () => {
    await loadParts();
    renderResults();
  }, 10000);
}
