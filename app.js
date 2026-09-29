const $ = (selector) => document.querySelector(selector);
const FONT_NAMES = [
  'Libre Baskerville','Manufacturing Consent','DM Sans','Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Nunito','Raleway','Merriweather','Playfair Display','Cormorant Garamond','EB Garamond','Crimson Text','Lora','Cinzel','Cinzel Decorative','MedievalSharp','Uncial Antiqua','IM Fell English','IM Fell DW Pica','Pirata One','Almendra','Fondamento','Quintessential','Alegreya','Alegreya Sans','Bitter','Source Serif 4','Source Sans 3','Spectral','Newsreader','Literata','Vollkorn','PT Serif','PT Sans','Noto Serif','Noto Sans','Oswald','Anton','Bebas Neue','Abril Fatface','Dancing Script','Great Vibes','Pacifico','Caveat','Inconsolata','Space Grotesk','Space Mono'
];
const FONT_SET = new Set(FONT_NAMES);
const loadedFonts = new Set(['DM Sans','Libre Baskerville']);
const STORAGE_KEY = 'boccaccio-document-v1';
const DEFAULT_PAGE = () => ({id: crypto.randomUUID(), html: '<h1>Crônicas de um novo mundo</h1><p>Era uma vez uma história esperando para ser escrita. Clique aqui e comece a criar seu livro.</p><p>Adicione imagens para que o texto flua ao redor delas. Cada página pode ter sua própria atmosfera, cor e textura.</p>', bg: 'parchment', bgColor: '#ffffff', bgImage: '', margin: 'normal', size: 'a4'});
let doc = {title: 'Meu livro sem título', pages: [DEFAULT_PAGE()]};
let activeId = doc.pages[0].id;
let selectedImage = null;
let savedRange = null;
let saveTimer = null;
let toastTimer = null;
let dbPromise = null;

function ensureFont(name) {
  if (!FONT_SET.has(name) || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}&display=swap`;
  document.head.append(link);
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3000);
}

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponível'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('boccaccio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function readSaved() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction('documents').objectStore('documents').get(STORAGE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }
}

async function saveNow() {
  saveTimer = null;
  $('#saveStatus').textContent = 'Salvando...';
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction('documents', 'readwrite').objectStore('documents').put(doc, STORAGE_KEY);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    $('#saveStatus').textContent = 'Salvo neste navegador';
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      $('#saveStatus').textContent = 'Salvo neste navegador';
    } catch {
      $('#saveStatus').textContent = 'Erro ao salvar. Baixe uma cópia.';
      toast('Espaço insuficiente. Use “Salvar arquivo” para não perder alterações.');
    }
  }
}

function scheduleSave() {
  $('#saveStatus').textContent = 'Alterações não salvas';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function currentPage() { return doc.pages.find(page => page.id === activeId) || doc.pages[0]; }
function editorFor(id = activeId) { return [...document.querySelectorAll('.page-content')].find(node => node.dataset.id === id); }
function wordCount(html) { const node = document.createElement('div'); node.innerHTML = html; return node.textContent.trim().split(/\s+/).filter(Boolean).length; }

function safeImageUrl(value) { return typeof value === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value) ? value : ''; }
function safeCssColor(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'; }
function safeStyle(value) {
  if (!value) return '';
  return String(value).split(';').map(rule => rule.trim()).filter(rule => /^(?:color|background-color|font-family|font-size|font-weight|font-style|text-decoration|text-align|text-shadow):[\w\s#.,()'"%+-]+$/i.test(rule)).join(';');
}

function cleanHtml(html) {
  const source = document.createElement('div');
  source.innerHTML = String(html || '');
  const allowed = new Set(['P','H1','H2','H3','DIV','BR','B','STRONG','I','EM','U','S','UL','OL','LI','BLOCKQUOTE','SPAN','FONT','IMG']);
  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
    if (!allowed.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      if (!['SCRIPT','STYLE','IFRAME','OBJECT','SVG'].includes(node.tagName)) for (const child of [...node.childNodes]) fragment.append(cleanNode(child));
      return fragment;
    }
    const output = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'IMG') {
      const src = safeImageUrl(node.getAttribute('src'));
      if (!src) return document.createDocumentFragment();
      output.src = src;
      output.alt = (node.getAttribute('alt') || '').slice(0, 200);
      output.className = 'editor-image';
      output.dataset.wrap = ['left','right','center'].includes(node.dataset.wrap) ? node.dataset.wrap : 'left';
      output.dataset.style = ['plain','frame','shadow'].includes(node.dataset.style) ? node.dataset.style : 'plain';
      output.style.width = `${Math.max(15, Math.min(100, parseInt(node.style.width, 10) || 40))}%`;
      return output;
    }
    const style = safeStyle(node.getAttribute('style'));
    if (style) output.setAttribute('style', style);
    if (node.classList.contains('text-shadow')) output.classList.add('text-shadow');
    if (node.tagName === 'FONT') {
      const face = node.getAttribute('face');
      if (FONT_SET.has(face)) output.setAttribute('face', face);
      const color = node.getAttribute('color');
      if (/^#[0-9a-f]{6}$/i.test(color || '')) output.setAttribute('color', color);
    }
    for (const child of [...node.childNodes]) output.append(cleanNode(child));
    return output;
  }
  const output = document.createElement('div');
  for (const child of [...source.childNodes]) output.append(cleanNode(child));
  return output.innerHTML;
}

function normalizeDocument(value) {
  if (!value || !Array.isArray(value.pages) || !value.pages.length) throw new Error('Arquivo inválido');
  return {
    title: String(value.title || 'Meu livro sem título').slice(0, 150),
    pages: value.pages.slice(0, 300).map(page => ({
      id: crypto.randomUUID(), html: cleanHtml(page.html),
      bg: ['paper','parchment','night','custom'].includes(page.bg) ? page.bg : 'paper',
      bgColor: safeCssColor(page.bgColor), bgImage: safeImageUrl(page.bgImage),
      margin: ['normal','narrow','wide'].includes(page.margin) ? page.margin : 'normal',
      size: ['a4','letter'].includes(page.size) ? page.size : 'a4'
    }))
  };
}

function pageDimensions(page) { return page.size === 'letter' ? [816,1056] : [794,1123]; }
function pagePadding(page) { return ({narrow: 48,normal: 78,wide: 105})[page.margin] || 78; }
function pageShortName(page, index) {
  const node = document.createElement('div'); node.innerHTML = page.html;
  return node.textContent.trim().slice(0, 24) || `Página ${index + 1}`;
}

function renderPageList() {
  const list = $('#pageList'); list.replaceChildren();
  doc.pages.forEach((page, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `page-item${page.id === activeId ? ' active' : ''}`;
    button.dataset.id = page.id;
    const thumb = document.createElement('span'); thumb.className = `page-thumb ${page.bg}`;
    if (page.bg === 'custom') thumb.style.setProperty('--thumb-bg', page.bgColor);
    thumb.innerHTML = '<span class="thumb-line short"></span><span class="thumb-line"></span><span class="thumb-line medium"></span><span class="thumb-line"></span><span class="thumb-line short"></span>';
    const meta = document.createElement('span'); meta.className = 'page-meta';
    const strong = document.createElement('strong'); strong.textContent = `Página ${index + 1}`;
    const small = document.createElement('small'); small.textContent = pageShortName(page,index);
    meta.append(strong,small); button.append(thumb,meta);
    button.addEventListener('click', () => activatePage(page.id, true));
    list.append(button);
  });
}

function renderPages() {
  const canvas = $('#pageCanvas'); canvas.replaceChildren();
  for (const [index,page] of doc.pages.entries()) {
    const shell = document.createElement('section'); shell.className = 'sheet-shell'; shell.dataset.id = page.id;
    const [width,height] = pageDimensions(page);
    shell.style.setProperty('--page-width', `${width}px`); shell.style.setProperty('--page-height', `${height}px`);
    shell.style.setProperty('--page-padding', `${pagePadding(page)}px`);
    const label = document.createElement('div'); label.className = 'sheet-label'; label.textContent = `PÁGINA ${index + 1}`;
    const sheet = document.createElement('div'); sheet.className = `sheet${page.bgImage ? ' has-background-image' : ''}`;
    sheet.dataset.bg = page.bg; sheet.dataset.size = page.size;
    sheet.style.setProperty('--custom-bg', page.bgColor);
    if (page.bgImage) sheet.style.setProperty('--background-image', `url("${page.bgImage}")`);
    const editor = document.createElement('div'); editor.className = 'page-content'; editor.dataset.id = page.id;
    editor.contentEditable = 'true'; editor.spellcheck = true; editor.lang = 'pt-BR'; editor.setAttribute('role','textbox');
    editor.setAttribute('aria-label',`Conteúdo da página ${index + 1}`); editor.setAttribute('aria-multiline','true');
    editor.innerHTML = page.html;
    editor.addEventListener('focus', () => activatePage(page.id, false));
    editor.addEventListener('input', () => { page.html = editor.innerHTML; scheduleSave(); updateCounts(); updateOverflow(shell,editor,height); updatePageMeta(page); });
    editor.addEventListener('click', event => {
      if (event.target.matches('img.editor-image')) selectImage(event.target);
      else selectImage(null);
    });
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('dragover', event => { if ([...event.dataTransfer.items].some(item => item.type.startsWith('image/'))) event.preventDefault(); });
    editor.addEventListener('drop', event => {
      const file = [...event.dataTransfer.files].find(item => item.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault(); activatePage(page.id,false); editor.focus();
      const range = document.caretRangeFromPoint?.(event.clientX,event.clientY);
      if (range && editor.contains(range.commonAncestorContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); rememberSelection(); }
      insertImage(file);
    });
    editor.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); addPage(); }
    });
    sheet.append(editor); shell.append(label,sheet);
    const note = document.createElement('div'); note.className = 'overflow-note'; note.textContent = 'Conteúdo passou do limite da página. Continue em uma nova página.'; shell.append(note);
    canvas.append(shell);
    for (const font of FONT_NAMES) if (page.html.includes(font)) ensureFont(font);
    requestAnimationFrame(() => updateOverflow(shell,editor,height));
  }
  renderPageList(); updateCounts(); updateInspector();
}

function updatePageMeta(page) {
  const item = [...document.querySelectorAll('.page-item')].find(node => node.dataset.id === page.id);
  if (item) item.querySelector('small').textContent = pageShortName(page,doc.pages.indexOf(page));
}
function updateOverflow(shell,editor,height) { shell.querySelector('.sheet').classList.toggle('overflowing', editor.scrollHeight > height + 3); }
function updateCounts() {
  $('#pageCount').textContent = `${doc.pages.length} ${doc.pages.length === 1 ? 'página' : 'páginas'}`;
  const count = doc.pages.reduce((sum,page) => sum + wordCount(page.html),0);
  $('#wordCount').textContent = `${count} ${count === 1 ? 'palavra' : 'palavras'}`;
}
function updateInspector() {
  const page = currentPage(); if (!page) return;
  document.querySelectorAll('.background-tile').forEach(button => button.classList.toggle('selected',button.dataset.bg === page.bg));
  $('#pageColor').value = page.bgColor; $('#pageMargin').value = page.margin; $('#pageSize').value = page.size;
  $('#removeBackgroundBtn').hidden = !page.bgImage;
  $('#deletePageBtn').disabled = doc.pages.length === 1;
}
function activatePage(id, scroll) {
  if (!doc.pages.some(page => page.id === id)) return;
  activeId = id; selectImage(null); updateInspector();
  document.querySelectorAll('.page-item').forEach(item => item.classList.toggle('active',item.dataset.id === id));
  if (scroll) editorFor(id)?.closest('.sheet-shell').scrollIntoView({behavior:'smooth',block:'start'});
}
function addPage(copy = null) {
  const source = currentPage(); const page = copy ? {...source,id:crypto.randomUUID()} : {...DEFAULT_PAGE(),bg:source.bg,bgColor:source.bgColor,bgImage:source.bgImage,margin:source.margin,size:source.size,html:'<p><br></p>'};
  doc.pages.splice(doc.pages.indexOf(source)+1,0,page);
  activeId = page.id; renderPages(); scheduleSave();
  editorFor(page.id).closest('.sheet-shell').scrollIntoView({behavior:'smooth',block:'start'});
  if (!copy) editorFor(page.id).focus();
}

function rememberSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const editor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer.closest?.('.page-content') : range.commonAncestorContainer.parentElement?.closest('.page-content');
  if (editor) { activeId = editor.dataset.id; savedRange = range.cloneRange(); }
}
function restoreSelection() {
  const editor = editorFor(); editor.focus();
  const selection = window.getSelection();
  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(savedRange); }
}
function syncEditor() {
  const editor = editorFor(); if (!editor) return;
  currentPage().html = editor.innerHTML;
  scheduleSave(); updateCounts(); updatePageMeta(currentPage());
  updateOverflow(editor.closest('.sheet-shell'), editor, pageDimensions(currentPage())[1]);
}
function command(name,value = null) {
  restoreSelection();
  document.execCommand(name,false,value);
  rememberSelection(); syncEditor();
}
function applyStyle(property,value) {
  restoreSelection();
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const span = document.createElement('span'); span.style[property] = value;
  if (range.collapsed) {
    document.execCommand('insertHTML',false,`<span style="${property.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${escapeHtml(value)}">&#8203;</span>`);
  } else {
    try { range.surroundContents(span); }
    catch { span.append(range.extractContents()); range.insertNode(span); }
    selection.removeAllRanges(); selection.selectAllChildren(span);
  }
  rememberSelection(); syncEditor();
}
function handlePaste(event) {
  const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/'));
  if (image) { event.preventDefault(); insertImage(image); return; }
  const text = event.clipboardData.getData('text/plain');
  if (!text) return;
  event.preventDefault();
  document.execCommand('insertText',false,text);
  syncEditor();
}

function selectImage(image) {
  if (selectedImage) selectedImage.classList.remove('selected-image');
  selectedImage = image && image.isConnected ? image : null;
  $('#imageInspector').hidden = !selectedImage;
  if (selectedImage) {
    selectedImage.classList.add('selected-image');
    const width = parseInt(selectedImage.style.width,10) || 40;
    $('#imageWidth').value = width; $('#imageWidthValue').textContent = `${width}%`;
    $('#imageWrap').value = selectedImage.dataset.wrap || 'left';
    $('#imageStyle').value = selectedImage.dataset.style || 'plain';
  }
}

async function readImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Imagem acima de 25 MB.');
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(image.width,image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale));
  const context = canvas.getContext('2d'); context.drawImage(image,0,0,canvas.width,canvas.height); image.close();
  return canvas.toDataURL('image/webp',.84);
}
async function insertImage(file) {
  try {
    const src = await readImage(file);
    restoreSelection();
    const editor = editorFor();
    const image = document.createElement('img'); image.className = 'editor-image'; image.src = src; image.alt = file.name.replace(/\.[^.]+$/,''); image.dataset.wrap = 'left'; image.dataset.style = 'plain'; image.style.width = '40%';
    const selection = window.getSelection(); const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    if (range && editor.contains(range.commonAncestorContainer)) { range.deleteContents(); range.insertNode(image); range.setStartAfter(image); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
    else editor.append(image);
    selectImage(image); syncEditor(); toast('Imagem inserida. Texto se ajusta ao redor.');
  } catch (error) { toast(error.message || 'Não foi possível abrir a imagem.'); }
}

function download(name,type,contents) {
  const blob = new Blob([contents],{type}); const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
function fileName(extension) { return (doc.title.trim().replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-').slice(0,80) || 'meu-livro') + extension; }
function exportHtml() {
  const sections = doc.pages.map(page => {
    const [width,height] = pageDimensions(page);
    const background = page.bgImage ? `background-image:url('${page.bgImage}');background-size:cover;background-position:center;` : page.bg === 'parchment' ? 'background:radial-gradient(ellipse at 20% 15%,#fff3d1,transparent 52%),repeating-linear-gradient(100deg,#e7d1a5,#ecd8b0 7px,#e6d0a4 13px);' : page.bg === 'night' ? 'background:#23372e;color:#f0eee3;' : `background:${page.bg === 'custom' ? page.bgColor : '#fff'};`;
    return `<section class="page" style="width:${width}px;min-height:${height}px;${background}"><article style="min-height:${height}px;padding:${pagePadding(page)}px">${cleanHtml(page.html)}</article></section>`;
  }).join('\n');
  const fonts = [...new Set(FONT_NAMES.filter(name => doc.pages.some(page => page.html.includes(name))).concat(['Libre Baskerville','Manufacturing Consent']))];
  const fontLinks = fonts.map(name => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g,'+')}&display=swap">`).join('');
  const css = `*{box-sizing:border-box}body{margin:0;background:#deded9;color:#302820}.page{margin:25px auto;box-shadow:0 6px 20px #0002;overflow:hidden}.page article{font:16px/1.7 'Libre Baskerville',serif;overflow-wrap:anywhere}.page h1,.page h2{font-family:'Manufacturing Consent',serif;font-weight:400;line-height:1.15}.page h1{font-size:3em}.page h2{font-size:2em}.page p{margin:0 0 1em}.page blockquote{border-left:3px solid #aa895c;margin:1em 0;padding-left:1em;font-style:italic}.editor-image{height:auto;max-width:100%}.editor-image[data-wrap=left]{float:left;clear:left;margin:5px 20px 13px 0}.editor-image[data-wrap=right]{float:right;clear:right;margin:5px 0 13px 20px}.editor-image[data-wrap=center]{display:block;float:none;margin:16px auto;clear:both}.editor-image[data-style=frame]{border:6px solid #efe6d2;outline:1px solid #806b51}.editor-image[data-style=shadow]{box-shadow:8px 11px 19px #0005}.text-shadow{text-shadow:2px 2px 3px #0006}@media print{@page{size:A4;margin:0}body{background:#fff}.page{margin:0;box-shadow:none;break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}.page:last-child{break-after:auto}}`;
  download(fileName('.html'),'text/html;charset=utf-8',`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.title)}</title>${fontLinks}<style>${css}</style></head><body>${sections}</body></html>`);
  toast('HTML exportado.');
}

function bindEvents() {
  $('#docTitle').addEventListener('input',event => { doc.title = event.target.value; document.title = `${doc.title} — Boccaccio`; scheduleSave(); });
  $('#addPage').addEventListener('click',() => addPage()); $('#addPageSmall').addEventListener('click',() => addPage());
  $('#duplicatePageBtn').addEventListener('click',() => addPage(true));
  $('#deletePageBtn').addEventListener('click',() => { if (doc.pages.length < 2) return; const index = doc.pages.findIndex(page => page.id === activeId); doc.pages.splice(index,1); activeId = doc.pages[Math.max(0,index-1)].id; renderPages(); scheduleSave(); });
  document.querySelectorAll('[data-command]').forEach(button => { button.addEventListener('mousedown',event => event.preventDefault()); button.addEventListener('click',() => command(button.dataset.command)); });
  $('#blockStyle').addEventListener('change',event => command('formatBlock',event.target.value));
  $('#fontFamily').addEventListener('change',event => { ensureFont(event.target.value); command('fontName',event.target.value); });
  $('#fontSize').addEventListener('change',event => applyStyle('fontSize',`${event.target.value}px`));
  $('#textColor').addEventListener('input',event => { document.documentElement.style.setProperty('--text-color',event.target.value); command('foreColor',event.target.value); });
  $('#shadowBtn').addEventListener('mousedown',event => event.preventDefault());
  $('#shadowBtn').addEventListener('click',() => { restoreSelection(); const selection = window.getSelection(); if (!selection.rangeCount || selection.isCollapsed) { toast('Selecione texto para aplicar sombra.'); return; } const range = selection.getRangeAt(0); const span = document.createElement('span'); span.className = 'text-shadow'; try { range.surroundContents(span); } catch { span.append(range.extractContents()); range.insertNode(span); } syncEditor(); });
  $('#insertImageBtn').addEventListener('mousedown',event => event.preventDefault()); $('#insertImageBtn').addEventListener('click',() => $('#imageInput').click());
  $('#imageInput').addEventListener('change',async event => { if (event.target.files[0]) await insertImage(event.target.files[0]); event.target.value = ''; });
  $('#backgroundImageBtn').addEventListener('click',() => $('#backgroundInput').click());
  $('#backgroundInput').addEventListener('change',async event => { if (!event.target.files[0]) return; try { currentPage().bgImage = await readImage(event.target.files[0]); renderPages(); scheduleSave(); } catch(error) { toast(error.message); } event.target.value = ''; });
  $('#removeBackgroundBtn').addEventListener('click',() => { currentPage().bgImage = ''; renderPages(); scheduleSave(); });
  $('#backgroundGrid').addEventListener('click',event => { const button = event.target.closest('[data-bg]'); if (!button) return; currentPage().bg = button.dataset.bg; if (button.dataset.bg === 'custom') $('#pageColor').click(); renderPages(); scheduleSave(); });
  $('#pageColor').addEventListener('input',event => { currentPage().bgColor = event.target.value; currentPage().bg = 'custom'; const sheet = editorFor().parentElement; sheet.dataset.bg = 'custom'; sheet.style.setProperty('--custom-bg',event.target.value); document.querySelectorAll('.background-tile').forEach(button => button.classList.toggle('selected',button.dataset.bg === 'custom')); renderPageList(); scheduleSave(); });
  $('#pageMargin').addEventListener('change',event => { currentPage().margin = event.target.value; renderPages(); scheduleSave(); });
  $('#pageSize').addEventListener('change',event => { currentPage().size = event.target.value; renderPages(); scheduleSave(); });
  $('#imageWidth').addEventListener('input',event => { if (!selectedImage) return; selectedImage.style.width = `${event.target.value}%`; $('#imageWidthValue').textContent = `${event.target.value}%`; syncEditor(); });
  $('#imageWrap').addEventListener('change',event => { if (!selectedImage) return; selectedImage.dataset.wrap = event.target.value; syncEditor(); });
  $('#imageStyle').addEventListener('change',event => { if (!selectedImage) return; selectedImage.dataset.style = event.target.value; syncEditor(); });
  $('#removeImageBtn').addEventListener('click',() => { if (!selectedImage) return; selectedImage.remove(); selectImage(null); syncEditor(); });
  $('#saveBtn').addEventListener('click',() => { download(fileName('.boccaccio'),'application/json;charset=utf-8',JSON.stringify(doc)); toast('Cópia editável baixada.'); });
  $('#exportBtn').addEventListener('click',exportHtml);
  $('#printBtn').addEventListener('click',() => window.print());
  $('#designToggle').addEventListener('click',() => {
    const open = document.querySelector('.right-sidebar').classList.toggle('open');
    $('#designToggle').setAttribute('aria-label',open ? 'Ocultar design da página' : 'Mostrar design da página');
  });
  $('#importBtn').addEventListener('click',() => $('#documentInput').click());
  $('#documentInput').addEventListener('change',async event => { const file = event.target.files[0]; if (!file) return; try { doc = normalizeDocument(JSON.parse(await file.text())); activeId = doc.pages[0].id; $('#docTitle').value = doc.title; renderPages(); scheduleSave(); toast('Livro aberto.'); } catch { toast('Arquivo Boccaccio inválido.'); } event.target.value = ''; });
  document.addEventListener('selectionchange',rememberSelection);
  document.addEventListener('visibilitychange',() => { if (document.hidden && saveTimer) { clearTimeout(saveTimer); saveNow(); } });
  document.addEventListener('keydown',event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('#saveBtn').click(); } });
}

async function start() {
  for (const name of FONT_NAMES) { const option = document.createElement('option'); option.value = name; option.textContent = name; $('#fontFamily').append(option); }
  $('#fontFamily').value = 'Libre Baskerville';
  const saved = await readSaved();
  if (saved) try { doc = normalizeDocument(saved); activeId = doc.pages[0].id; } catch { /* documento anterior corrompido: abrir novo */ }
  $('#docTitle').value = doc.title; document.title = `${doc.title} — Boccaccio`;
  ensureFont('Manufacturing Consent'); bindEvents(); renderPages();
}
start();
