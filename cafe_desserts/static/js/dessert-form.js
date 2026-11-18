// Попередній перегляд вибраного фото у формі десерту.
const input = document.getElementById('photo');
const preview = document.getElementById('preview');
const placeholder = document.getElementById('no-preview');

input?.addEventListener('change', () => {
  const [file] = input.files;
  if (!file) return;
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);   // звільняємо пам'ять
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  if (placeholder) placeholder.hidden = true;
});
