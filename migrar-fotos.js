const photoBucket = "parts";
const supabaseConfig = window.H28_SUPABASE_CONFIG || {};
const supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);

const passwordInput = document.querySelector("#migrationPassword");
const checkButton = document.querySelector("#checkButton");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const statsText = document.querySelector("#statsText");
const progressBar = document.querySelector("#progressBar");
const logBox = document.querySelector("#logBox");

let shouldStop = false;
let initialTotal = 0;
let migratedTotal = 0;

function log(message) {
  const time = new Date().toLocaleTimeString("pt-BR");
  logBox.textContent += `[${time}] ${message}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function setProgress() {
  const percent = initialTotal > 0 ? Math.min(100, Math.round((migratedTotal / initialTotal) * 100)) : 0;
  progressBar.style.width = `${percent}%`;
}

function getPassword() {
  return passwordInput.value.trim();
}

function sanitizeFileName(value) {
  return String(value || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "item";
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");

  if (!header || !data || !header.startsWith("data:image/")) {
    throw new Error("Formato de foto inválido.");
  }

  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function getExtensionFromDataUrl(dataUrl) {
  const mime = dataUrl.match(/^data:(.*?);base64/)?.[1] || "image/jpeg";

  if (mime.includes("png")) {
    return "png";
  }

  if (mime.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

async function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), 20000);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function getStats() {
  const password = getPassword();

  if (!password) {
    throw new Error("Digite a senha.");
  }

  const { data, error } = await withTimeout(
    supabaseClient.rpc("get_base64_photo_stats", { password_input: password }),
    "Não foi possível verificar as fotos."
  );

  if (error) {
    throw new Error(error.message || "Não foi possível verificar as fotos.");
  }

  return data?.[0] || { total_items: 0, total_mb: 0 };
}

async function getNextBase64Part() {
  const { data, error } = await withTimeout(
    supabaseClient
      .from("parts")
      .select("id, name, code, photo")
      .like("photo", "data:image/%")
      .limit(1),
    "Não foi possível carregar a próxima foto."
  );

  if (error) {
    throw new Error(error.message || "Não foi possível carregar a próxima foto.");
  }

  return data?.[0] || null;
}

async function migrateOnePart(part) {
  const blob = dataUrlToBlob(part.photo);
  const extension = getExtensionFromDataUrl(part.photo);
  const safeName = sanitizeFileName(`${part.code}-${part.name}`);
  const path = `migradas/${part.id}/${safeName}-${Date.now()}.${extension}`;

  const { error: uploadError } = await withTimeout(
    supabaseClient.storage
      .from(photoBucket)
      .upload(path, blob, {
        cacheControl: "31536000",
        contentType: blob.type,
        upsert: true
      }),
    "Não foi possível enviar a foto para o Storage."
  );

  if (uploadError) {
    throw new Error(uploadError.message || "Não foi possível enviar a foto para o Storage.");
  }

  const { data: publicUrlData } = supabaseClient.storage.from(photoBucket).getPublicUrl(path);
  const photoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await withTimeout(
    supabaseClient.rpc("migrate_part_photo_to_link", {
      part_id_input: part.id,
      password_input: getPassword(),
      photo_url_input: photoUrl
    }),
    "Não foi possível salvar o link no item."
  );

  if (updateError) {
    throw new Error(updateError.message || "Não foi possível salvar o link no item.");
  }

  return photoUrl;
}

async function checkPhotos() {
  try {
    checkButton.disabled = true;
    const stats = await getStats();
    initialTotal = Number(stats.total_items || 0);
    migratedTotal = 0;
    setProgress();
    statsText.textContent = `${initialTotal} fotos Base64 encontradas. Tamanho aproximado: ${stats.total_mb || 0} MB.`;
    log(`Verificação concluída: ${initialTotal} fotos Base64, aproximadamente ${stats.total_mb || 0} MB.`);
  } catch (error) {
    statsText.textContent = error.message;
    log(`Erro: ${error.message}`);
  } finally {
    checkButton.disabled = false;
  }
}

async function startMigration() {
  try {
    shouldStop = false;
    startButton.disabled = true;
    checkButton.disabled = true;
    stopButton.disabled = false;

    const stats = await getStats();
    initialTotal = Number(stats.total_items || 0);
    migratedTotal = 0;
    setProgress();

    if (initialTotal === 0) {
      statsText.textContent = "Nenhuma foto Base64 encontrada.";
      log("Nenhuma foto para migrar.");
      return;
    }

    statsText.textContent = `Migrando ${initialTotal} fotos. Não feche esta página.`;
    log(`Migração iniciada: ${initialTotal} fotos.`);

    while (!shouldStop) {
      const part = await getNextBase64Part();

      if (!part) {
        break;
      }

      log(`Migrando: ${part.code || "-"} - ${part.name || "ITEM"}`);
      await migrateOnePart(part);
      migratedTotal += 1;
      setProgress();
      statsText.textContent = `Migradas ${migratedTotal} de ${initialTotal} fotos.`;
      await new Promise((resolve) => setTimeout(resolve, 650));
    }

    if (shouldStop) {
      log("Migração pausada pelo usuário.");
      statsText.textContent = `Migração pausada. Migradas ${migratedTotal} de ${initialTotal} fotos.`;
      return;
    }

    setProgress();
    statsText.textContent = "Migração concluída. As fotos antigas agora estão como link.";
    log("Migração concluída.");
  } catch (error) {
    statsText.textContent = error.message;
    log(`Erro: ${error.message}`);
  } finally {
    startButton.disabled = false;
    checkButton.disabled = false;
    stopButton.disabled = true;
  }
}

checkButton.addEventListener("click", checkPhotos);
startButton.addEventListener("click", startMigration);
stopButton.addEventListener("click", () => {
  shouldStop = true;
  stopButton.disabled = true;
  log("Parando após a foto atual...");
});

log("Ferramenta pronta. Primeiro clique em VERIFICAR FOTOS.");
