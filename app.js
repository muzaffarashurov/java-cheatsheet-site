/* ============================================================
   JAVA MEGA CHEATSHEET — app.js
   Все интерактивные функции: поиск, аккордеон, избранное, копирование
   Работает полностью OFFLINE, без CDN и внешних зависимостей
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   1. УТИЛИТЫ
══════════════════════════════════════════ */

/** Безопасное получение из localStorage */
function lsGet(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

/** Безопасная запись в localStorage */
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage недоступен:', e); }
}

/** Дебаунс — задержка перед выполнением функции (для поиска) */
function debounce(fn, delay = 250) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

/** Нормализация строки для поиска: нижний регистр, убираем лишнее */
function normalize(str) {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ══════════════════════════════════════════
   2. ГЛАВНАЯ СТРАНИЦА (index.html)
══════════════════════════════════════════ */

/** Инициализация главной страницы */
function initIndexPage() {
  const searchInput = document.getElementById('topicSearch');  // поле поиска
  const tagEls      = document.querySelectorAll('.tag');         // все теги-фильтры
  const cards       = document.querySelectorAll('.card');        // все карточки тем
  const favViewBtn  = document.getElementById('favViewBtn');     // кнопка "Только избранное"
  const statsCount  = document.getElementById('statsCount');     // счётчик видимых карточек

  let activeTag    = 'all';   // текущий активный тег
  let searchQuery  = '';      // текущий поисковый запрос
  let favOnly      = false;   // режим "только избранное"

  /** Применяем фильтрацию ко всем карточкам */
  function applyFilter() {
    let visible = 0;

    cards.forEach(card => {
      const cardTags  = (card.dataset.tags || '').split(',').map(t => t.trim());
      const title     = normalize(card.querySelector('.card-title')?.textContent);
      const desc      = normalize(card.querySelector('.card-desc')?.textContent);
      const favKey    = card.dataset.fav;  // идентификатор для избранного

      // Проверка по тегу
      const tagOk = activeTag === 'all' || cardTags.includes(activeTag);

      // Проверка по поисковому запросу
      const searchOk = !searchQuery || title.includes(searchQuery) || desc.includes(searchQuery);

      // Проверка по избранному
      const favs = lsGet('jcs_favs', []);
      const favOk = !favOnly || (favKey && favs.includes(favKey));

      const show = tagOk && searchOk && favOk;
      card.dataset.hidden = show ? 'false' : 'true';
      if (show) visible++;
    });

    // Обновляем счётчик
    if (statsCount) statsCount.textContent = visible;
  }

  // Поиск с дебаунсом
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      searchQuery = normalize(e.target.value);
      applyFilter();
    }, 200));
  }

  // Клик по тегам
  tagEls.forEach(tag => {
    tag.addEventListener('click', () => {
      tagEls.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      activeTag = tag.dataset.tag || 'all';
      applyFilter();
    });
  });

  // Кнопка "Только избранное"
  if (favViewBtn) {
    favViewBtn.addEventListener('click', () => {
      favOnly = !favOnly;
      favViewBtn.classList.toggle('btn-fav-active', favOnly);
      favViewBtn.textContent = favOnly ? '⭐ Все темы' : '⭐ Избранное';
      applyFilter();
    });
  }

  // Инициализация кнопок "в избранное" на карточках
  initFavButtons();

  // Первый запуск фильтра
  applyFilter();
}

/* ══════════════════════════════════════════
   3. ИЗБРАННОЕ (общий модуль)
══════════════════════════════════════════ */

/** Инициализация кнопок "добавить в избранное" на карточках */
function initFavButtons() {
  const favs = lsGet('jcs_favs', []);  // загружаем список избранного

  document.querySelectorAll('.fav-btn').forEach(btn => {
    const topic = btn.dataset.topic;  // идентификатор темы
    if (!topic) return;

    // Устанавливаем начальное состояние
    btn.classList.toggle('active', favs.includes(topic));
    btn.title = favs.includes(topic) ? 'Убрать из избранного' : 'В избранное';

    btn.addEventListener('click', e => {
      e.preventDefault();          // не следуем по ссылке
      e.stopPropagation();         // не всплываем
      toggleFav(topic, btn);
    });
  });
}

/** Переключить тему в/из избранного */
function toggleFav(key, btn) {
  const favs = lsGet('jcs_favs', []);           // текущий список
  const idx  = favs.indexOf(key);               // ищем ключ

  if (idx === -1) {
    favs.push(key);                             // добавляем
    btn.classList.add('active');
    btn.title = 'Убрать из избранного';
    showToast('⭐ Добавлено в избранное');
  } else {
    favs.splice(idx, 1);                        // удаляем
    btn.classList.remove('active');
    btn.title = 'В избранное';
    showToast('Убрано из избранного');
  }

  lsSet('jcs_favs', favs);  // сохраняем в localStorage
}

/* ══════════════════════════════════════════
   4. АККОРДЕОН (accordion)
══════════════════════════════════════════ */

/** Инициализация всех аккордеонов на странице */
function initAccordions() {
  document.querySelectorAll('.acc-header').forEach(header => {
    header.addEventListener('click', () => toggleAccordion(header));
  });

  // Q&A аккордеоны (вопросы/ответы)
  document.querySelectorAll('.qa-header').forEach(header => {
    header.addEventListener('click', () => toggleQA(header));
  });
}

/** Переключить секцию аккордеона */
function toggleAccordion(header) {
  const body = header.nextElementSibling;  // тело аккордеона
  if (!body) return;

  const isOpen = header.classList.contains('open');

  // Закрываем все остальные в том же родителе (по желанию — опционально)
  // (можно убрать для возможности открыть несколько одновременно)

  header.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}

/** Переключить Q&A блок */
function toggleQA(header) {
  const body = header.nextElementSibling;
  if (!body || !body.classList.contains('qa-body')) return;

  const isOpen = header.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}

/* ══════════════════════════════════════════
   5. КОПИРОВАНИЕ КОДА
══════════════════════════════════════════ */

/** Инициализация кнопок "Копировать" для всех блоков кода */
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Ищем блок pre рядом с кнопкой
      const wrap = btn.closest('.code-wrap');
      const pre  = wrap?.querySelector('pre');
      if (!pre) return;

      const text = pre.innerText;  // получаем текст без HTML-тегов

      // Используем Clipboard API (работает офлайн в локальных файлах)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✓ Скопировано';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = '⎘ Копировать';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(() => fallbackCopy(text, btn));
      } else {
        fallbackCopy(text, btn);  // fallback для старых браузеров
      }
    });
  });
}

/** Fallback копирование через execCommand (устаревший API, но работает везде) */
function fallbackCopy(text, btn) {
  const ta = document.createElement('textarea');  // создаём временный textarea
  ta.value = text;
  ta.style.position = 'fixed';    // вне видимой области
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');   // устаревший API — работает как запасной
  document.body.removeChild(ta);

  btn.textContent = '✓ Скопировано';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = '⎘ Копировать';
    btn.classList.remove('copied');
  }, 2000);
}

/* ══════════════════════════════════════════
   6. ПОИСК ВНУТРИ СТРАНИЦ
══════════════════════════════════════════ */

/** Инициализация поиска внутри страницы (подсветка совпадений) */
function initPageSearch() {
  const input = document.getElementById('pageSearch');   // поле поиска
  const clear = document.getElementById('searchClear'); // кнопка сброса

  if (!input) return;

  input.addEventListener('input', debounce(e => {
    const q = normalize(e.target.value);
    highlightMatches(q);
  }, 200));

  if (clear) {
    clear.addEventListener('click', () => {
      input.value = '';
      clearHighlights();
    });
  }
}

/** Подсветить все совпадения на странице */
function highlightMatches(query) {
  clearHighlights();  // сначала очищаем предыдущие
  if (!query || query.length < 2) return;  // минимум 2 символа для поиска

  const content = document.querySelector('.page-content');
  if (!content) return;

  // Ищем текстовые узлы во всём контенте
  const walker = document.createTreeWalker(
    content,
    NodeFilter.SHOW_TEXT,  // только текстовые узлы
    {
      acceptNode: node => {
        // Игнорируем теги скриптов и стилей
        const parent = node.parentElement;
        if (parent.closest('script, style, .copy-btn')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (normalize(node.textContent).includes(query)) nodes.push(node);
  }

  // Оборачиваем совпадения в <mark>
  nodes.forEach(textNode => {
    const text = textNode.textContent;
    const lc   = text.toLowerCase();
    const idx  = lc.indexOf(query);
    if (idx === -1) return;

    const before = text.substring(0, idx);
    const match  = text.substring(idx, idx + query.length);
    const after  = text.substring(idx + query.length);

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    const mark = document.createElement('mark');
    mark.textContent = match;
    mark.className = 'search-mark';  // для последующей очистки
    fragment.appendChild(mark);
    if (after) fragment.appendChild(document.createTextNode(after));

    textNode.parentNode.replaceChild(fragment, textNode);
  });

  // Прокрутка к первому совпадению
  const firstMark = document.querySelector('mark.search-mark');
  if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Очистить все подсветки */
function clearHighlights() {
  document.querySelectorAll('mark.search-mark').forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();  // объединяем соседние текстовые узлы
  });
}

/* ══════════════════════════════════════════
   7. БОКОВОЕ МЕНЮ (sidebar nav)
══════════════════════════════════════════ */

/** Инициализация навигации в боковом меню */
function initSidebarNav() {
  const links   = document.querySelectorAll('.nav-link');   // ссылки меню
  const sidebar = document.querySelector('.page-sidebar');   // сайдбар
  const overlay = document.getElementById('overlay');        // затемнение
  const menuBtn = document.getElementById('menuBtn');        // кнопка гамбургер

  // Подсветка активного пункта при скролле (Intersection Observer)
  if (links.length > 0) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.nav-link[href="#${id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });  // триггер когда секция в центре

    document.querySelectorAll('.section[id]').forEach(s => observer.observe(s));
  }

  // Мобильное меню
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('show');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  // Закрываем меню после клика по ссылке (мобилка)
  links.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
      }
    });
  });

  // Поиск в сайдбаре
  const sideSearch = document.getElementById('sideSearch');
  if (sideSearch) {
    sideSearch.addEventListener('input', debounce(e => {
      const q = normalize(e.target.value);
      links.forEach(link => {
        const text = normalize(link.textContent);
        const li   = link.closest('li') || link;
        li.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    }, 150));
  }
}

/* ══════════════════════════════════════════
   8. КНОПКА "НАВЕРХ"
══════════════════════════════════════════ */

/** Инициализация кнопки прокрутки вверх */
function initScrollTop() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;

  // Показываем кнопку когда прокрутили на 300px
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ══════════════════════════════════════════
   9. Q&A ИЗБРАННОЕ
══════════════════════════════════════════ */

/** Инициализация кнопок "В избранное" у вопросов */
function initQAFavButtons() {
  const favs = lsGet('jcs_qa_favs', []);  // отдельное хранилище для вопросов

  document.querySelectorAll('.qa-fav-btn').forEach(btn => {
    const qid = btn.dataset.qid;  // уникальный ID вопроса
    if (!qid) return;

    btn.classList.toggle('active', favs.includes(qid));
    btn.textContent = favs.includes(qid) ? '⭐ В избранном' : '☆ В избранное';

    btn.addEventListener('click', () => {
      const list = lsGet('jcs_qa_favs', []);
      const idx  = list.indexOf(qid);

      if (idx === -1) {
        list.push(qid);
        btn.classList.add('active');
        btn.textContent = '⭐ В избранном';
        showToast('Вопрос добавлен в избранное');
      } else {
        list.splice(idx, 1);
        btn.classList.remove('active');
        btn.textContent = '☆ В избранное';
        showToast('Вопрос убран из избранного');
      }

      lsSet('jcs_qa_favs', list);  // сохраняем
    });
  });
}

/* ══════════════════════════════════════════
   10. УВЕДОМЛЕНИЯ (Toast)
══════════════════════════════════════════ */

let toastTimer = null;  // таймер для автоскрытия

/** Показать уведомление в нижней части экрана */
function showToast(message, duration = 2000) {
  // Удаляем старый toast если есть
  const existing = document.getElementById('jcs-toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  // Создаём toast-элемент
  const toast = document.createElement('div');
  toast.id            = 'jcs-toast';
  toast.textContent   = message;
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: #1e3050; border: 1px solid #4f8ef7; color: #dde6f0;
    padding: 10px 20px; border-radius: 8px; font-size: 0.85rem;
    z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    animation: fadeInUp 0.2s ease;
    white-space: nowrap;
  `;
  document.body.appendChild(toast);

  // Автоматически скрываем
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ══════════════════════════════════════════
   11. ПРОГРЕСС ЧТЕНИЯ
══════════════════════════════════════════ */

/** Полоса прогресса прочтения страницы */
function initReadProgress() {
  const bar = document.getElementById('readProgress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;                                          // сколько прокрутили
    const total    = document.documentElement.scrollHeight - window.innerHeight; // максимум
    const pct      = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

/* ══════════════════════════════════════════
   12. ИНИЦИАЛИЗАЦИЯ
══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Определяем тип страницы по наличию элементов
  const isIndex = !!document.getElementById('topicSearch');  // главная страница
  const isPage  = !!document.querySelector('.page-layout');  // внутренняя страница

  if (isIndex) {
    initIndexPage();    // главная: поиск, теги, карточки
  }

  if (isPage) {
    initSidebarNav();   // навигация по сайдбару
    initPageSearch();   // поиск внутри страницы
    initReadProgress(); // прогресс чтения
  }

  // Общие для всех страниц
  initAccordions();     // аккордеоны (разворачивающиеся блоки)
  initCopyButtons();    // кнопки копирования кода
  initFavButtons();     // кнопки "в избранное" (карточки)
  initQAFavButtons();   // кнопки "в избранное" (вопросы)
  initScrollTop();      // кнопка "наверх"

  console.log('☕ Java Mega Cheatsheet v2.0 — загружен успешно!');
});

/* ══════════════════════════════════════════
   13. ВСПОМОГАТЕЛЬНЫЕ ГЛОБАЛЬНЫЕ ФУНКЦИИ
   (используются inline в HTML атрибутах)
══════════════════════════════════════════ */

/** Очистить всё избранное (вызывается из settings) */
window.clearAllFavs = function() {
  if (confirm('Очистить всё избранное?')) {
    lsSet('jcs_favs', []);
    lsSet('jcs_qa_favs', []);
    document.querySelectorAll('.fav-btn.active, .qa-fav-btn.active').forEach(b => b.classList.remove('active'));
    showToast('Избранное очищено');
  }
};

/** Экспорт избранного в JSON */
window.exportFavs = function() {
  const data = {
    topics: lsGet('jcs_favs', []),
    questions: lsGet('jcs_qa_favs', []),
    date: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'java-cheatsheet-favs.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Избранное экспортировано!');
};
