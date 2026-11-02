/**
 * Interactive Eye-Friendly Quiz App Engine (160 Questions)
 * Tanta University CS433 Question Bank
 */

(() => {
  'use strict';

  // --- Audio Context for Gentle Synthesized Sound Effects ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'correct') {
        // Gentle uplifting dual tone (C5 -> E5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'wrong') {
        // Soft low muted tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.31);
      } else if (type === 'click') {
        // Very subtle pop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch (e) {
      // Audio might be restricted by browser autoplay policy
    }
  }

  // --- App State ---
  const state = {
    allQuestions: typeof QUIZ_DATA !== 'undefined' ? QUIZ_DATA : [],
    filteredQuestions: [],
    currentIndex: 0,
    userAnswers: {}, // questionId -> selectedKey ('a','b','c','d','True','False')
    bookmarks: new Set(),
    langMode: 'both', // 'both' | 'en' | 'ar'
    theme: 'light', // 'light' | 'dark' | 'sepia'
    fontSize: 'md', // 'sm' | 'md' | 'lg' | 'xl'
    activeBank: 'all', // 'all' | 1 | 2 | 3 | 4
    activeType: 'all', // 'all' | 'mcq' | 'tf'
    specialFilter: null, // null | 'bookmarks' | 'mistakes'
    searchQuery: '',
    soundEnabled: true
  };

  // --- LocalStorage Persistence ---
  const STORAGE_KEY = 'cs433_quiz_store_v2';
  const OLD_STORAGE_KEY = 'cs433_quiz_store_v1';

  function saveToStorage() {
    try {
      const data = {
        userAnswers: state.userAnswers,
        bookmarks: Array.from(state.bookmarks),
        langMode: state.langMode,
        theme: state.theme,
        fontSize: state.fontSize,
        soundEnabled: state.soundEnabled
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }

  function loadFromStorage() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldRaw) {
          const oldData = JSON.parse(oldRaw);
          if (oldData.userAnswers) state.userAnswers = oldData.userAnswers;
          if (oldData.bookmarks) state.bookmarks = new Set(oldData.bookmarks);
          if (oldData.fontSize) state.fontSize = oldData.fontSize;
          state.theme = 'light';
          saveToStorage();
          return;
        }
      }
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.userAnswers) state.userAnswers = data.userAnswers;
      if (data.bookmarks) state.bookmarks = new Set(data.bookmarks);
      if (data.langMode) state.langMode = data.langMode;
      if (data.theme) state.theme = data.theme;
      if (data.fontSize) state.fontSize = data.fontSize;
      if (typeof data.soundEnabled === 'boolean') state.soundEnabled = data.soundEnabled;
    } catch (e) {
      console.warn('LocalStorage load failed', e);
    }
  }

  // --- Filtering & Sorting ---
  function applyFilters() {
    let list = [...state.allQuestions];

    // Bank filter
    if (state.activeBank !== 'all') {
      const bId = parseInt(state.activeBank, 10);
      list = list.filter(q => q.bank_id === bId);
    }

    // Question Type filter
    if (state.activeType !== 'all') {
      list = list.filter(q => q.type === state.activeType);
    }

    // Special collections
    if (state.specialFilter === 'bookmarks') {
      list = list.filter(q => state.bookmarks.has(q.id));
    } else if (state.specialFilter === 'mistakes') {
      list = list.filter(q => {
        const userAns = state.userAnswers[q.id];
        return userAns && userAns !== q.answer;
      });
    }

    // Search query
    if (state.searchQuery.trim()) {
      const term = state.searchQuery.trim().toLowerCase();
      list = list.filter(q => {
        return (
          q.question.toLowerCase().includes(term) ||
          (q.question_ar && q.question_ar.includes(term)) ||
          q.explanation.toLowerCase().includes(term) ||
          (q.explanation_ar && q.explanation_ar.includes(term)) ||
          q.q_num.toLowerCase().includes(term) ||
          (q.reference && q.reference.toLowerCase().includes(term))
        );
      });
    }

    state.filteredQuestions = list;

    // Boundary check for index
    if (state.currentIndex >= state.filteredQuestions.length) {
      state.currentIndex = Math.max(0, state.filteredQuestions.length - 1);
    }

    updateStats();
    renderGrid();
    renderCurrentQuestion();
  }

  // --- DOM Elements Cache ---
  const DOM = {
    html: document.documentElement,
    // Header
    langBoth: document.getElementById('lang-both'),
    langEn: document.getElementById('lang-en'),
    langAr: document.getElementById('lang-ar'),
    btnFontDec: document.getElementById('btn-font-dec'),
    btnFontInc: document.getElementById('btn-font-inc'),
    btnTheme: document.getElementById('btn-theme-toggle'),
    themeDropdown: document.getElementById('theme-dropdown'),
    themeName: document.querySelector('.theme-name'),
    themeIcon: document.querySelector('.theme-icon'),
    btnSound: document.getElementById('btn-sound-toggle'),
    soundIcon: document.getElementById('sound-icon'),
    btnOpenGrid: document.getElementById('btn-open-grid'),
    btnCloseGrid: document.getElementById('btn-close-grid'),
    sidebar: document.getElementById('sidebar'),

    // Sidebar
    bankChips: document.querySelectorAll('.bank-chip'),
    typePills: document.querySelectorAll('.type-pill'),
    filterBookmarks: document.getElementById('filter-bookmarks'),
    filterMistakes: document.getElementById('filter-mistakes'),
    countBookmarks: document.getElementById('count-bookmarks'),
    countMistakes: document.getElementById('count-mistakes'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    questionsGrid: document.getElementById('questions-grid'),
    gridVisibleCount: document.getElementById('grid-visible-count'),
    statAnswered: document.getElementById('stat-answered'),
    statCorrect: document.getElementById('stat-correct'),
    statPercentage: document.getElementById('stat-percentage'),
    btnResetBankSidebar: document.getElementById('btn-reset-bank-sidebar'),
    btnResetAll: document.getElementById('btn-reset-all'),

    // Content
    badgeBank: document.getElementById('badge-bank'),
    badgeType: document.getElementById('badge-type'),
    currentQIndex: document.getElementById('current-q-index'),
    totalQCount: document.getElementById('total-q-count'),
    btnFlag: document.getElementById('btn-flag'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    qCode: document.getElementById('q-code'),
    qTextEn: document.getElementById('q-text-en'),
    qTextAr: document.getElementById('q-text-ar'),
    optionsContainer: document.getElementById('options-container'),
    explanationBox: document.getElementById('explanation-box'),
    expStatusIcon: document.getElementById('exp-status-icon'),
    expStatusTitle: document.getElementById('exp-status-title'),
    tabExpAr: document.getElementById('tab-exp-ar'),
    tabExpEn: document.getElementById('tab-exp-en'),
    expContentAr: document.getElementById('exp-content-ar'),
    expContentEn: document.getElementById('exp-content-en'),
    expTextAr: document.getElementById('exp-text-ar'),
    expTextEn: document.getElementById('exp-text-en'),
    expReferenceWrap: document.getElementById('exp-reference-wrap'),
    expReference: document.getElementById('exp-reference'),

    // Footer actions
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnResetBank: document.getElementById('btn-reset-bank')
  };

  // --- Rendering ---
  function renderCurrentQuestion() {
    const list = state.filteredQuestions;
    if (!list || list.length === 0) {
      renderEmptyState();
      return;
    }

    const q = list[state.currentIndex];
    const isAnswered = q.id in state.userAnswers;
    const userSelected = state.userAnswers[q.id];
    const isFlagged = state.bookmarks.has(q.id);

    // Update Progress and Badges
    DOM.currentQIndex.textContent = (state.currentIndex + 1).toString();
    DOM.totalQCount.textContent = list.length.toString();
    const progressPct = ((state.currentIndex + 1) / list.length) * 100;
    DOM.progressBarFill.style.width = `${progressPct}%`;

    DOM.badgeBank.textContent = q.bank_title_ar || q.bank_title_en;
    DOM.badgeType.textContent = q.type === 'mcq' ? 'اختيار من متعدد (MCQ)' : 'صح أم خطأ (True/False)';
    DOM.qCode.textContent = q.q_num;

    // Flag button state
    DOM.btnFlag.classList.toggle('active', isFlagged);

    // Render Question Texts according to language mode
    if (state.langMode === 'en') {
      DOM.qTextEn.style.display = 'block';
      DOM.qTextAr.style.display = 'none';
      DOM.qTextEn.innerHTML = q.question;
    } else if (state.langMode === 'ar') {
      DOM.qTextEn.style.display = 'none';
      DOM.qTextAr.style.display = 'block';
      DOM.qTextAr.innerHTML = q.question_ar || q.question;
    } else { // both
      DOM.qTextEn.style.display = 'block';
      DOM.qTextAr.style.display = 'block';
      DOM.qTextEn.innerHTML = q.question;
      DOM.qTextAr.innerHTML = q.question_ar || '';
    }

    // Render Options
    DOM.optionsContainer.innerHTML = '';

    q.options.forEach((opt) => {
      const optEl = document.createElement('div');
      optEl.className = 'option-item';
      optEl.dataset.key = opt.key;

      const isSelected = userSelected === opt.key;
      const isCorrectAnswer = opt.key === q.answer;

      if (isSelected) {
        optEl.classList.add('selected');
      }

      // Reveal correct/wrong styling immediately when answered
      if (isAnswered) {
        optEl.classList.add('disabled');
        if (isCorrectAnswer) {
          optEl.classList.add('correct');
        } else if (isSelected && !isCorrectAnswer) {
          optEl.classList.add('wrong');
        }
      }

      // Option Key Label
      let keyDisplay = opt.key.toUpperCase();
      if (q.type === 'tf') {
        keyDisplay = opt.key === 'True' ? '✓' : '✗';
      }

      const keyEl = document.createElement('div');
      keyEl.className = 'option-key';
      keyEl.textContent = keyDisplay;

      // Option Texts
      const textWrap = document.createElement('div');
      textWrap.className = 'option-text-wrap';

      if (state.langMode === 'en') {
        textWrap.innerHTML = `<span class="option-text-en">${opt.text}</span>`;
      } else if (state.langMode === 'ar') {
        textWrap.innerHTML = `<span class="option-text-ar">${opt.text_ar || opt.text}</span>`;
      } else {
        textWrap.innerHTML = `
          <span class="option-text-en">${opt.text}</span>
          ${opt.text_ar ? `<span class="option-text-ar">${opt.text_ar}</span>` : ''}
        `;
      }

      optEl.appendChild(keyEl);
      optEl.appendChild(textWrap);

      // Click handler
      optEl.addEventListener('click', () => handleOptionSelect(q, opt.key));

      DOM.optionsContainer.appendChild(optEl);
    });

    // Render Explanation Box
    if (isAnswered) {
      DOM.explanationBox.style.display = 'block';
      const isCorrect = userSelected === q.answer;

      if (isCorrect) {
        DOM.expStatusIcon.textContent = '✅';
        DOM.expStatusTitle.textContent = 'إجابة صحيحة! أحسنت.';
      } else {
        DOM.expStatusIcon.textContent = '❌';
        DOM.expStatusTitle.innerHTML = `إجابة خاطئة. الإجابة الصحيحة هي: (${q.answer.toUpperCase()}) ${q.answer_text_ar || q.answer_text}`;
      }

      DOM.expTextAr.innerHTML = q.explanation_ar || q.explanation;
      DOM.expTextEn.innerHTML = q.explanation || 'No English explanation provided.';

      if (q.reference) {
        DOM.expReferenceWrap.style.display = 'flex';
        DOM.expReference.textContent = q.reference;
      } else {
        DOM.expReferenceWrap.style.display = 'none';
      }
    } else {
      DOM.explanationBox.style.display = 'none';
    }

    // Navigation buttons state
    DOM.btnPrev.disabled = state.currentIndex === 0;
    DOM.btnNext.disabled = state.currentIndex === list.length - 1;

    // Update active state in grid
    updateActiveGridButton();
  }

  function renderEmptyState() {
    DOM.currentQIndex.textContent = '0';
    DOM.totalQCount.textContent = '0';
    DOM.progressBarFill.style.width = '0%';
    DOM.badgeBank.textContent = 'لا توجد نتائج';
    DOM.badgeType.textContent = '-';
    DOM.qCode.textContent = '∅';
    DOM.qTextEn.textContent = 'No questions match the current filter or search criteria.';
    DOM.qTextAr.textContent = 'لا توجد أسئلة تطابق البحث أو التصفية الحالية.';
    DOM.optionsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">جرّب تغيير خيارات التصفية أو مسح كلمة البحث.</div>';
    DOM.explanationBox.style.display = 'none';
    DOM.btnPrev.disabled = true;
    DOM.btnNext.disabled = true;
  }

  function handleOptionSelect(question, selectedKey) {
    state.userAnswers[question.id] = selectedKey;
    saveToStorage();

    // Play feedback sound
    if (selectedKey === question.answer) {
      playSound('correct');
    } else {
      playSound('wrong');
    }

    updateStats();
    renderGrid();
    renderCurrentQuestion();
  }

  // --- Grid Navigator ---
  function renderGrid() {
    DOM.questionsGrid.innerHTML = '';
    const list = state.filteredQuestions;
    DOM.gridVisibleCount.textContent = list.length.toString();

    list.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'q-grid-btn';
      btn.textContent = (idx + 1).toString();
      btn.dataset.index = idx.toString();

      if (idx === state.currentIndex) {
        btn.classList.add('current');
      }

      const isAnswered = q.id in state.userAnswers;
      const userAns = state.userAnswers[q.id];

      if (isAnswered) {
        if (userAns === q.answer) {
          btn.classList.add('answered');
        } else {
          btn.classList.add('wrong');
        }
      }

      if (state.bookmarks.has(q.id)) {
        btn.classList.add('flagged');
      }

      btn.addEventListener('click', () => {
        playSound('click');
        state.currentIndex = idx;
        renderCurrentQuestion();
        // If on mobile, close sidebar after clicking
        if (window.innerWidth <= 1024) {
          DOM.sidebar.classList.remove('open');
        }
      });

      DOM.questionsGrid.appendChild(btn);
    });
  }

  function updateActiveGridButton() {
    const buttons = DOM.questionsGrid.querySelectorAll('.q-grid-btn');
    buttons.forEach((b, idx) => {
      b.classList.toggle('current', idx === state.currentIndex);
    });
  }

  // --- Statistics Calculation ---
  function updateStats() {
    const all = state.allQuestions;
    let answeredCount = 0;
    let correctCount = 0;
    let mistakesCount = 0;

    all.forEach(q => {
      if (q.id in state.userAnswers) {
        answeredCount++;
        if (state.userAnswers[q.id] === q.answer) {
          correctCount++;
        } else {
          mistakesCount++;
        }
      }
    });

    DOM.statAnswered.textContent = answeredCount.toString();
    DOM.statCorrect.textContent = correctCount.toString();
    const pct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    DOM.statPercentage.textContent = `${pct}%`;

    DOM.countBookmarks.textContent = state.bookmarks.size.toString();
    DOM.countMistakes.textContent = mistakesCount.toString();
  }

  // --- Themes & Font Size ---
  function setTheme(newTheme) {
    state.theme = newTheme;
    DOM.html.setAttribute('data-theme', newTheme);
    saveToStorage();

    const labelMap = {
      dark: { icon: '🌙', name: 'ليلي هادئ' },
      sepia: { icon: '📜', name: 'ورقي دافئ' },
      light: { icon: '☀️', name: 'نهاري ناعم' }
    };
    const info = labelMap[newTheme] || labelMap.dark;
    DOM.themeName.textContent = info.name;
    DOM.themeIcon.textContent = info.icon;

    document.querySelectorAll('.theme-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.setTheme === newTheme);
    });
  }

  function setFontSize(newSize) {
    state.fontSize = newSize;
    DOM.html.setAttribute('data-font-size', newSize);
    saveToStorage();
  }

  function setLanguageMode(newLang) {
    state.langMode = newLang;
    saveToStorage();
    DOM.langBoth.classList.toggle('active', newLang === 'both');
    DOM.langEn.classList.toggle('active', newLang === 'en');
    DOM.langAr.classList.toggle('active', newLang === 'ar');
    renderCurrentQuestion();
  }

  // --- Reset Current Bank Logic ---
  function resetCurrentBank() {
    const list = state.filteredQuestions;
    if (!list || list.length === 0) return;

    let bankTitle = DOM.badgeBank ? DOM.badgeBank.textContent : 'هذا البنك';
    if (state.activeBank === 'all') {
      bankTitle = 'جميع الأسئلة';
    }

    const answeredCount = list.filter(q => q.id in state.userAnswers).length;
    let confirmMsg = `هل تريد إعادة حل (${bankTitle}) من البداية؟`;
    if (answeredCount > 0) {
      confirmMsg = `هل تريد إعادة حل (${bankTitle})؟ سيتم مسح ${answeredCount} إجابة مسجلة والبدء من السؤال الأول.`;
    }

    if (confirm(confirmMsg)) {
      playSound('click');
      list.forEach(q => {
        delete state.userAnswers[q.id];
      });
      state.currentIndex = 0;
      saveToStorage();
      updateStats();
      renderGrid();
      renderCurrentQuestion();
    }
  }

  // --- Setup Event Listeners ---
  function setupEvents() {
    // Reset Bank Buttons
    if (DOM.btnResetBank) {
      DOM.btnResetBank.addEventListener('click', resetCurrentBank);
    }
    if (DOM.btnResetBankSidebar) {
      DOM.btnResetBankSidebar.addEventListener('click', resetCurrentBank);
    }

    // Language buttons
    DOM.langBoth.addEventListener('click', () => setLanguageMode('both'));
    DOM.langEn.addEventListener('click', () => setLanguageMode('en'));
    DOM.langAr.addEventListener('click', () => setLanguageMode('ar'));

    // Font size controls
    const fontSizes = ['sm', 'md', 'lg', 'xl'];
    DOM.btnFontInc.addEventListener('click', () => {
      playSound('click');
      let idx = fontSizes.indexOf(state.fontSize);
      if (idx < fontSizes.length - 1) {
        setFontSize(fontSizes[idx + 1]);
      }
    });
    DOM.btnFontDec.addEventListener('click', () => {
      playSound('click');
      let idx = fontSizes.indexOf(state.fontSize);
      if (idx > 0) {
        setFontSize(fontSizes[idx - 1]);
      }
    });

    // Theme dropdown
    DOM.btnTheme.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.themeDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      DOM.themeDropdown.classList.remove('show');
    });

    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.setTheme;
        setTheme(t);
      });
    });

    // Sound toggle
    DOM.btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
      saveToStorage();
    });

    // Mobile sidebar toggles
    DOM.btnOpenGrid.addEventListener('click', () => {
      DOM.sidebar.classList.add('open');
    });
    DOM.btnCloseGrid.addEventListener('click', () => {
      DOM.sidebar.classList.remove('open');
    });

    // Bank Chips
    DOM.bankChips.forEach(chip => {
      chip.addEventListener('click', () => {
        playSound('click');
        DOM.bankChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeBank = chip.dataset.bank;
        state.specialFilter = null;
        DOM.filterBookmarks.classList.remove('active');
        DOM.filterMistakes.classList.remove('active');
        state.currentIndex = 0;
        applyFilters();
      });
    });

    // Type Pills
    DOM.typePills.forEach(pill => {
      pill.addEventListener('click', () => {
        playSound('click');
        DOM.typePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeType = pill.dataset.type;
        state.currentIndex = 0;
        applyFilters();
      });
    });

    // Special Filters
    DOM.filterBookmarks.addEventListener('click', () => {
      playSound('click');
      if (state.specialFilter === 'bookmarks') {
        state.specialFilter = null;
        DOM.filterBookmarks.classList.remove('active');
      } else {
        state.specialFilter = 'bookmarks';
        DOM.filterBookmarks.classList.add('active');
        DOM.filterMistakes.classList.remove('active');
      }
      state.currentIndex = 0;
      applyFilters();
    });

    DOM.filterMistakes.addEventListener('click', () => {
      playSound('click');
      if (state.specialFilter === 'mistakes') {
        state.specialFilter = null;
        DOM.filterMistakes.classList.remove('active');
      } else {
        state.specialFilter = 'mistakes';
        DOM.filterMistakes.classList.add('active');
        DOM.filterBookmarks.classList.remove('active');
      }
      state.currentIndex = 0;
      applyFilters();
    });

    // Search input
    DOM.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      DOM.searchClear.style.display = state.searchQuery ? 'block' : 'none';
      state.currentIndex = 0;
      applyFilters();
    });

    DOM.searchClear.addEventListener('click', () => {
      DOM.searchInput.value = '';
      state.searchQuery = '';
      DOM.searchClear.style.display = 'none';
      state.currentIndex = 0;
      applyFilters();
    });

    // Flag / Bookmark Button
    DOM.btnFlag.addEventListener('click', () => {
      const q = state.filteredQuestions[state.currentIndex];
      if (!q) return;
      if (state.bookmarks.has(q.id)) {
        state.bookmarks.delete(q.id);
      } else {
        state.bookmarks.add(q.id);
      }
      playSound('click');
      saveToStorage();
      updateStats();
      renderGrid();
      renderCurrentQuestion();
    });

    // Navigation Buttons
    DOM.btnPrev.addEventListener('click', () => {
      if (state.currentIndex > 0) {
        playSound('click');
        state.currentIndex--;
        renderCurrentQuestion();
      }
    });

    DOM.btnNext.addEventListener('click', () => {
      if (state.currentIndex < state.filteredQuestions.length - 1) {
        playSound('click');
        state.currentIndex++;
        renderCurrentQuestion();
      }
    });

    // Explanation tabs
    DOM.tabExpAr.addEventListener('click', () => {
      DOM.tabExpAr.classList.add('active');
      DOM.tabExpEn.classList.remove('active');
      DOM.expContentAr.style.display = 'block';
      DOM.expContentEn.style.display = 'none';
    });

    DOM.tabExpEn.addEventListener('click', () => {
      DOM.tabExpEn.classList.add('active');
      DOM.tabExpAr.classList.remove('active');
      DOM.expContentEn.style.display = 'block';
      DOM.expContentAr.style.display = 'none';
    });

    // Reset Progress (All Questions)
    DOM.btnResetAll.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من رغبتك في مسح جميع الإجابات المسجلة لجميع الأسئلة والبدء من جديد؟')) {
        state.userAnswers = {};
        state.bookmarks.clear();
        saveToStorage();
        updateStats();
        applyFilters();
        playSound('click');
      }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ignore if typing inside input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+B or Alt+B for bookmark
      if ((e.ctrlKey || e.altKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        DOM.btnFlag.click();
        return;
      }

      // Ignore other modified combinations (e.g. Ctrl+C, Ctrl+R, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const q = state.filteredQuestions[state.currentIndex];

      if (e.key === 'ArrowRight') {
        // Next Question
        if (state.currentIndex < state.filteredQuestions.length - 1) {
          state.currentIndex++;
          renderCurrentQuestion();
        }
      } else if (e.key === 'ArrowLeft') {
        // Previous Question
        if (state.currentIndex > 0) {
          state.currentIndex--;
          renderCurrentQuestion();
        }
      } else if (e.key === 's' || e.key === 'S' || e.key === 'س' || e.key === 'm' || e.key === 'M' || e.key === 'ة') {
        // 'S' for Save / حفظ
        DOM.btnFlag.click();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'ق') {
        // 'R' for Reset Bank / إعادة حل البنك
        resetCurrentBank();
      } else if (q) {
        if (q.type === 'mcq') {
          const map = {
            '1': 'a', 'a': 'a', 'A': 'a', 'ش': 'a',
            '2': 'b', 'b': 'b', 'B': 'b', 'لا': 'b',
            '3': 'c', 'c': 'c', 'C': 'c', 'ؤ': 'c',
            '4': 'd', 'd': 'd', 'D': 'd', 'ي': 'd'
          };
          if (map[e.key]) {
            handleOptionSelect(q, map[e.key]);
          }
        } else if (q.type === 'tf') {
          if (e.key === '1' || e.key === 't' || e.key === 'T' || e.key === 'ف') {
            handleOptionSelect(q, 'True');
          } else if (e.key === '2' || e.key === 'f' || e.key === 'F' || e.key === 'ب') {
            handleOptionSelect(q, 'False');
          }
        }
      }
    });
  }

  // --- Initialize App ---
  function init() {
    loadFromStorage();
    setTheme(state.theme);
    setFontSize(state.fontSize);
    setLanguageMode(state.langMode);
    DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';

    setupEvents();
    applyFilters();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
