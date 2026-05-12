import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "QuickFormatting";
const scriptUrl = import.meta.url;
const extensionFolderPath = scriptUrl.substring(0, scriptUrl.lastIndexOf('/'));

// --- DEFAULTS ---
const defaultSettings = {
    enabled: true, mobileStyle: 'docked', x: '50%', y: '0px', zIndex: 2000, scale: 1.0,
    hiddenButtons: { 'btn_ooc': true, 'btn_code': true },
    
    // --- LAYOUT SETTINGS ---
    groupedWidgets: false, 
    groupLayout: 'flat', 
    quadX: '10%', quadY: '200px', 

    // --- POSITIONS ---
    moodBtnEnabled: true, moodX: '85%', moodY: '0px',
    replyBtnEnabled: true, replyX: '15%', replyY: '0px',
    toolsBtnEnabled: true, 
    spellX: '15%', spellY: '50px',
    undoX: '25%', undoY: '50px',

    // Global Toggle
    useGlobalApi: true,
    debugLogging: false,

    // --- 1. GLOBAL SETTINGS ---
    globalProvider: 'openrouter', globalBase: 'https://openrouter.ai/api/v1', globalKeyOR: '', globalKeyOA: '', globalModel: '',
    globalStream: true, globalContext: 5, globalTokens: 0,
    globalTemp: 1.0, globalFreqPen: 0.0, globalPresPen: 0.0, globalRepPen: 1.0,
    globalTopK: 0, globalTopP: 1.0, globalMinP: 0.0, globalTopA: 0.0, globalSeed: -1,

    // --- 2. SPELLCHECKER ---
    spellProvider: 'openrouter', spellBase: 'https://openrouter.ai/api/v1', spellKeyOR: '', spellKeyOA: '', spellModel: '', 
    spellStream: true, spellContext: 5, spellTokens: 0,
    spellTemp: 0.2, spellFreqPen: 0.0, spellPresPen: 0.0, spellRepPen: 1.0,
    spellTopK: 0, spellTopP: 1.0, spellMinP: 0.0, spellTopA: 0.0, spellSeed: -1,
    spellPrompt: 'You are a text processing engine. Your ONLY task is to correct grammar and spelling in the user\'s input inside <target_text> tags. Return ONLY the corrected string.',

    // --- 3. MOOD ---
    moodProvider: 'openrouter', moodBase: 'https://openrouter.ai/api/v1', moodKeyOR: '', moodKeyOA: '', moodModel: '',
    moodStream: true, moodContext: 5, moodTokens: 0,
    moodTemp: 0.8, moodFreqPen: 0.0, moodPresPen: 0.0, moodRepPen: 1.0,
    moodTopK: 0, moodTopP: 1.0, moodMinP: 0.0, moodTopA: 0.0, moodSeed: -1,
    moodUniversalPrompt: 'You will edit the text sent to match the tone provided:',

    // --- 4. AUTO-REPLY ---
    replyProvider: 'openrouter', replyBase: 'https://openrouter.ai/api/v1', replyKeyOR: '', replyKeyOA: '', replyModel: '',
    replyStream: true, replyContext: 10, replyTokens: 200,
    replyTemp: 0.8, replyFreqPen: 0.5, replyPresPen: 0.0, replyRepPen: 1.1,
    replyTopK: 40, replyTopP: 0.9, replyMinP: 0.0, replyTopA: 0.0, replySeed: -1,
    replyPrompt: 'You are an expert Ghostwriter for a Roleplay. Write the next response for {{user}}. Persona: {{persona}}. STRICT FORMATTING: Use asterisks (*) for actions and double quotes (") for dialogue.',

    // --- 5. UNIVERSAL PERSONA (MANUAL) ---
    customPersona: '', 

    // Mood List
    moods: [
        { id: 'formal', label: 'Formal', icon: 'fa-user-tie', prompt: 'Tone: Formal, eloquent, and polite.' },
        { id: 'angry', label: 'Angry', icon: 'fa-fire', prompt: 'Tone: Aggressive, furious, and short-tempered.' },
        { id: 'flirty', label: 'Flirty', icon: 'fa-heart', prompt: 'Tone: Charming, playful, and romantic.' },
        { id: 'sad', label: 'Sad', icon: 'fa-face-sad-tear', prompt: 'Tone: Melancholic, hopeless, and emotional.' }
    ]
};

const providerDefaultBases = {
    openrouter: 'https://openrouter.ai/api/v1',
    openai: 'https://api.openai.com/v1',
};

const formattingButtons = [
    { id: 'btn_action', label: '*', start: '*', end: '*', title: 'Action' },
    { id: 'btn_quote', label: '"', start: '"', end: '"', title: 'Dialogue' },
    { id: 'btn_ooc', label: '(OOC)', start: '(OOC: ', end: ')', title: 'OOC' },
    { id: 'btn_code', label: '```', start: '```', end: '```', title: 'Thoughts/Code' }
];

let container = null; 
let moodContainer = null;
let replyContainer = null;
let spellContainer = null; 
let undoContainer = null; 
let quadContainer = null; 

let isEditing = false;
let isGenerating = false;
let activeGenerationMode = null;
let abortController = null;
let undoBuffer = null; 
let activeDragEl = null;
let dragStartCoords = { x: 0, y: 0 };
let dragStartPos = { x: 0, y: 0, keyX: 'x', keyY: 'y' }; 
let resizeObserver = null;
let positionListenersBound = false;
let positionFrame = null;

function cloneDefault(value) {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
        return JSON.parse(JSON.stringify(value));
    }
    return value;
}

function mergeDefaults(target, defaults) {
    for (const key in defaults) {
        const value = defaults[key];
        if (typeof target[key] === 'undefined') {
            target[key] = cloneDefault(value);
        } else if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            target[key] &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])
        ) {
            mergeDefaults(target[key], value);
        }
    }
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function schedulePositionUpdate() {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
        positionFrame = null;
        updatePosition();
    });
}

function normalizeIconClass(icon) {
    const classes = String(icon || 'fa-star')
        .trim()
        .split(/\s+/)
        .filter(cls => /^fa[-\w]+$/.test(cls));

    if (!classes.length) classes.push('fa-star');
    if (!classes.some(cls => ['fa-solid', 'fa-regular', 'fa-brands'].includes(cls))) {
        classes.unshift('fa-solid');
    }

    return classes.join(' ');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

// --- INITIALIZATION ---
jQuery(async () => {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $('#extensions_settings').append(settingsHtml);
        const link = document.createElement("link");
        link.href = `${extensionFolderPath}/style.css`;
        link.type = "text/css";
        link.rel = "stylesheet";
        document.head.appendChild(link);
    } catch (e) { console.error(e); }
    loadSettings();
    initSettingsListeners();
    setTimeout(() => { renderUI(); }, 1000);
});

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    mergeDefaults(extension_settings[extensionName], defaultSettings);
    syncSettingsToUI();
}

function updateSetting(key, value) {
    extension_settings[extensionName][key] = value;
    saveSettingsDebounced();
    if (['mobileStyle', 'enabled', 'moodBtnEnabled', 'replyBtnEnabled', 'toolsBtnEnabled', 'useGlobalApi', 'groupedWidgets', 'groupLayout'].includes(key)) {
        renderUI(true);
        if (key === 'useGlobalApi') syncSettingsToUI();
        if (key === 'groupedWidgets') syncSettingsToUI();
    } else {
        updateContainerStyles();
    }
}

function resetPositions() {
    const s = extension_settings[extensionName];
    Object.assign(s, {
        x: '50%', y: '0px',
        moodX: '85%', moodY: '0px',
        replyX: '15%', replyY: '0px',
        spellX: '15%', spellY: '50px',
        undoX: '25%', undoY: '50px',
        quadX: '10%', quadY: '200px',
    });
    saveSettingsDebounced();
    syncSettingsToUI();
    renderUI(true);
}

function updateProvider(prefix, provider) {
    const s = extension_settings[extensionName];
    s[`${prefix}Provider`] = provider;
    s[`${prefix}Base`] = providerDefaultBases[provider] || s[`${prefix}Base`];
    saveSettingsDebounced();
    syncSettingsToUI();
}

// --- SETTINGS SYNC ---
function syncSettingsToUI() {
    const s = extension_settings[extensionName];
    
    $('#qf_global_enabled').prop('checked', s.enabled);
    $('#qf_use_global').prop('checked', s.useGlobalApi);
    $('#qf_mood_enabled').prop('checked', s.moodBtnEnabled);
    $('#qf_reply_enabled').prop('checked', s.replyBtnEnabled);
    $('#qf_tools_enabled').prop('checked', s.toolsBtnEnabled);
    $('#qf_grouped_widgets').prop('checked', s.groupedWidgets);
    $('#qf_group_layout').val(s.groupLayout);
    
    if(s.groupedWidgets) { $('#qf_group_layout_wrapper').show(); } else { $('#qf_group_layout_wrapper').hide(); }
    if (s.useGlobalApi) { $('#qf_section_global_api').show(); $('.qf-specific-api').hide(); } 
    else { $('#qf_section_global_api').hide(); $('.qf-specific-api').show(); }

    // --- SYNC THE NEW PERSONA BOX ---
    $('#qf_custom_persona').val(s.customPersona || '');

    ['global', 'spell', 'mood', 'reply'].forEach(p => {
        $(`#qf_${p}_provider`).val(s[`${p}Provider`]);
        $(`#qf_${p}_base`).val(s[`${p}Base`]);
        const isOA = s[`${p}Provider`] === 'openai';
        $(`#qf_${p}_key`).val(isOA ? s[`${p}KeyOA`] : s[`${p}KeyOR`]);
        $(`#qf_${p}_stream`).prop('checked', s[`${p}Stream`]);
        $(`#qf_${p}_context`).val(s[`${p}Context`]);
        $(`#qf_${p}_tokens`).val(s[`${p}Tokens`]);
        $(`#qf_${p}_seed`).val(s[`${p}Seed`]);
        $(`#qf_${p}_temp`).val(s[`${p}Temp`]);
        $(`#qf_${p}_freq_pen`).val(s[`${p}FreqPen`]);
        $(`#qf_${p}_pres_pen`).val(s[`${p}PresPen`]);
        $(`#qf_${p}_rep_pen`).val(s[`${p}RepPen`]);
        $(`#qf_${p}_top_k`).val(s[`${p}TopK`]);
        $(`#qf_${p}_top_p`).val(s[`${p}TopP`]);
        $(`#qf_${p}_min_p`).val(s[`${p}MinP`]);
        $(`#qf_${p}_top_a`).val(s[`${p}TopA`]);

        const modelSel = $(`#qf_${p}_model`);
        const savedModel = s[`${p}Model`];
        const hasSavedModel = modelSel.find('option').filter(function() { return this.value === savedModel; }).length > 0;
        if (savedModel && !hasSavedModel) {
            modelSel.append(new Option(savedModel, savedModel, true, true));
        }
        modelSel.val(savedModel);
    });

    $('#qf_buttons_list').empty();
    formattingButtons.forEach(btn => {
        $('#qf_buttons_list').append(`
            <label class="checkbox_label">
                <input class="qf-btn-toggle" data-id="${btn.id}" type="checkbox" ${!s.hiddenButtons[btn.id] ? 'checked' : ''} />
                <span>${btn.label} <small>(${btn.title})</small></span>
            </label>
        `);
    });

    $('#qf_spell_prompt').val(s.spellPrompt);
    $('#qf_reply_prompt').val(s.replyPrompt);
    $('#qf_mood_universal').val(s.moodUniversalPrompt);
    $('#qf_mobile_style').val(s.mobileStyle);
    $('#qf_debug_logging').prop('checked', !!s.debugLogging);
    $('#qf_pos_x').val(parseFloat(s.x));
    $('#qf_pos_y').val(parseFloat(s.y));
    $('#qf_z_index').val(s.zIndex); $('#qf_z_index_num').val(s.zIndex);
    $('#qf_ui_scale').val(s.scale);
    renderMoodSettingsList();
}

function initSettingsListeners() {
    const s = extension_settings[extensionName];
    $('#qf_global_enabled').on('change', function() { updateSetting('enabled', $(this).prop('checked')); });
    $('#qf_use_global').on('change', function() { updateSetting('useGlobalApi', $(this).prop('checked')); });
    $('#qf_mood_enabled').on('change', function() { updateSetting('moodBtnEnabled', $(this).prop('checked')); });
    $('#qf_reply_enabled').on('change', function() { updateSetting('replyBtnEnabled', $(this).prop('checked')); });
    $('#qf_tools_enabled').on('change', function() { updateSetting('toolsBtnEnabled', $(this).prop('checked')); });
    $('#qf_grouped_widgets').on('change', function() { updateSetting('groupedWidgets', $(this).prop('checked')); });
    $('#qf_group_layout').on('change', function() { updateSetting('groupLayout', $(this).val()); });
    $('#qf_debug_logging').on('change', function() { updateSetting('debugLogging', $(this).prop('checked')); });

    $(document).on('change', '.qf-btn-toggle', function() {
        const id = $(this).data('id');
        if (!s.hiddenButtons) s.hiddenButtons = {};
        if ($(this).prop('checked')) delete s.hiddenButtons[id]; else s.hiddenButtons[id] = true;
        saveSettingsDebounced(); renderUI(true);
    });

    ['global', 'spell', 'mood', 'reply'].forEach(p => {
        $(`#qf_${p}_provider`).on('change', function() { updateProvider(p, $(this).val()); });
        $(`#qf_${p}_base`).on('change', function() { updateSetting(`${p}Base`, $(this).val()); });
        $(`#qf_${p}_key`).on('change', function() {
            const provider = extension_settings[extensionName][`${p}Provider`];
            if(provider === 'openai') updateSetting(`${p}KeyOA`, $(this).val()); else updateSetting(`${p}KeyOR`, $(this).val());
        });
        $(`#qf_${p}_model`).on('change', function() { updateSetting(`${p}Model`, $(this).val()); });
        $(`#qf_${p}_fetch`).on('click', (e) => { e.preventDefault(); fetchModels(p); });
        $(`#qf_${p}_stream`).on('change', function() { updateSetting(`${p}Stream`, $(this).prop('checked')); });
        $(`#qf_${p}_context`).on('change', function() { updateSetting(`${p}Context`, parseInt($(this).val())); });
        $(`#qf_${p}_tokens`).on('change', function() { updateSetting(`${p}Tokens`, parseInt($(this).val())); });
        $(`#qf_${p}_seed`).on('change', function() { updateSetting(`${p}Seed`, parseInt($(this).val())); });
        $(`#qf_${p}_temp`).on('change', function() { updateSetting(`${p}Temp`, parseFloat($(this).val())); });
        $(`#qf_${p}_freq_pen`).on('change', function() { updateSetting(`${p}FreqPen`, parseFloat($(this).val())); });
        $(`#qf_${p}_pres_pen`).on('change', function() { updateSetting(`${p}PresPen`, parseFloat($(this).val())); });
        $(`#qf_${p}_rep_pen`).on('change', function() { updateSetting(`${p}RepPen`, parseFloat($(this).val())); });
        $(`#qf_${p}_top_k`).on('change', function() { updateSetting(`${p}TopK`, parseInt($(this).val())); });
        $(`#qf_${p}_top_p`).on('change', function() { updateSetting(`${p}TopP`, parseFloat($(this).val())); });
        $(`#qf_${p}_min_p`).on('change', function() { updateSetting(`${p}MinP`, parseFloat($(this).val())); });
        $(`#qf_${p}_top_a`).on('change', function() { updateSetting(`${p}TopA`, parseFloat($(this).val())); });
    });

    $('#qf_spell_prompt').on('change', function() { updateSetting('spellPrompt', $(this).val()); });
    $('#qf_reply_prompt').on('change', function() { updateSetting('replyPrompt', $(this).val()); });
    $('#qf_mood_universal').on('change', function() { updateSetting('moodUniversalPrompt', $(this).val()); });
    
    // --- LISTENER FOR THE NEW PERSONA BOX ---
    $('#qf_custom_persona').on('input', function() { 
        updateSetting('customPersona', $(this).val()); 
    });

    $('#qf_mobile_style').on('change', function() { updateSetting('mobileStyle', $(this).val()); });
    $('#qf_pos_x').on('input', function() { updateSetting('x', $(this).val() + '%'); });
    $('#qf_pos_y').on('input', function() { updateSetting('y', $(this).val() + 'px'); });
    $('#qf_z_index').on('input', function() { const v = $(this).val(); $('#qf_z_index_num').val(v); updateSetting('zIndex', v); });
    $('#qf_z_index_num').on('input', function() { const v = $(this).val(); $('#qf_z_index').val(v); updateSetting('zIndex', v); });
    $('#qf_ui_scale').on('input', function() { updateSetting('scale', $(this).val()); });
    $('#qf_reset_pos').on('click', (e) => { 
        e.preventDefault(); 
        resetPositions();
    });

    $('#qf_add_mood_btn').on('click', function(e) {
        e.preventDefault();
        const label = $('#qf_new_mood_label').val().trim();
        const prompt = $('#qf_new_mood_prompt').val().trim();
        const icon = normalizeIconClass($('#qf_new_mood_icon').val().trim() || 'fa-star');
        if(!label || !prompt) { toastr.warning('Label & Prompt required'); return; }
        s.moods.push({ id: Date.now().toString(), label, icon, prompt });
        saveSettingsDebounced();
        $('#qf_new_mood_label').val(''); $('#qf_new_mood_icon').val(''); $('#qf_new_mood_prompt').val('');
        renderMoodSettingsList(); renderUI();
    });
}

function renderMoodSettingsList() {
    const s = extension_settings[extensionName];
    const list = $('#qf_mood_list'); list.empty();
    s.moods.forEach((mood, index) => {
        const iconClass = normalizeIconClass(mood.icon);
        const label = escapeHtml(mood.label);
        const prompt = escapeHtml(mood.prompt);
        list.append(`
            <div class="qf-mood-item">
                <div class="qf-mood-header">
                    <span><i class="${iconClass}"></i> <b>${label}</b></span>
                    <button class="menu_button qf-del-mood" data-idx="${index}"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="qf-mood-prompt">${prompt}</div>
            </div>`);
    });
    $('.qf-del-mood').off('click').on('click', function(e) {
        e.preventDefault(); s.moods.splice($(this).data('idx'), 1);
        saveSettingsDebounced(); renderMoodSettingsList(); renderUI();
    });
}

function openMoodEditor(index) {
    const s = extension_settings[extensionName];
    const mood = s.moods[index];
    if (!mood) return;

    $('#qf-mood-editor').remove();
    $(document).off('keydown.qfMoodEditor');

    const modal = $(`
        <div id="qf-mood-editor" class="qf-modal-backdrop">
            <div class="qf-modal-card" role="dialog" aria-modal="true" aria-label="Edit mood">
                <div class="qf-modal-header">
                    <strong>Edit Mood</strong>
                    <button class="menu_button qf-modal-close" type="button" title="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="qf-setting-row">
                    <label>Name</label>
                    <input id="qf_edit_mood_label" class="text_pole" />
                </div>
                <div class="qf-setting-row">
                    <label>Icon</label>
                    <input id="qf_edit_mood_icon" class="text_pole" placeholder="fa-fire" />
                </div>
                <div class="qf-setting-row">
                    <label>Prompt</label>
                    <textarea id="qf_edit_mood_prompt" class="text_pole" rows="4"></textarea>
                </div>
                <div class="qf-modal-actions">
                    <button id="qf_delete_mood" class="menu_button" type="button"><i class="fa-solid fa-trash"></i> Delete</button>
                    <span></span>
                    <button class="menu_button qf-modal-close" type="button">Cancel</button>
                    <button id="qf_save_mood" class="menu_button" type="button"><i class="fa-solid fa-check"></i> Save</button>
                </div>
            </div>
        </div>
    `);

    const close = () => {
        modal.remove();
        $(document).off('keydown.qfMoodEditor');
    };

    modal.find('#qf_edit_mood_label').val(mood.label || '');
    modal.find('#qf_edit_mood_icon').val((mood.icon || '').replace(/^fa-solid\s+/, ''));
    modal.find('#qf_edit_mood_prompt').val(mood.prompt || '');

    modal.on('click', (e) => {
        if (e.target.id === 'qf-mood-editor') close();
    });
    modal.find('.qf-modal-close').on('click', close);
    modal.find('#qf_save_mood').on('click', () => {
        const label = modal.find('#qf_edit_mood_label').val().trim();
        const icon = normalizeIconClass(modal.find('#qf_edit_mood_icon').val().trim() || 'fa-star');
        const prompt = modal.find('#qf_edit_mood_prompt').val().trim();
        if (!label || !prompt) { toastr.warning('Label & Prompt required'); return; }

        s.moods[index] = { ...mood, label, icon, prompt };
        saveSettingsDebounced();
        renderMoodSettingsList();
        renderUI(true);
        close();
        toastr.success('Mood updated');
    });
    modal.find('#qf_delete_mood').on('click', () => {
        if (!confirm(`Delete mood "${mood.label}"?`)) return;
        s.moods.splice(index, 1);
        saveSettingsDebounced();
        renderMoodSettingsList();
        renderUI(true);
        close();
        toastr.success('Mood deleted');
    });
    $(document).on('keydown.qfMoodEditor', (e) => {
        if (e.key === 'Escape') close();
    });

    $('body').append(modal);
    modal.find('#qf_edit_mood_label').trigger('focus');
}

async function fetchModels(prefix) {
    const s = extension_settings[extensionName];
    const provider = s[`${prefix}Provider`];
    const key = provider === 'openai' ? s[`${prefix}KeyOA`] : s[`${prefix}KeyOR`];
    const base = s[`${prefix}Base`];

    if(!key) { toastr.error('API Key Missing for ' + prefix); return; }
    const icon = $(`#qf_${prefix}_fetch i`);
    icon.removeClass('fa-sync').addClass('fa-spin fa-spinner');

    try {
        const r = await fetch(`${base}/models`, { headers: { 'Authorization': `Bearer ${key}` } });
        if (!r.ok) throw new Error(`Model fetch failed (${r.status})`);
        const d = await r.json();
        const models = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        if (!models.length) throw new Error('No models returned');
        const sel = $(`#qf_${prefix}_model`);
        sel.empty().append('<option disabled selected>Select...</option>');
        models
            .filter(m => m?.id)
            .sort((a,b)=>a.id.localeCompare(b.id))
            .forEach(m=>sel.append(new Option(m.id, m.id)));
        toastr.success(`Fetched ${models.length} models for ${prefix}`);
    } catch(e) { toastr.error(e.message || 'Fetch Failed'); }
    icon.addClass('fa-sync').removeClass('fa-spin fa-spinner');
}

// --- CORE UI ---
function cleanupPositionListeners() {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (positionListenersBound) {
        window.removeEventListener('resize', schedulePositionUpdate);
        window.removeEventListener('scroll', schedulePositionUpdate, true);
        window.visualViewport?.removeEventListener('resize', schedulePositionUpdate);
        positionListenersBound = false;
    }
}

function initTracker() {
    cleanupPositionListeners();
    const textArea = document.getElementById('send_textarea');
    if (!textArea) return;
    resizeObserver = new ResizeObserver(() => schedulePositionUpdate());
    resizeObserver.observe(textArea);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    window.visualViewport?.addEventListener('resize', schedulePositionUpdate);
    positionListenersBound = true;
    updatePosition();
}

function updatePosition() {
    const textArea = document.getElementById('send_textarea'); if (!textArea) return; 
    const rect = textArea.getBoundingClientRect();
    const s = extension_settings[extensionName];
    
    const applyPos = (el, xKey, yKey) => {
        if (!el) return;
        let y = parseFloat(s[yKey]) || 0;
        if (s.mobileStyle === 'docked' && yKey === 'y') y = -2;
        else y = clampNumber(y, 0, Math.max(0, rect.top - 8));

        const xPercent = clampNumber(parseFloat(s[xKey]) || 50, 3, 97);
        el.style.left = (window.innerWidth * (xPercent / 100)) + 'px';
        el.style.top = (rect.top - y) + 'px';
        el.style.transform = `translate(-50%, -100%) scale(${parseFloat(s.scale) || 1})`;
        el.style.zIndex = isEditing ? '2147483647' : (parseInt(s.zIndex) || 2000);
    };
    
    applyPos(container, 'x', 'y');

    if (s.groupedWidgets) {
        applyPos(quadContainer, 'quadX', 'quadY');
    } else {
        applyPos(moodContainer, 'moodX', 'moodY');
        applyPos(replyContainer, 'replyX', 'replyY');
        applyPos(spellContainer, 'spellX', 'spellY');
        applyPos(undoContainer, 'undoX', 'undoY');
    }
}

function updateContainerStyles() { updatePosition(); }

function renderUI(force = false) {
    if (container) container.remove(); 
    if (moodContainer) moodContainer.remove(); 
    if (replyContainer) replyContainer.remove();
    if (spellContainer) spellContainer.remove();
    if (undoContainer) undoContainer.remove();
    if (quadContainer) quadContainer.remove();

    $('#qf-mood-dropdown').remove();
    const s = extension_settings[extensionName];
    if (!s.enabled) { cleanupPositionListeners(); return; }

    // --- CUSTOM DOUBLE TAP LOGIC ---
    const tapThreshold = 250; 

    const addEditTrigger = (el) => {
        let lastTap = 0;
        el.addEventListener('click', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < tapThreshold && tapLength > 0) {
                e.preventDefault(); 
                e.stopPropagation(); 
                toggleEdit(!isEditing);
            }
            lastTap = currentTime;
        });
        el.removeEventListener('dblclick', toggleEdit); 
    };

    container = document.createElement('div');
    container.className = `quick-format-container style-${s.mobileStyle || 'docked'}`;
    container.dataset.kX = 'x'; container.dataset.kY = 'y';
    formattingButtons.forEach(b => { if(!s.hiddenButtons[b.id]) container.appendChild(createBtn(b)); });
    document.body.appendChild(container);

    if (s.groupedWidgets) {
        quadContainer = document.createElement('div');
        const layoutClass = s.groupLayout === 'grid' ? 'qf-layout-grid' : 'qf-layout-flat';
        quadContainer.className = `quick-format-container qf-group-container ${layoutClass}`;
        quadContainer.dataset.kX = 'quadX'; quadContainer.dataset.kY = 'quadY';

        if (s.toolsBtnEnabled) quadContainer.appendChild(createBtn({ id: 'enhancer', icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>', title: 'Spellcheck', action: () => processAI('spell'), isEnhance: true }));
        if (s.moodBtnEnabled) quadContainer.appendChild(createBtn({ id: 'btn_mood', icon: '<i class="fa-solid fa-brain"></i>', title: 'Moods', action: toggleMoodDropdown }));
        if (s.replyBtnEnabled) quadContainer.appendChild(createBtn({ id: 'btn_reply', icon: '<i class="fa-solid fa-comment"></i>', title: 'Auto Reply', action: () => processAI('reply'), isEnhance: true }));
        if (s.toolsBtnEnabled) quadContainer.appendChild(createBtn({ id: 'undo', icon: '<i class="fa-solid fa-rotate-left"></i>', title: 'Return text', action: restoreUndo, isUndo: true }));

        document.body.appendChild(quadContainer);
        addDragListeners(quadContainer);
        addEditTrigger(quadContainer);
    } else {
        if (s.moodBtnEnabled) {
            moodContainer = document.createElement('div');
            moodContainer.className = 'quick-format-container style-floating qf-mood-container';
            moodContainer.dataset.kX = 'moodX'; moodContainer.dataset.kY = 'moodY';
            moodContainer.appendChild(createBtn({ id: 'btn_mood', icon: '<i class="fa-solid fa-brain"></i>', title: 'Moods', action: toggleMoodDropdown }));
            document.body.appendChild(moodContainer);
            addDragListeners(moodContainer);
            addEditTrigger(moodContainer);
        }

        if (s.replyBtnEnabled) {
            replyContainer = document.createElement('div');
            replyContainer.className = 'quick-format-container style-floating qf-reply-container';
            replyContainer.dataset.kX = 'replyX'; replyContainer.dataset.kY = 'replyY';
            replyContainer.appendChild(createBtn({ id: 'btn_reply', icon: '<i class="fa-solid fa-comment"></i>', title: 'Auto Reply', action: () => processAI('reply'), isEnhance: true }));
            document.body.appendChild(replyContainer);
            addDragListeners(replyContainer);
            addEditTrigger(replyContainer);
        }

        if (s.toolsBtnEnabled) {
            spellContainer = document.createElement('div');
            spellContainer.className = 'quick-format-container style-floating qf-tools-container';
            spellContainer.dataset.kX = 'spellX'; spellContainer.dataset.kY = 'spellY';
            spellContainer.appendChild(createBtn({
                id: 'enhancer', icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>', title: 'Spellcheck', 
                action: () => processAI('spell'), isEnhance: true
            }));
            document.body.appendChild(spellContainer);
            addDragListeners(spellContainer);
            addEditTrigger(spellContainer);

            undoContainer = document.createElement('div');
            undoContainer.className = 'quick-format-container style-floating qf-tools-container';
            undoContainer.dataset.kX = 'undoX'; undoContainer.dataset.kY = 'undoY';
            undoContainer.appendChild(createBtn({
                id: 'undo', icon: '<i class="fa-solid fa-rotate-left"></i>', title: 'Return text', 
                action: restoreUndo, isUndo: true
            }));
            document.body.appendChild(undoContainer);
            addDragListeners(undoContainer);
            addEditTrigger(undoContainer);
        }
    }

    addDragListeners(container);
    addEditTrigger(container);
    updateUndoButtonState();
    initTracker();
}

function toggleMoodDropdown() {
    const existing = $('#qf-mood-dropdown');
    if (existing.length) { existing.remove(); return; }
    const s = extension_settings[extensionName];
    if (!s.moods || !s.moods.length) { toastr.info('No moods configured.'); return; }
    
    // TETHER FIX: Find the correct container
    let target = null;
    if (s.groupedWidgets && quadContainer) target = $(quadContainer);
    else if (moodContainer) target = $(moodContainer);
    
    if (!target) return;

    const dropdown = $(`<div id="qf-mood-dropdown"></div>`);
    s.moods.forEach((mood, index) => {
        const item = $(`<div class="qf-dropdown-item" title="Tap to use, hold to edit"><i class="${normalizeIconClass(mood.icon)}"></i> ${escapeHtml(mood.label)}</div>`);
        let longPressTimer = null;
        let didLongPress = false;
        const clearLongPress = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
            longPressTimer = null;
        };

        item.on('pointerdown', (e) => {
            didLongPress = false;
            clearLongPress();
            longPressTimer = setTimeout(() => {
                didLongPress = true;
                e.preventDefault();
                e.stopPropagation();
                dropdown.remove();
                $(document).off('click.qfClose');
                openMoodEditor(index);
            }, 650);
        });
        item.on('pointerup pointerleave pointercancel', clearLongPress);
        item.on('contextmenu', (e) => {
            e.preventDefault();
            clearLongPress();
            dropdown.remove();
            $(document).off('click.qfClose');
            openMoodEditor(index);
        });
        item.on('click', (e) => { 
            if (didLongPress) {
                e.preventDefault();
                e.stopPropagation();
                didLongPress = false;
                return;
            }
            e.stopPropagation();
            processAI('mood', mood.prompt); 
            dropdown.remove();
            $(document).off('click.qfClose');
        });
        dropdown.append(item);
    });

    target.append(dropdown);
    
    // TETHER STYLE
    dropdown.css({ 
        position: 'absolute', 
        bottom: '100%', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        marginBottom: '10px',
        zIndex: 2005, 
        width: 'max-content',
        minWidth: '120px',
        background: 'var(--smart-theme-bg)',
        border: '1px solid var(--smart-theme-border)',
        borderRadius: '10px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    });

    setTimeout(() => { 
        $(document).on('click.qfClose', (e) => { 
            if (!$(e.target).closest('#qf-mood-dropdown, .qf-group-container, .qf-mood-container').length) { 
                dropdown.remove(); 
                $(document).off('click.qfClose'); 
            } 
        }); 
    }, 100);
}

// --- AI LOGIC (MANUAL PERSONA) ---
async function processAI(mode, customPrompt = null) {
    if (isGenerating) { if (abortController) abortController.abort(); isGenerating = false; renderGeneratingState(false); toastr.info('Stopped'); return; }
    
    const textarea = document.getElementById('send_textarea'); 
    if (!textarea) { toastr.error('Chat input not found'); return; }
    let text = textarea ? textarea.value.trim() : '';
    
    if (!text && mode !== 'reply') { toastr.warning('No text to process'); return; }
    
    undoBuffer = text; updateUndoButtonState();
    
    const s = extension_settings[extensionName];
    const useGlobal = s.useGlobalApi;
    const p = useGlobal ? 'global' : mode; 

    const provider = s[`${p}Provider`];
    const key = provider === 'openai' ? s[`${p}KeyOA`] : s[`${p}KeyOR`];
    const base = s[`${p}Base`];
    const model = s[`${p}Model`];
    
    const params = {
        model: model || 'gpt-3.5-turbo',
        stream: s[`${p}Stream`],
        temperature: parseFloat(s[`${p}Temp`]),
        max_tokens: parseInt(s[`${p}Tokens`]) || undefined,
        frequency_penalty: parseFloat(s[`${p}FreqPen`]),
        presence_penalty: parseFloat(s[`${p}PresPen`]),
        top_p: parseFloat(s[`${p}TopP`]),
    };

    const seed = parseInt(s[`${p}Seed`]);
    if (seed !== -1) params.seed = seed;
    if(s[`${p}TopK`] > 0) params.top_k = parseInt(s[`${p}TopK`]);
    if(s[`${p}RepPen`] !== 1) params.repetition_penalty = parseFloat(s[`${p}RepPen`]);
    if(s[`${p}MinP`] > 0) params.min_p = parseFloat(s[`${p}MinP`]);
    if(s[`${p}TopA`] > 0) params.top_a = parseFloat(s[`${p}TopA`]);

    if (!key) { toastr.error(`API Key Missing for ${p.toUpperCase()}`); return; }

    // 1. Prepare Instructions
    let mainInstruction = '';
    if (mode === 'spell') mainInstruction = s.spellPrompt;
    else if (mode === 'reply') mainInstruction = s.replyPrompt;
    else if (mode === 'mood') {
        const universal = s.moodUniversalPrompt ? s.moodUniversalPrompt.trim() + '\n' : '';
        mainInstruction = universal + customPrompt;
    }

    // --- ADD THE MANUAL PERSONA ---
    // If the user pasted something in the box, replace {{persona}} with it!
    const manualPersona = s.customPersona || "";
    if (mainInstruction.includes("{{persona}}")) {
        mainInstruction = mainInstruction.replace("{{persona}}", manualPersona);
    } else if (manualPersona.length > 0) {
        // If they didn't put the macro in, append it anyway to be safe
        mainInstruction += `\n\n### User Persona:\n${manualPersona}`;
    }

    // Also replace {{user}} if we can find it on window, otherwise default to "User"
    let uName = "User";
    if (typeof window.name2 !== 'undefined') uName = window.name2;
    mainInstruction = mainInstruction.replace(/{{user}}/gi, uName);

    // 2. Prepare Context
    const context = getContext(); 
    const limit = parseInt(s[`${p}Context`]);
    let contextMessageContent = "";

    if (limit > 0 && context.chat && context.chat.length) {
        const historySlice = context.chat.slice(-limit);
        const historyBlock = historySlice.map(msg => 
            `${msg.is_user ? 'User' : 'Character'}: ${msg.mes}`
        ).join('\n\n');
        
        contextMessageContent = `### REFERENCE CONTEXT (Background Information Only):\n${historyBlock}`;
    }

    renderGeneratingState(true, mode); isGenerating = true; abortController = new AbortController();

    try {
        let messages = [];

        // System 1: Instructions (now with manual persona)
        messages.push({ role: "system", content: mainInstruction });

        // System 2: Context
        if (contextMessageContent) {
            messages.push({ role: "system", content: contextMessageContent });
        }

        // User: Trigger
        if (mode === 'spell') {
            const taggedText = `<target_text>\n${text}\n</target_text>`;
            messages.push({ role: "user", content: taggedText });
        } 
        else if (mode === 'reply') {
            if (text) {
                messages.push({ role: "user", content: `(OOC: Finish this thought for me, fitting the context):\n${text}` });
            } else {
                messages.push({ role: "user", content: `(OOC: Write the next response for User now based on the context.)` });
            }
        } 
        else {
            if (text) messages.push({ role: "user", content: text });
        }

        params.messages = messages;

        if (s.debugLogging) {
            console.log('[QuickFormat] Request URL:', `${base}/chat/completions`);
            console.log('[QuickFormat] Request Payload:', JSON.stringify(params, null, 2));
        }

        const response = await fetch(`${base}/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(params),
            signal: abortController.signal
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(`API: ${response.status}${details ? ` - ${details.slice(0, 160)}` : ''}`);
        }

        if (params.stream) {
            if (mode !== 'reply' || !text) textarea.value = ''; 
            const reader = response.body.getReader(); const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read(); if (done) break;
                const lines = decoder.decode(value).split('\n');
                for (const line of lines) { if (line.startsWith('data: ')) { try { const json = JSON.parse(line.slice(6)); if (json.choices[0]?.delta?.content) { textarea.value += json.choices[0].delta.content; textarea.scrollTop = textarea.scrollHeight; } } catch (e) {} } }
            }
        } else { 
            const data = await response.json(); 
            if (data.choices[0]?.message?.content) {
                if (mode === 'reply' && text) textarea.value += data.choices[0].message.content;
                else textarea.value = data.choices[0].message.content;
            }
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) { if (e.name !== 'AbortError') toastr.error(e.message); } 
    finally { isGenerating = false; renderGeneratingState(false); }
}

function createBtn(cfg) {
    const btn = document.createElement('button'); btn.className = 'quick-format-btn';
    if (cfg.isEnhance) btn.classList.add('qf-enhance-btn'); if (cfg.isUndo) btn.classList.add('qf-undo-btn');
    if (cfg.className) btn.classList.add(cfg.className);
    if(cfg.id) btn.id = cfg.id; 
    if (cfg.icon) btn.innerHTML = cfg.icon; else btn.innerText = cfg.label;
    btn.title = cfg.title;
    btn.setAttribute('aria-label', cfg.title || cfg.label || 'Quick Format');
    btn.onclick = (e) => { e.preventDefault(); cfg.action ? cfg.action() : insertText(cfg.start, cfg.end); };
    btn.ondblclick = (e) => { e.stopPropagation(); }; 
    btn.onmousedown = (e) => e.preventDefault(); return btn;
}

function toggleEdit(val) { 
    isEditing = val; 
    $('.quick-format-container').toggleClass('editing', val); 
    
    if (val) {
        $('.quick-format-container').each(function() {
            if ($(this).find('.qf-lock-btn').length === 0) {
                const lockBtn = $('<button class="qf-lock-btn"><i class="fa-solid fa-lock"></i></button>');
                lockBtn.on('click touchstart', (e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    toggleEdit(false); 
                });
                $(this).append(lockBtn);
            }
        });
        toastr.info('Edit Mode Unlocked');
    } else {
        $('.qf-lock-btn').remove();
        toastr.info('Locked');
    }
    
    updateContainerStyles(); 
}

function insertText(startTag, endTag) {
    const textarea = document.getElementById('send_textarea'); 
    if (!textarea) return;
    const s = textarea.selectionStart; const e = textarea.selectionEnd; const val = textarea.value;
    const selected = val.substring(s, e);
    const before = val.substring(0, s);
    const after = val.substring(e);

    if (selected.startsWith(startTag) && selected.endsWith(endTag) && selected.length >= startTag.length + endTag.length) {
        const unwrapped = selected.slice(startTag.length, selected.length - endTag.length);
        textarea.value = before + unwrapped + after;
        textarea.selectionStart = s;
        textarea.selectionEnd = s + unwrapped.length;
    } else if (before.endsWith(startTag) && after.startsWith(endTag)) {
        textarea.value = before.slice(0, -startTag.length) + selected + after.slice(endTag.length);
        textarea.selectionStart = s - startTag.length;
        textarea.selectionEnd = e - startTag.length;
    } else {
        textarea.value = before + startTag + selected + endTag + after;
        textarea.selectionStart = s + startTag.length;
        textarea.selectionEnd = s + startTag.length + selected.length;
    }

    textarea.focus(); textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderGeneratingState(active, mode = activeGenerationMode) { 
    const restoreIcons = () => {
        $('#enhancer').html('<i class="fa-solid fa-wand-magic-sparkles"></i>');
        $('#btn_reply').html('<i class="fa-solid fa-comment"></i>');
        $('#btn_mood').html('<i class="fa-solid fa-brain"></i>');
    };

    $('.qf-generating').removeClass('qf-generating');
    restoreIcons();

    if (active) {
        activeGenerationMode = mode;
        const selector = mode === 'reply' ? '#btn_reply' : mode === 'mood' ? '#btn_mood' : '#enhancer';
        $(selector).addClass('qf-generating').html('<i class="fa-solid fa-square"></i>');
        return;
    }

    activeGenerationMode = null;
}

function restoreUndo() { const t = document.getElementById('send_textarea'); if (t && undoBuffer !== null) { t.value = undoBuffer; t.dispatchEvent(new Event('input', { bubbles: true })); undoBuffer = null; updateUndoButtonState(); toastr.success('Restored'); } }
function updateUndoButtonState() {
    const canUndo = undoBuffer !== null;
    $('.qf-undo-btn')
        .toggleClass('qf-disabled', !canUndo)
        .attr('aria-disabled', canUndo ? 'false' : 'true')
        .css({opacity: canUndo ? '1' : '0.35', cursor: canUndo ? 'pointer' : 'default'});
}
function addDragListeners(el) {
    el.addEventListener('mousedown', e => handleDragStart(e, el));
    el.addEventListener('touchstart', e => handleDragStart(e, el), { passive: false, capture: true });
}

function handleDragStart(e, el) { 
    if (!isEditing) return; 
    if (e.target.closest('.qf-lock-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    activeDragEl = el;
    const t = e.touches ? e.touches[0] : e;
    dragStartCoords = {x: t.clientX, y: t.clientY};
    const s = extension_settings[extensionName];
    dragStartPos = {
        xPct: parseFloat(s[el.dataset.kX]) || 50,
        yPx: parseFloat(s[el.dataset.kY]) || 0,
        kX: el.dataset.kX,
        kY: el.dataset.kY
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleDragEnd, { capture: true });
    document.addEventListener('touchcancel', handleDragEnd, { capture: true });
}

function handleDragMove(e) {
    if (!activeDragEl) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - dragStartCoords.x;
    const s = extension_settings[extensionName];

    if (s.mobileStyle !== 'docked' || dragStartPos.kX !== 'x') {
        const textArea = document.getElementById('send_textarea');
        const rect = textArea?.getBoundingClientRect();
        const dy = dragStartCoords.y - t.clientY;
        const maxY = Math.max(0, (rect?.top || window.innerHeight) - 8);
        s[dragStartPos.kY] = `${clampNumber(dragStartPos.yPx + dy, 0, maxY)}px`;
    }

    s[dragStartPos.kX] = `${clampNumber(dragStartPos.xPct + ((dx / window.innerWidth) * 100), 3, 97)}%`;
    schedulePositionUpdate();
}

function handleDragEnd() {
    if (!activeDragEl) return;
    saveSettingsDebounced();
    activeDragEl = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove, true);
    document.removeEventListener('touchend', handleDragEnd, true);
    document.removeEventListener('touchcancel', handleDragEnd, true);
}
