const datasetsTable = document.querySelector('#datasets-table');
const datasetsBody = datasetsTable.querySelector('tbody');
const emptyState = document.querySelector('#datasets-empty');
const refreshButton = document.querySelector('#refresh-btn');
const createForm = document.querySelector('#create-form');
const formMessage = document.querySelector('#form-message');

async function fetchDatasets() {
  try {
    const response = await fetch('/api/datasets');
    if (!response.ok) {
      throw new Error('Failed to load datasets');
    }

    const payload = await response.json();
    renderDatasets(payload.datasets ?? []);
  } catch (error) {
    showMessage(error.message, true);
  }
}

function renderDatasets(datasets) {
  datasetsBody.innerHTML = '';

  if (!datasets.length) {
    datasetsTable.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  datasetsTable.classList.remove('hidden');

  datasets.forEach(dataset => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td><code>${dataset.id}</code></td>
      <td>${dataset.name}</td>
      <td>${dataset.status}</td>
      <td>${dataset.documentCount ?? '—'}</td>
      <td>${dataset.chunkCount ?? '—'}</td>
      <td>${dataset.model ?? 'default'}</td>
      <td>${dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleString() : '—'}</td>
      <td>
        <button class="secondary delete-btn" data-id="${dataset.id}">Delete</button>
      </td>
    `;

    datasetsBody.appendChild(row);
  });
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.remove('hidden', 'error');
  if (isError) {
    formMessage.classList.add('error');
  }
}

function clearMessage() {
  formMessage.classList.add('hidden');
  formMessage.textContent = '';
  formMessage.classList.remove('error');
}

async function handleCreate(event) {
  event.preventDefault();
  clearMessage();

  const formData = new FormData(createForm);
  const payload = Object.fromEntries(formData.entries());

  // Convert numeric fields
  if (payload.chunkSize === '') delete payload.chunkSize;
  if (payload.chunkOverlap === '') delete payload.chunkOverlap;

  if (payload.chunkSize) payload.chunkSize = Number(payload.chunkSize);
  if (payload.chunkOverlap) payload.chunkOverlap = Number(payload.chunkOverlap);

  try {
    showMessage('Creating dataset...');
    const response = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || 'Failed to create dataset');
    }

    showMessage(`Dataset '${body.datasetId}' created with ${body.chunks} chunks.`, false);
    createForm.reset();
    await fetchDatasets();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function handleDelete(datasetId) {
  const confirmed = window.confirm(`Delete dataset '${datasetId}'? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/datasets/${datasetId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to delete dataset');
    }

    await fetchDatasets();
    showMessage(`Dataset '${datasetId}' deleted.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

refreshButton.addEventListener('click', () => {
  clearMessage();
  fetchDatasets();
});

createForm.addEventListener('submit', handleCreate);

datasetsBody.addEventListener('click', event => {
  const target = event.target;
  if (target instanceof HTMLElement && target.classList.contains('delete-btn')) {
    const datasetId = target.dataset.id;
    if (datasetId) {
      handleDelete(datasetId);
    }
  }
});

fetchDatasets();
