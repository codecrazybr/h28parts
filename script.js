const storageKey = "h28Parts";

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
const editModal = document.querySelector("#editModal");
const editForm = document.querySelector("#editForm");
const cancelEditModalButton = document.querySelector("#cancelEditModal");
const photoModal = document.querySelector("#photoModal");
const expandedPhoto = document.querySelector("#expandedPhoto");
const closePhotoModalButton = document.querySelector("#closePhotoModal");
let partIdPendingDelete = null;
let partIdPendingEdit = null;
let partIdBeingEdited = null;

function getParts() {
  return JSON.parse(localStorage.getItem(storageKey)) || [];
}

function saveParts(parts) {
  localStorage.setItem(storageKey, JSON.stringify(parts));
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

  const image = document.createElement("img");
  image.src = part.photo;
  image.alt = `Foto da peça ${part.name}`;
  image.title = "Clique para ampliar";
  image.addEventListener("click", () => openPhotoModal(part));

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
  card.append(image, info);

  return card;
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

function openConfirmModal({ title, message, actionLabel, actionClass }) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmActionButton.textContent = actionLabel;
  confirmActionButton.className = actionClass;
  confirmModal.classList.add("active");
  confirmModal.setAttribute("aria-hidden", "false");
  cancelActionButton.focus();
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
    message: "Tem certeza que deseja excluir esta peça?",
    actionLabel: "Excluir",
    actionClass: "delete-button"
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
  confirmModal.classList.remove("active");
  confirmModal.setAttribute("aria-hidden", "true");
}

function confirmDeletePart() {
  if (!partIdPendingDelete) {
    return;
  }

  const updatedParts = getParts().filter((part) => part.id !== partIdPendingDelete);
  saveParts(updatedParts);
  closeConfirmModal();
  renderResults();
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

  if (!photoFile) {
    formMessage.textContent = "Selecione uma foto da peça.";
    return;
  }

  const part = {
    id: createPartId(),
    photo: await fileToBase64(photoFile),
    name: document.querySelector("#name").value.trim(),
    code: document.querySelector("#code").value.trim(),
    drawingNumber: document.querySelector("#drawingNumber").value.trim(),
    application: document.querySelector("#application").value.trim()
  };

  const parts = getParts();
  parts.push(part);
  saveParts(parts);
  partForm.reset();
  formMessage.textContent = "Peça cadastrada com sucesso.";

  renderResults();
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

  const updatedParts = parts.map((part) => part.id === currentPart.id ? updatedPart : part);
  saveParts(updatedParts);
  closeEditModal();
  renderResults();
});

renderResults();
