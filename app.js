(function () {
  "use strict";

  const STORAGE_KEY = "geosled.game.v1";
  const ROUND_COUNT = 10;

  const REGION_CONFIG = {
    all: { label: "Весь мир", center: [18, 8], desktopZoom: 1.7, mobileZoom: 0.75 },
    europe: {
      label: "Европа",
      center: [18, 8],
      mobileCenter: [52, 14],
      desktopZoom: 1.7,
      mobileZoom: 2.45,
    },
    asia: { label: "Азия", center: [38, 91], desktopZoom: 2.05, mobileZoom: 1.55 },
    africa: { label: "Африка", center: [2, 20], desktopZoom: 2.55, mobileZoom: 2.05 },
    "north-america": {
      label: "Северная Америка",
      center: [40, -102],
      desktopZoom: 2.05,
      mobileZoom: 1.55,
    },
    "south-america": {
      label: "Южная Америка",
      center: [-20, -61],
      desktopZoom: 2.55,
      mobileZoom: 2.05,
    },
    oceania: { label: "Океания", center: [-17, 151], desktopZoom: 2, mobileZoom: 1.45 },
  };

  const COLORS = {
    ink: "#0b2d5f",
    border: "#596974",
    land: "#f0dcae",
    landMuted: "#e7dcc5",
    hover: "#f4c781",
    selected: "#ef6b55",
    selectedBorder: "#9d3f36",
    correct: "#4b9466",
    correctBorder: "#2e6f49",
    error: "#bc4a46",
    water: "#abd7e9",
  };

  const elements = {
    game: document.querySelector("#game"),
    challengePanel: document.querySelector(".challenge-panel"),
    mapPanel: document.querySelector(".map-panel"),
    keyboardNote: document.querySelector(".keyboard-note"),
    countryName: document.querySelector("#country-name"),
    answerForm: document.querySelector("#answer-form"),
    capitalInput: document.querySelector("#capital-input"),
    countrySelect: document.querySelector("#country-select"),
    countryFallback: document.querySelector("#country-fallback"),
    checkButton: document.querySelector("#check-button"),
    skipButton: document.querySelector("#skip-button"),
    feedback: document.querySelector("#answer-feedback"),
    score: document.querySelector("#score-value"),
    streak: document.querySelector("#streak-value"),
    round: document.querySelector("#round-value"),
    progressTrack: document.querySelector(".progress-track"),
    progressFill: document.querySelector("#progress-fill"),
    mobileRound: document.querySelector(".mobile-round"),
    mobileRoundValue: document.querySelector("#mobile-round-value"),
    mobileStats: document.querySelector("#mobile-stats"),
    mobileProgress: document.querySelector("#mobile-progress"),
    mapSelectionStatus: document.querySelector("#map-selection-status"),
    newGameButton: document.querySelector("#new-game-button"),
    regionButtons: [...document.querySelectorAll(".region-tab")],
    mapLoading: document.querySelector("#map-loading"),
    resultsDialog: document.querySelector("#results-dialog"),
    dialogClose: document.querySelector("#dialog-close"),
    resultsLead: document.querySelector("#results-lead"),
    resultScore: document.querySelector("#result-score"),
    resultMap: document.querySelector("#result-map"),
    resultCapitals: document.querySelector("#result-capitals"),
    resultStreak: document.querySelector("#result-streak"),
    mistakesSection: document.querySelector("#mistakes-section"),
    mistakesList: document.querySelector("#mistakes-list"),
    playAgainButton: document.querySelector("#play-again-button"),
    chooseRegionButton: document.querySelector("#choose-region-button"),
  };

  let dataset;
  let countries = [];
  let countryByIso3 = new Map();
  let countryByNumeric = new Map();
  let map;
  let featureCollection;
  let ready = false;
  let resizeTimer;

  const mapLayersByIso3 = new Map();

  let state = createEmptyState("europe");

  function createEmptyState(regionId) {
    return {
      datasetVersion: null,
      regionId,
      deck: [],
      roundIndex: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      selectedIso3: null,
      selectionSource: null,
      capitalInput: "",
      attemptCount: 0,
      mapLocked: false,
      capitalLocked: false,
      mapErrorVisible: false,
      capitalErrorVisible: false,
      roundComplete: false,
      firstMapCorrect: false,
      firstCapitalCorrect: false,
      feedback: null,
      results: [],
    };
  }

  function currentTarget() {
    return countryByIso3.get(state.deck[state.roundIndex]);
  }

  function countriesForRegion(regionId) {
    return countries.filter(
      (country) =>
        country.quizEligible &&
        (regionId === "all" || country.regionIds.includes(regionId)),
    );
  }

  function normalizeNumericId(id) {
    if (id === null || id === undefined || id === "") return null;
    const value = String(id);
    return /^\d+$/.test(value) ? value.padStart(3, "0") : value;
  }

  function unwrapRingAtDateLine(ring) {
    if (!Array.isArray(ring) || ring.length === 0) return ring;
    let previousLongitude = ring[0][0];
    let offset = 0;
    return ring.map((coordinate, index) => {
      if (index === 0) return [...coordinate];
      let longitude = coordinate[0] + offset;
      while (longitude - previousLongitude > 180) {
        offset -= 360;
        longitude -= 360;
      }
      while (longitude - previousLongitude < -180) {
        offset += 360;
        longitude += 360;
      }
      previousLongitude = longitude;
      return [longitude, coordinate[1], ...coordinate.slice(2)];
    });
  }

  function unwrapFeatureCollectionAtDateLine(collection) {
    for (const feature of collection.features) {
      if (feature.geometry?.type === "Polygon") {
        feature.geometry.coordinates = feature.geometry.coordinates.map(unwrapRingAtDateLine);
      }
      if (feature.geometry?.type === "MultiPolygon") {
        feature.geometry.coordinates = feature.geometry.coordinates.map((polygon) =>
          polygon.map(unwrapRingAtDateLine),
        );
      }
    }
    return collection;
  }

  function normalizeAnswer(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("ru-RU")
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function sentenceCase(value) {
    if (!value) return "";
    return value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
  }

  function countryCountLabel(count) {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return `${count} стран`;
    if (last === 1) return `${count} страна`;
    if (last >= 2 && last <= 4) return `${count} страны`;
    return `${count} стран`;
  }

  function isCapitalCorrect(country, answer) {
    const normalized = normalizeAnswer(answer);
    return country.capital.accepted.some(
      (candidate) => normalizeAnswer(candidate) === normalized,
    );
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  function createDeck(regionId, preferredFirstIso3) {
    const pool = shuffle(countriesForRegion(regionId));
    const deck = pool.slice(0, Math.min(ROUND_COUNT, pool.length)).map((country) => country.iso3);
    if (preferredFirstIso3 && deck.includes(preferredFirstIso3)) {
      const index = deck.indexOf(preferredFirstIso3);
      [deck[0], deck[index]] = [deck[index], deck[0]];
    } else if (preferredFirstIso3) {
      const preferred = pool.find((country) => country.iso3 === preferredFirstIso3);
      if (preferred) {
        deck.pop();
        deck.unshift(preferred.iso3);
      }
    }
    return deck;
  }

  function saveState() {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // The game remains fully usable when browser storage is blocked.
    }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      const regionExists = Boolean(REGION_CONFIG[saved.regionId]);
      const deckIsValid =
        Array.isArray(saved.deck) &&
        saved.deck.length > 0 &&
        saved.deck.every((iso3) => countryByIso3.has(iso3));
      const roundIsValid =
        Number.isInteger(saved.roundIndex) &&
        saved.roundIndex >= 0 &&
        saved.roundIndex < saved.deck.length;
      if (
        saved.datasetVersion !== dataset.datasetVersion ||
        !regionExists ||
        !deckIsValid ||
        !roundIsValid
      ) {
        return false;
      }

      state = {
        ...createEmptyState(saved.regionId),
        ...saved,
        results: Array.isArray(saved.results) ? saved.results : [],
      };
      return true;
    } catch (_error) {
      return false;
    }
  }

  function newGame(regionId = state.regionId, options = {}) {
    if (!ready) return;
    const preferredFirstIso3 = options.preferredFirstIso3 || null;
    state = {
      ...createEmptyState(regionId),
      datasetVersion: dataset.datasetVersion,
      deck: createDeck(regionId, preferredFirstIso3),
    };
    closeResults();
    setFeedback(null, null, null);
    renderAll();
    fitRegion(regionId, options.animate !== false);
    saveState();
    if (options.focus) {
      bringQuestionIntoView();
    }
  }

  function resetRoundState() {
    state.selectedIso3 = null;
    state.selectionSource = null;
    state.capitalInput = "";
    state.attemptCount = 0;
    state.mapLocked = false;
    state.capitalLocked = false;
    state.mapErrorVisible = false;
    state.capitalErrorVisible = false;
    state.roundComplete = false;
    state.firstMapCorrect = false;
    state.firstCapitalCorrect = false;
  }

  function renderAll() {
    renderRegionUi();
    renderQuestion();
    renderStats();
    renderControls();
    renderCountrySelect();
    renderFeedback();
    renderSelectionStatus();
    updateMapAccessibility();
    applyAllMapStyles();
  }

  function renderRegionUi() {
    for (const button of elements.regionButtons) {
      const regionId = button.dataset.region;
      const active = state.regionId === regionId;
      const count = countriesForRegion(regionId).length;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", `${REGION_CONFIG[regionId].label}: ${countryCountLabel(count)}`);
      button.disabled = !ready;
    }
  }

  function renderQuestion() {
    const target = currentTarget();
    if (!target) return;
    elements.countryName.textContent = target.name.ru;
    elements.countryName.tabIndex = -1;
    elements.countryName.classList.toggle(
      "country-name--medium",
      target.name.ru.length > 13 && target.name.ru.length <= 22,
    );
    elements.countryName.classList.toggle(
      "country-name--long",
      target.name.ru.length > 22,
    );
    elements.capitalInput.value = state.capitalInput;
    renderCountrySelectValue();
  }

  function renderStats() {
    const roundNumber = state.roundIndex + 1;
    const roundTotal = state.deck.length || ROUND_COUNT;
    const progress = (roundNumber / roundTotal) * 100;
    const roundText = `Раунд ${roundNumber} из ${roundTotal}`;

    elements.score.textContent = String(state.score);
    elements.streak.textContent = String(state.streak);
    elements.round.textContent = roundText;
    elements.mobileRoundValue.textContent = roundText;
    elements.mobileStats.textContent = `Счёт ${state.score} · Серия ${state.streak}`;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressTrack.setAttribute("aria-valuemax", String(roundTotal));
    elements.progressTrack.setAttribute("aria-valuenow", String(roundNumber));
    elements.mobileProgress.setAttribute("aria-valuemax", String(roundTotal));
    elements.mobileProgress.setAttribute("aria-valuenow", String(roundNumber));
    elements.mobileProgress.textContent = `${roundNumber} из ${roundTotal}`;
    elements.mobileRound.style.setProperty("--mobile-progress", `${progress}%`);
  }

  function renderControls() {
    const waitingForAnswer = !state.roundComplete;
    const hasMapAnswer = Boolean(state.selectedIso3) || state.mapLocked;
    const hasCapitalAnswer = Boolean(state.capitalInput.trim()) || state.capitalLocked;

    elements.capitalInput.disabled = !ready || state.capitalLocked || state.roundComplete;
    elements.countrySelect.disabled = !ready || state.mapLocked || state.roundComplete;
    elements.skipButton.disabled = !ready || state.roundComplete;
    elements.checkButton.disabled =
      !ready || (waitingForAnswer && (!hasMapAnswer || !hasCapitalAnswer));

    elements.capitalInput.classList.toggle("is-correct", state.capitalLocked);
    elements.capitalInput.classList.toggle("is-error", state.capitalErrorVisible);
    elements.capitalInput.setAttribute("aria-invalid", String(state.capitalErrorVisible));
    elements.newGameButton.disabled = !ready;

    if (state.roundComplete) {
      elements.checkButton.textContent =
        state.roundIndex === state.deck.length - 1
          ? "Посмотреть результат"
          : "Следующая страна";
    } else {
      elements.checkButton.textContent = "Проверить ответ";
    }
  }

  function renderCountrySelect() {
    const fragment = document.createDocumentFragment();
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.disabled = true;
    emptyOption.textContent = "Страна не выбрана";
    fragment.append(emptyOption);

    for (const country of countriesForRegion(state.regionId)) {
      const option = document.createElement("option");
      option.value = country.iso3;
      option.textContent = country.name.ru;
      fragment.append(option);
    }

    elements.countrySelect.replaceChildren(fragment);
    renderCountrySelectValue();
  }

  function renderCountrySelectValue() {
    // The list must not identify a country picked on the unlabelled map,
    // including selections restored from older saved games.
    const pickedFromList = state.selectionSource === "list";
    elements.countrySelect.value = pickedFromList ? state.selectedIso3 || "" : "";
    elements.countrySelect.options[0].textContent = state.selectedIso3 && !pickedFromList
      ? "Страна выбрана на карте"
      : "Страна не выбрана";
  }

  function setFeedback(tone, title, body) {
    state.feedback = title || body ? { tone, title, body } : null;
    renderFeedback();
  }

  function renderFeedback() {
    elements.feedback.replaceChildren();
    elements.feedback.removeAttribute("data-tone");
    const { tone, title, body } = state.feedback || {};
    if (!title && !body) return;

    elements.feedback.dataset.tone = ["success", "error", "info"].includes(tone)
      ? tone
      : "info";

    const icon = document.createElement("span");
    icon.className = "feedback-icon";
    icon.setAttribute("aria-hidden", "true");
    const paths = {
      success: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 9"></path>',
      error: '<circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6M15 9l-6 6"></path>',
      info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
    };
    icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${paths[tone] || paths.info}</svg>`;

    const copy = document.createElement("span");
    copy.className = "feedback-copy";
    if (title) {
      const strong = document.createElement("strong");
      strong.textContent = title;
      copy.append(strong);
    }
    if (body) {
      const text = document.createElement("span");
      text.textContent = body;
      copy.append(text);
    }
    elements.feedback.append(icon, copy);
  }

  function renderSelectionStatus() {
    const target = currentTarget();
    if (state.roundComplete && target) {
      elements.mapSelectionStatus.classList.remove("visually-hidden");
      elements.mapSelectionStatus.textContent = `Правильный ответ на карте: ${target.name.ru}.`;
      return;
    }
    const selected = countryByIso3.get(state.selectedIso3);
    elements.mapSelectionStatus.classList.toggle("visually-hidden", Boolean(selected));
    elements.mapSelectionStatus.textContent = selected
      ? "Страна выбрана на карте."
      : "Страна на карте пока не выбрана.";
  }

  function selectCountry(iso3, source = "map") {
    if (!ready || state.roundComplete || state.mapLocked || !countryByIso3.has(iso3)) return;
    const country = countryByIso3.get(iso3);
    if (state.regionId !== "all" && !country.regionIds.includes(state.regionId)) return;

    state.selectedIso3 = iso3;
    state.selectionSource = source;
    state.mapErrorVisible = false;
    renderCountrySelectValue();
    applyAllMapStyles();
    renderControls();
    renderSelectionStatus();
    saveState();
  }

  function checkAnswer() {
    if (state.roundComplete) {
      if (state.roundIndex === state.deck.length - 1) {
        showResults();
      } else {
        advanceRound();
      }
      return;
    }

    const target = currentTarget();
    const mapCorrect = state.selectedIso3 === target.iso3;
    const capitalCorrect = isCapitalCorrect(target, state.capitalInput);

    if (state.attemptCount === 0) {
      state.firstMapCorrect = mapCorrect;
      state.firstCapitalCorrect = capitalCorrect;
      if (mapCorrect) state.score += 1;
      if (capitalCorrect) state.score += 1;
      if (mapCorrect && capitalCorrect) {
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
      } else {
        state.streak = 0;
      }

      state.mapLocked = mapCorrect;
      state.capitalLocked = capitalCorrect;

      if (mapCorrect && capitalCorrect) {
        completeRound({ mapCorrect, capitalCorrect, skipped: false });
        return;
      }

      state.attemptCount = 1;
      state.mapErrorVisible = !mapCorrect;
      state.capitalErrorVisible = !capitalCorrect;

      const issues = [];
      if (!mapCorrect) issues.push("на карте выбрана другая страна");
      if (!capitalCorrect) issues.push("столица указана неверно");
      const fixed = [];
      if (mapCorrect) fixed.push("страна найдена");
      if (capitalCorrect) fixed.push("столица названа");

      setFeedback(
        "error",
        "Почти получилось",
        `${fixed.length ? `${sentenceCase(fixed.join(" и "))}. ` : ""}${sentenceCase(issues.join(" и "))}. Исправьте ответ и проверьте ещё раз.`,
      );
      renderAll();
      saveState();
      if (!capitalCorrect) {
        elements.capitalInput.focus();
      } else {
        elements.countryFallback.open = true;
        elements.countrySelect.focus();
      }
      return;
    }

    state.mapLocked = mapCorrect;
    state.capitalLocked = capitalCorrect;
    completeRound({ mapCorrect, capitalCorrect, skipped: false });
  }

  function completeRound({ mapCorrect, capitalCorrect, skipped }) {
    const target = currentTarget();
    state.roundComplete = true;
    state.mapErrorVisible = Boolean(state.selectedIso3 && !mapCorrect && !skipped);
    state.capitalErrorVisible = Boolean(state.capitalInput && !capitalCorrect && !skipped);

    if (!state.results.some((result) => result.roundIndex === state.roundIndex)) {
      state.results.push({
        roundIndex: state.roundIndex,
        iso3: target.iso3,
        selectedIso3: state.selectedIso3,
        enteredCapital: state.capitalInput,
        mapFirst: state.firstMapCorrect,
        capitalFirst: state.firstCapitalCorrect,
        skipped,
      });
    }

    if (skipped) {
      setFeedback(
        "info",
        `${target.name.ru} — ${target.capital.displayRu}`,
        target.capital.note || "Ответ открыт. Его можно встретить в следующей игре.",
      );
    } else if (state.firstMapCorrect && state.firstCapitalCorrect) {
      setFeedback(
        "success",
        "Верно — два очка!",
        `${target.name.ru} — ${target.capital.displayRu}.${target.capital.note ? ` ${target.capital.note}` : ""}`,
      );
    } else {
      const correctParts = [];
      if (mapCorrect) correctParts.push("страна теперь найдена");
      if (capitalCorrect) correctParts.push("столица теперь названа");
      setFeedback(
        "info",
        `${target.name.ru} — ${target.capital.displayRu}`,
        `${correctParts.length ? `${sentenceCase(correctParts.join(" и "))}. ` : ""}${target.capital.note || "Запомните пару и переходите дальше."}`,
      );
    }

    renderAll();
    saveState();
    elements.feedback.focus({ preventScroll: true });
  }

  function skipRound() {
    if (!ready || state.roundComplete) return;
    state.streak = 0;
    completeRound({ mapCorrect: false, capitalCorrect: false, skipped: true });
  }

  function advanceRound() {
    if (state.roundIndex >= state.deck.length - 1) {
      showResults();
      return;
    }
    state.roundIndex += 1;
    resetRoundState();
    setFeedback(null, null, null);
    renderAll();
    saveState();
    bringQuestionIntoView();
  }

  function bringQuestionIntoView() {
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (mobile) {
      elements.countryName.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
    elements.countryName.focus({ preventScroll: true });
  }

  function showResults() {
    const total = state.results.length || state.deck.length;
    const mapCorrect = state.results.filter((result) => result.mapFirst).length;
    const capitalsCorrect = state.results.filter((result) => result.capitalFirst).length;
    const maxScore = total * 2;
    const mapPercent = total ? Math.round((mapCorrect / total) * 100) : 0;
    const capitalsPercent = total ? Math.round((capitalsCorrect / total) * 100) : 0;

    elements.resultScore.textContent = `${state.score}/${maxScore}`;
    elements.resultMap.textContent = `${mapPercent}%`;
    elements.resultCapitals.textContent = `${capitalsPercent}%`;
    elements.resultStreak.textContent = String(state.bestStreak);

    if (state.score >= Math.ceil(maxScore * 0.85)) {
      elements.resultsLead.textContent = "Отличная навигация: вы уверенно знаете и карту, и столицы.";
    } else if (state.score >= Math.ceil(maxScore * 0.55)) {
      elements.resultsLead.textContent = "Хороший маршрут. Ещё один круг — и сложные точки закрепятся.";
    } else {
      elements.resultsLead.textContent = "Начало положено. Повторите регион — знакомые страны выпадут снова.";
    }

    const mistakes = state.results.filter((result) => !result.mapFirst || !result.capitalFirst);
    elements.mistakesList.replaceChildren();
    for (const result of mistakes) {
      const country = countryByIso3.get(result.iso3);
      const item = document.createElement("li");
      const name = document.createElement("strong");
      const capital = document.createElement("span");
      name.textContent = country.name.ru;
      capital.textContent = country.capital.displayRu;
      item.append(name, capital);
      elements.mistakesList.append(item);
    }
    elements.mistakesSection.hidden = mistakes.length === 0;

    if (typeof elements.resultsDialog.showModal === "function") {
      if (!elements.resultsDialog.open) elements.resultsDialog.showModal();
    } else {
      elements.resultsDialog.setAttribute("open", "");
    }
  }

  function closeResults() {
    if (!elements.resultsDialog.open) return;
    if (typeof elements.resultsDialog.close === "function") {
      elements.resultsDialog.close();
    } else {
      elements.resultsDialog.removeAttribute("open");
    }
  }

  function regionIsActiveForCountry(country) {
    return state.regionId === "all" || country.regionIds.includes(state.regionId);
  }

  function visualStateForCountry(iso3) {
    const target = currentTarget();
    if (state.roundComplete && target?.iso3 === iso3) return "correct";
    if (state.selectedIso3 === iso3) {
      if (state.mapErrorVisible) return "error";
      return "selected";
    }
    return "default";
  }

  function shapeStyle(country, visualState = "default", hovered = false) {
    const base = {
      color: COLORS.border,
      weight: 0.75,
      opacity: 0.9,
      fillColor: COLORS.land,
      fillOpacity: 0.95,
    };

    if (hovered && visualState === "default" && !state.roundComplete) {
      return { ...base, fillColor: COLORS.hover, fillOpacity: 1, weight: 1.15 };
    }
    if (visualState === "selected") {
      return {
        ...base,
        color: COLORS.selectedBorder,
        fillColor: COLORS.selected,
        fillOpacity: 1,
        weight: 1.35,
      };
    }
    if (visualState === "correct") {
      return {
        ...base,
        color: COLORS.correctBorder,
        fillColor: COLORS.correct,
        fillOpacity: 1,
        weight: 1.5,
      };
    }
    if (visualState === "error") {
      return {
        ...base,
        color: "#7b2c2a",
        fillColor: COLORS.error,
        fillOpacity: 0.94,
        weight: 1.4,
      };
    }
    return base;
  }

  function dotStyle(country, visualState = "default", hovered = false) {
    const shape = shapeStyle(country, visualState, hovered);
    return {
      color: shape.color,
      weight: 1.1,
      opacity: shape.opacity,
      fillColor: shape.fillColor,
      fillOpacity: shape.fillOpacity,
      radius: hovered ? 4.5 : 2.7,
    };
  }

  function registerMapLayer(iso3, layer, type) {
    const layers = mapLayersByIso3.get(iso3) || [];
    layers.push({ layer, type });
    mapLayersByIso3.set(iso3, layers);
  }

  function applyCountryStyle(iso3, hovered = false) {
    const country = countryByIso3.get(iso3);
    const layers = mapLayersByIso3.get(iso3) || [];
    if (!country) return;
    const visualState = visualStateForCountry(iso3);

    for (const entry of layers) {
      if (entry.type === "shape") {
        entry.layer.setStyle(shapeStyle(country, visualState, hovered));
      } else if (entry.type === "dot") {
        entry.layer.setStyle(dotStyle(country, visualState, hovered));
        entry.layer.setRadius(hovered ? 4.5 : 2.7);
      }
      if ((visualState === "selected" || visualState === "correct") && entry.layer.bringToFront) {
        entry.layer.bringToFront();
      }
    }
  }

  function applyAllMapStyles() {
    for (const iso3 of mapLayersByIso3.keys()) {
      applyCountryStyle(iso3, false);
    }
  }

  function attachPathAccessibility(layer, country) {
    const path = layer.getElement?.();
    if (!path || path.dataset.geosledReady) return;
    path.dataset.geosledReady = "true";
    path.dataset.countryIso3 = country.iso3;
    path.setAttribute("aria-hidden", "true");
    path.setAttribute("focusable", "false");
    path.tabIndex = -1;
    path.addEventListener("click", () => selectCountry(country.iso3));
  }

  function updateMapAccessibility() {
    for (const [iso3, entries] of mapLayersByIso3) {
      const country = countryByIso3.get(iso3);
      if (!country) continue;
      const available = regionIsActiveForCountry(country) && !state.roundComplete && !state.mapLocked;
      for (const entry of entries) {
        if (entry.type === "dot") continue;
        const path = entry.layer.getElement?.();
        if (!path) continue;
        path.tabIndex = -1;
        path.setAttribute("aria-hidden", "true");
        path.style.cursor = available ? "pointer" : "default";
      }
    }
  }

  function bindCountryInteractions(layer, country) {
    registerMapLayer(country.iso3, layer, "shape");
    layer.on({
      click: () => selectCountry(country.iso3),
      mouseover: () => {
        if (!state.roundComplete && !state.mapLocked && regionIsActiveForCountry(country)) {
          applyCountryStyle(country.iso3, true);
        }
      },
      mouseout: () => applyCountryStyle(country.iso3, false),
      add: () => requestAnimationFrame(() => attachPathAccessibility(layer, country)),
    });
  }

  function addMicrostateTargets() {
    for (const country of countries.filter((item) => item.hitPoint)) {
      const [latitude, longitude] = country.hitPoint;
      const displayLongitude =
        country.regionIds.includes("oceania") && longitude < -150
          ? longitude + 360
          : longitude;
      const displayPoint = [latitude, displayLongitude];
      const hitLayer = window.L.circleMarker(displayPoint, {
        pane: "countryHitPane",
        radius: Math.max(country.hitRadiusPx || 0, 14),
        stroke: true,
        color: COLORS.water,
        weight: 1,
        opacity: 0,
        fillColor: COLORS.water,
        fillOpacity: 0,
        className: "country-hit",
        interactive: true,
      }).addTo(map);
      const dotLayer = window.L.circleMarker(displayPoint, {
        pane: "countryDotPane",
        radius: 2.7,
        stroke: true,
        color: COLORS.border,
        weight: 1.1,
        opacity: 0.9,
        fillColor: COLORS.land,
        fillOpacity: 1,
        className: "country-dot",
        interactive: false,
      }).addTo(map);

      registerMapLayer(country.iso3, hitLayer, "hit");
      registerMapLayer(country.iso3, dotLayer, "dot");
      hitLayer.on({
        click: () => selectCountry(country.iso3),
        mouseover: () => {
          if (!state.roundComplete && !state.mapLocked && regionIsActiveForCountry(country)) {
            applyCountryStyle(country.iso3, true);
          }
        },
        mouseout: () => applyCountryStyle(country.iso3, false),
        add: () => requestAnimationFrame(() => attachPathAccessibility(hitLayer, country)),
      });
      requestAnimationFrame(() => attachPathAccessibility(hitLayer, country));
    }
  }

  function addResetControl() {
    const ResetControl = window.L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const container = window.L.DomUtil.create("div", "leaflet-control reset-control");
        const button = window.L.DomUtil.create("button", "", container);
        button.type = "button";
        button.title = "Сбросить масштаб карты";
        button.setAttribute("aria-label", "Сбросить масштаб карты");
        button.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 15v5h-5M5.4 6.7A8 8 0 0 1 19 10M18.6 17.3A8 8 0 0 1 5 14"/></svg>';
        window.L.DomEvent.disableClickPropagation(container);
        window.L.DomEvent.on(button, "click", () => fitRegion(state.regionId, true));
        return container;
      },
    });
    map.addControl(new ResetControl());
  }

  function buildMap(topology) {
    if (!window.L || !window.topojson) {
      throw new Error("Map libraries failed to load");
    }

    featureCollection = unwrapFeatureCollectionAtDateLine(
      window.topojson.feature(topology, topology.objects.countries),
    );
    featureCollection.features = featureCollection.features.filter(
      (feature) => normalizeNumericId(feature.id) !== "010",
    );
    const geometryIds = new Set(
      featureCollection.features.map((feature) => normalizeNumericId(feature.id)).filter(Boolean),
    );
    const unreachable = countries.filter(
      (country) => !geometryIds.has(country.numeric) && !country.hitPoint,
    );
    if (unreachable.length > 0) {
      throw new Error(`Countries without a map target: ${unreachable.map((country) => country.iso3).join(", ")}`);
    }

    map = window.L.map("map", {
      center: REGION_CONFIG.europe.center,
      zoom: REGION_CONFIG.europe.desktopZoom,
      minZoom: 0.5,
      maxZoom: 7,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      zoomControl: false,
      attributionControl: false,
      keyboard: false,
      preferCanvas: false,
      maxBounds: [
        [-85, -220],
        [85, 220],
      ],
      maxBoundsViscosity: 0.7,
    });

    map.createPane("countryPane");
    map.getPane("countryPane").style.zIndex = "410";
    map.createPane("countryHitPane");
    map.getPane("countryHitPane").style.zIndex = "430";
    map.createPane("countryDotPane");
    map.getPane("countryDotPane").style.zIndex = "440";

    window.L.control.zoom({
      position: "topright",
      zoomInTitle: "Увеличить масштаб",
      zoomOutTitle: "Уменьшить масштаб",
    }).addTo(map);
    addResetControl();

    window.L.geoJSON(featureCollection, {
      pane: "countryPane",
      style(feature) {
        const numeric = normalizeNumericId(feature.id);
        const country = countryByNumeric.get(numeric);
        if (!country) {
          return {
            color: "#7d888c",
            weight: 0.55,
            opacity: 0.58,
            fillColor: COLORS.landMuted,
            fillOpacity: 0.72,
            interactive: false,
          };
        }
        return shapeStyle(country);
      },
      onEachFeature(feature, layer) {
        const numeric = normalizeNumericId(feature.id);
        const country = countryByNumeric.get(numeric);
        if (country) bindCountryInteractions(layer, country);
      },
    }).addTo(map);

    addMicrostateTargets();
    syncMapInteractionForViewport();
  }

  function syncMapInteractionForViewport() {
    if (!map) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    map.dragging?.enable();
    map.touchZoom?.enable();
    if (mobile) {
      map.doubleClickZoom?.disable();
      map.scrollWheelZoom?.disable();
    } else {
      map.doubleClickZoom?.enable();
      map.scrollWheelZoom?.enable();
    }
  }

  function syncResponsiveDomOrder() {
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (mobile && elements.answerForm.parentElement !== elements.game) {
      elements.mapPanel.insertAdjacentElement("afterend", elements.answerForm);
      elements.answerForm.insertAdjacentElement("afterend", elements.keyboardNote);
    } else if (!mobile && elements.answerForm.parentElement !== elements.challengePanel) {
      elements.challengePanel.append(elements.answerForm, elements.keyboardNote);
    }
  }

  function fitRegion(regionId, animate) {
    if (!map) return;
    const config = REGION_CONFIG[regionId] || REGION_CONFIG.all;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const zoom = mobile ? config.mobileZoom : config.desktopZoom;
    const center = mobile && config.mobileCenter ? config.mobileCenter : config.center;
    map.setView(center, zoom, {
      animate: animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      duration: 0.45,
    });
  }

  function showLoadError(error) {
    console.error(error);
    elements.mapLoading.classList.add("is-error");
    elements.mapLoading.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "Не удалось загрузить карту. Проверьте соединение и попробуйте ещё раз.";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-error-button";
    button.textContent = "Повторить";
    button.addEventListener("click", () => window.location.reload());
    elements.mapLoading.append(message, button);
    elements.game.setAttribute("aria-busy", "false");
  }

  async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} while loading ${url}`);
    return response.json();
  }

  async function init() {
    try {
      const [countryData, topology] = await Promise.all([
        loadJson("./data/countries.json"),
        loadJson("./data/countries-50m.json"),
      ]);

      dataset = countryData;
      countries = dataset.countries;
      countryByIso3 = new Map(countries.map((country) => [country.iso3, country]));
      countryByNumeric = new Map(countries.map((country) => [country.numeric, country]));

      buildMap(topology);
      ready = true;

      const restored = restoreState();
      if (restored) {
        renderAll();
        fitRegion(state.regionId, false);
      } else {
        newGame("europe", { preferredFirstIso3: "PRT", animate: false });
      }

      elements.capitalInput.disabled = false;
      elements.skipButton.disabled = false;
      renderControls();
      elements.mapLoading.classList.add("is-hidden");
      elements.game.setAttribute("aria-busy", "false");
      requestAnimationFrame(() => map.invalidateSize(false));
    } catch (error) {
      showLoadError(error);
    }
  }

  elements.answerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.checkButton.disabled) checkAnswer();
  });

  elements.capitalInput.addEventListener("input", (event) => {
    state.capitalInput = event.target.value;
    state.capitalErrorVisible = false;
    renderControls();
    saveState();
  });

  elements.countrySelect.addEventListener("change", (event) => {
    if (event.target.value) selectCountry(event.target.value, "list");
  });

  elements.skipButton.addEventListener("click", skipRound);
  elements.newGameButton.addEventListener("click", () =>
    newGame(state.regionId, { animate: true, focus: true }),
  );

  for (const button of elements.regionButtons) {
    button.addEventListener("click", () => {
      const regionId = button.dataset.region;
      button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      newGame(regionId, { animate: true, focus: true });
    });
    button.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const index = elements.regionButtons.indexOf(button);
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % elements.regionButtons.length;
      if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + elements.regionButtons.length) % elements.regionButtons.length;
      }
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = elements.regionButtons.length - 1;
      elements.regionButtons[nextIndex].focus();
    });
  }

  elements.dialogClose.addEventListener("click", closeResults);
  elements.resultsDialog.addEventListener("click", (event) => {
    if (event.target === elements.resultsDialog) closeResults();
  });
  elements.playAgainButton.addEventListener("click", () =>
    newGame(state.regionId, { animate: true, focus: true }),
  );
  elements.chooseRegionButton.addEventListener("click", () => {
    closeResults();
    const activeButton = elements.regionButtons.find(
      (button) => button.dataset.region === state.regionId,
    );
    activeButton?.focus();
    activeButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      syncResponsiveDomOrder();
      if (!map) return;
      syncMapInteractionForViewport();
      map.invalidateSize(false);
      fitRegion(state.regionId, false);
    }, 160);
  });

  elements.newGameButton.disabled = true;
  for (const button of elements.regionButtons) button.disabled = true;
  syncResponsiveDomOrder();
  init();
})();
