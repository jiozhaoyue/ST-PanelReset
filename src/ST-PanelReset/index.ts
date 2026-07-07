type PanelSource = 'tavern' | 'extension';

type ResetOptions = {
  reset_position: boolean;
  reset_size: boolean;
};

type PanelContentOptions = {
  show_close_button?: boolean;
};

type PanelResetSettings = ResetOptions & {
  settings_version: number;
  selected_panel_ids: string[];
  reset_on_load: boolean;
};

type PanelIdentity = {
  id: string;
  class_name: string;
};

type DetectedPanel = {
  id: string;
  label: string;
  source: PanelSource;
  source_label: string;
  trigger_label: string;
  is_open: boolean;
  element: HTMLElement;
  header: HTMLElement;
};

type LauncherToolbarCandidate = {
  interactive_child_count: number;
  interactive_descendant_count: number;
  contains_textbox: boolean;
};

type LauncherMountTarget = {
  $target: JQuery<HTMLElement>;
  placement: 'append' | 'after';
};

type SillyTavernPanelPersistenceContext = {
  powerUserSettings?: {
    movingUIState?: Record<string, Record<string, unknown>>;
  };
  saveSettingsDebounced?: () => void;
};

const ROOT_ID = 'st-panel-reset-root';
const OVERLAY_ID = 'st-panel-reset-overlay';
const EXTENSION_ROOT_ID = 'st-panel-reset-extension-root';
const STYLE_ID = 'st-panel-reset-style';
const SETTINGS_KEY = 'ST-PanelReset';
export const CURRENT_SETTINGS_VERSION = 2;
const EVENT_NAMESPACE = '.stPanelReset';
const LAUNCHER_LABEL = '酒馆面板重置';
const INPUT_AREA_SELECTOR = '#send_form, #form_sheld, #send_but_sheld, #send_buttons';
const SEND_TEXTAREA_SELECTOR = '#send_textarea, textarea[name="send_textarea"]';
const MESSAGE_BUTTON_MANAGER_SELECTOR = '[title="消息按钮管理器"], [aria-label="消息按钮管理器"], .fa-sliders';
const EXTENSIONS_BUTTON_SELECTOR =
  '#extensionsMenuButton, [title="扩展"], [aria-label="扩展"], .fa-magic-wand-sparkles, .fa-wand-magic-sparkles';
const INPUT_BUTTON_ROW_SELECTOR =
  '#send_but_sheld, #send_buttons, .send_but_sheld, .send-buttons, [id*="send"][id*="but"], [id*="send"][id*="button"]';
const TOOLBAR_ITEM_SELECTOR =
  'button, .menu_button, .interactable, [role="button"], [aria-label], i[title], .fa-solid, .fa-regular, .fa-brands';

export const RESET_POSITION_PROPERTIES = ['position', 'inset', 'left', 'top', 'right', 'bottom', 'margin', 'transform'];
const SIZE_PROPERTIES = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'];

export const DEFAULT_SELECTED_PANEL_IDS = new Set([
  'left-nav-panel',
  'WorldInfo',
  'right-nav-panel',
  'floatingPrompt',
  'cfgConfig',
  'logprobsViewer',
  'extensionSideBar',
  'sheld',
  'zoomed_avatar',
]);

export const DEFAULT_PANEL_RESET_SETTINGS: PanelResetSettings = {
  settings_version: CURRENT_SETTINGS_VERSION,
  selected_panel_ids: [...DEFAULT_SELECTED_PANEL_IDS],
  reset_position: true,
  reset_size: true,
  reset_on_load: false,
};

const KNOWN_PANEL_LABELS: Record<string, { label: string; trigger_label: string; source: PanelSource }> = {
  'left-nav-panel': { label: 'AI响应配置', trigger_label: '#leftNavDrawerIcon / fa-sliders', source: 'tavern' },
  WorldInfo: { label: '世界信息', trigger_label: '#WIDrawerIcon / fa-book-atlas', source: 'tavern' },
  'right-nav-panel': { label: '角色管理', trigger_label: '#rightNavDrawerIcon / fa-address-card', source: 'tavern' },
  floatingPrompt: { label: '作者备注', trigger_label: '查看作者备注按钮 / floatingPrompt', source: 'tavern' },
  cfgConfig: { label: 'CFG配置', trigger_label: 'CFG配置浮窗 / cfgConfig', source: 'tavern' },
  logprobsViewer: { label: '词符概率', trigger_label: '#option_toggle_logprobs / 词符概率', source: 'tavern' },
  extensionSideBar: {
    label: '扩展侧栏',
    trigger_label: '#extensionTopBarToggleSidebar / fa-box-archive',
    source: 'tavern',
  },
  sheld: { label: '聊天显示/操作面板', trigger_label: '#sheld / 包含 #chat 与 #form_sheld', source: 'tavern' },
  zoomed_avatar: { label: '头像放大层', trigger_label: '头像悬停放大', source: 'tavern' },
  'expression-holder': { label: '表情面板', trigger_label: '#expression-holder', source: 'extension' },
  'phone-panel': { label: '手机面板', trigger_label: '#phoneDrawerIcon / phone-panel', source: 'extension' },
};

export function normalizePanelIdentifier(panel: PanelIdentity): string {
  if (panel.id.trim() !== '') {
    return panel.id;
  }

  const class_names = panel.class_name.split(/\s+/).filter(Boolean);
  if (class_names.includes('zoomed_avatar')) {
    return 'zoomed_avatar';
  }

  return (
    class_names.find(class_name => !['drawer-content', 'draggable', 'flexGap5'].includes(class_name)) ?? 'unknown-panel'
  );
}

export function classifyPanelSource(panel_id: string): PanelSource {
  return KNOWN_PANEL_LABELS[panel_id]?.source ?? (DEFAULT_SELECTED_PANEL_IDS.has(panel_id) ? 'tavern' : 'extension');
}

export function shouldSelectPanelByDefault(panel_id: string): boolean {
  return DEFAULT_SELECTED_PANEL_IDS.has(panel_id);
}

function isBrowserScript(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof $ !== 'undefined';
}

export function normalizePanelResetSettings(saved: Partial<PanelResetSettings> | null | undefined): PanelResetSettings {
  const defaults = DEFAULT_PANEL_RESET_SETTINGS;
  if (!saved || typeof saved !== 'object') {
    return defaults;
  }

  const saved_panel_ids = Array.isArray(saved.selected_panel_ids)
    ? saved.selected_panel_ids.filter((panel_id): panel_id is string => typeof panel_id === 'string')
    : defaults.selected_panel_ids;
  const migrated_panel_ids =
    saved.settings_version === CURRENT_SETTINGS_VERSION
      ? saved_panel_ids
      : [...new Set([...saved_panel_ids, ...defaults.selected_panel_ids])];

  return {
    settings_version: CURRENT_SETTINGS_VERSION,
    selected_panel_ids: migrated_panel_ids,
    reset_position: typeof saved.reset_position === 'boolean' ? saved.reset_position : defaults.reset_position,
    reset_size: typeof saved.reset_size === 'boolean' ? saved.reset_size : defaults.reset_size,
    reset_on_load: typeof saved.reset_on_load === 'boolean' ? saved.reset_on_load : defaults.reset_on_load,
  };
}

function getTavernWindow(): Window {
  try {
    return window.parent?.document ? window.parent : window;
  } catch {
    return window;
  }
}

function getTavernDocument(): Document {
  return getTavernWindow().document;
}

function removeTavernElementById(id: string): void {
  getTavernDocument().getElementById(id)?.remove();
  if (document !== getTavernDocument()) {
    document.getElementById(id)?.remove();
  }
}

function createTavernElement<T extends HTMLElement>(html: string): T {
  const template = getTavernDocument().createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as T;
}

function readSettings(): PanelResetSettings {
  if (!isBrowserScript() || typeof getVariables !== 'function') {
    return DEFAULT_PANEL_RESET_SETTINGS;
  }

  try {
    const variables = getVariables({ type: 'script' });
    const saved = variables[SETTINGS_KEY] as Partial<PanelResetSettings> | undefined;
    const settings = normalizePanelResetSettings(saved);
    if (saved?.settings_version !== CURRENT_SETTINGS_VERSION) {
      variables[SETTINGS_KEY] = settings;
      if (typeof replaceVariables === 'function') {
        replaceVariables(variables, { type: 'script' });
      }
    }
    return settings;
  } catch (error) {
    console.warn('[ST-PanelReset] 读取设置失败, 使用默认设置', error);
    return DEFAULT_PANEL_RESET_SETTINGS;
  }
}

function saveSettings(settings: PanelResetSettings): void {
  if (!isBrowserScript() || typeof getVariables !== 'function' || typeof replaceVariables !== 'function') {
    return;
  }

  try {
    const variables = getVariables({ type: 'script' });
    variables[SETTINGS_KEY] = settings;
    replaceVariables(variables, { type: 'script' });
  } catch (error) {
    console.warn('[ST-PanelReset] 保存设置失败', error);
  }
}

function getPanelElementFromHeader(header: HTMLElement): HTMLElement | null {
  const parent = header.parentElement as HTMLElement | null;
  if (!parent) {
    return null;
  }

  if (parent.classList.contains('panelControlBar')) {
    return (
      (parent.closest('.drawer-content') as HTMLElement | null) ??
      (parent.closest('.zoomed_avatar') as HTMLElement | null) ??
      (parent.closest('.draggable') as HTMLElement | null) ??
      (parent.parentElement as HTMLElement | null)
    );
  }

  if (parent.classList.contains('logprobs_panel_controls')) {
    return (
      (parent.closest('#logprobsViewer') as HTMLElement | null) ??
      (parent.closest('.drawer-content') as HTMLElement | null) ??
      (parent.parentElement?.parentElement as HTMLElement | null) ??
      parent
    );
  }

  return parent;
}

function isPanelOpen(panel: HTMLElement): boolean {
  const rect = panel.getBoundingClientRect();
  const style = (panel.ownerDocument.defaultView ?? getTavernWindow()).getComputedStyle(panel);

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0 &&
    !panel.classList.contains('closedDrawer') &&
    !panel.classList.contains('phone-panel-hidden')
  );
}

function getFallbackLabel(panel: HTMLElement, panel_id: string): string {
  if (panel_id !== 'unknown-panel') {
    return panel_id;
  }

  return panel.className.toString().split(/\s+/).filter(Boolean).slice(0, 2).join('.') || panel.tagName.toLowerCase();
}

function getInferredTriggerLabel(panel: HTMLElement, header: HTMLElement): string {
  const known = KNOWN_PANEL_LABELS[normalizePanelIdentifier({ id: panel.id, class_name: panel.className.toString() })];
  if (known) {
    return known.trigger_label;
  }

  const drawer_icon = panel
    .closest('.drawer')
    ?.querySelector('.drawer-icon[title], .interactable[title]') as HTMLElement | null;
  const candidate =
    drawer_icon ?? (panel.parentElement?.querySelector('.interactable[title], button[title]') as HTMLElement | null);
  const title = candidate?.getAttribute('title')?.trim();
  if (title) {
    return `${title}${candidate?.id ? ` / #${candidate.id}` : ''}`;
  }

  return header.id ? `#${header.id}` : '动态发现的拖拽面板';
}

function scanPanels(): DetectedPanel[] {
  const seen = new Set<HTMLElement>();

  return Array.from(getTavernDocument().querySelectorAll<HTMLElement>('.drag-grabber'))
    .map(header => ({ header, panel: getPanelElementFromHeader(header) }))
    .filter((entry): entry is { header: HTMLElement; panel: HTMLElement } => entry.panel !== null)
    .filter(({ panel }) => {
      if (seen.has(panel)) {
        return false;
      }
      seen.add(panel);
      return true;
    })
    .map(({ header, panel }) => {
      const id = normalizePanelIdentifier({ id: panel.id, class_name: panel.className.toString() });
      const known = KNOWN_PANEL_LABELS[id];
      const source = classifyPanelSource(id);
      return {
        id,
        label: known?.label ?? getFallbackLabel(panel, id),
        source,
        source_label: source === 'tavern' ? '酒馆面板' : '扩展/未识别面板',
        trigger_label: known?.trigger_label ?? getInferredTriggerLabel(panel, header),
        is_open: isPanelOpen(panel),
        element: panel,
        header,
      };
    })
    .sort((lhs, rhs) => Number(rhs.is_open) - Number(lhs.is_open) || lhs.source.localeCompare(rhs.source));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderLauncherButton(): string {
  return `
		<button id="${ROOT_ID}" type="button" class="qr--button menu_button interactable stpr-launcher-button" data-stpr-action="toggle" title="${LAUNCHER_LABEL}" aria-label="${LAUNCHER_LABEL}">
			<span class="fa-solid fa-window-restore" aria-hidden="true"></span>
		</button>
	`;
}

export function getLauncherStyle(): string {
  return `
		#${ROOT_ID} {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			line-height: 1;
			order: 11;
		}
		#${ROOT_ID} .fa-solid {
			pointer-events: none;
		}
	`;
}

export function getOverlayStyle(): string {
  return `
    #${OVERLAY_ID} { position: fixed; inset: 0; width: 100vw; height: 100dvh; min-height: 100dvh; z-index: 12000; display: none; align-items: center; justify-content: center; pointer-events: none; }
    #${OVERLAY_ID}.stpr-open { display: flex; }
    #${OVERLAY_ID} .stpr-panel { position: relative; top: auto !important; right: auto !important; bottom: auto !important; left: auto !important; transform: none !important; display: flex; flex-direction: column; width: min(620px, calc(100vw - 32px)); max-height: min(720px, calc(100vh - 48px)); margin: auto; overflow: hidden; padding: 12px; border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,.22)); border-radius: 8px; background: var(--SmartThemeBlurTintColor, rgba(20,20,20,.94)); color: var(--SmartThemeBodyColor, inherit); box-shadow: 0 18px 48px rgba(0,0,0,.42); pointer-events: auto; }
  `;
}

export function getPanelContentStyle(): string {
  return `
    .stpr-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-weight: 700; }
    .stpr-title-actions { display: flex; align-items: center; gap: 6px; }
    .stpr-close { min-width: 28px; }
    .stpr-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0 10px; overflow-x: auto; }
    .stpr-actions .menu_button,
    .stpr-title-actions .menu_button { flex: 0 0 auto; width: auto; min-width: max-content; max-width: 100%; white-space: nowrap; writing-mode: horizontal-tb; text-orientation: mixed; }
    .stpr-list-scroll { min-height: 0; overflow: auto; padding-right: 2px; }
    .stpr-section { margin-top: 8px; }
    .stpr-section-title { margin: 0 0 5px; font-size: 12px; font-weight: 700; opacity: .86; }
    .stpr-list { display: grid; gap: 4px; }
    .stpr-item { display: grid; grid-template-columns: auto 1fr; gap: 7px; align-items: start; padding: 6px; border: 1px solid rgba(128,128,128,.28); border-radius: 6px; }
    .stpr-item-main { min-width: 0; }
    .stpr-item-label { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; font-weight: 600; }
    .stpr-badge { padding: 1px 5px; border-radius: 999px; border: 1px solid rgba(128,128,128,.34); font-size: 11px; opacity: .86; }
    .stpr-meta { margin-top: 2px; font-size: 11px; opacity: .72; overflow-wrap: anywhere; }
    .stpr-options { display: grid; gap: 5px; }
    .stpr-option { display: flex; gap: 7px; align-items: center; }
    .stpr-empty { padding: 8px; opacity: .72; font-size: 12px; }
    .stpr-status { margin-top: 8px; font-size: 12px; opacity: .8; min-height: 16px; }
  `;
}

export function getExtensionSettingsStyle(): string {
  return `
    #${EXTENSION_ROOT_ID} { margin-block: .5rem; }
    #${EXTENSION_ROOT_ID} .inline-drawer-content { max-height: min(560px, 62vh); overflow: auto; }
    #${EXTENSION_ROOT_ID} .stpr-extension-panel { display: flex; flex-direction: column; max-height: min(520px, 58vh); overflow: hidden; padding: 8px 0; }
    #${EXTENSION_ROOT_ID} .stpr-list-scroll { max-height: min(340px, 40vh); }
  `;
}

function injectStyle(): void {
  const tavern_document = getTavernDocument();
  removeTavernElementById(STYLE_ID);
  const style = tavern_document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
			${getLauncherStyle()}
      ${getOverlayStyle()}
      ${getPanelContentStyle()}
      ${getExtensionSettingsStyle()}
		`;
  (tavern_document.head ?? tavern_document.documentElement).appendChild(style);
}

function renderPanelList(panels: DetectedPanel[], settings: PanelResetSettings): string {
  const selected_panel_ids = new Set(settings.selected_panel_ids);
  const renderGroup = (title: string, group_panels: DetectedPanel[]) => `
		<div class="stpr-section">
			<div class="stpr-section-title">${escapeHtml(title)}</div>
			<div class="stpr-list">
				${
          group_panels.length === 0
            ? '<div class="stpr-empty">没有发现对应面板</div>'
            : group_panels
                .map(
                  panel => `
										<label class="stpr-item">
											<input type="checkbox" data-stpr-panel-id="${escapeHtml(panel.id)}" ${selected_panel_ids.has(panel.id) ? 'checked' : ''}>
											<span class="stpr-item-main">
												<span class="stpr-item-label">
													<span>${escapeHtml(panel.label)}</span>
													<span class="stpr-badge">${panel.is_open ? '打开' : '隐藏'}</span>
													<span class="stpr-badge">${escapeHtml(panel.id)}</span>
												</span>
												<span class="stpr-meta">触发入口: ${escapeHtml(panel.trigger_label)}</span>
											</span>
										</label>
									`,
                )
                .join('')
        }
			</div>
		</div>
	`;

  return [
    renderGroup(
      '酒馆原生',
      panels.filter(panel => panel.source === 'tavern'),
    ),
    renderGroup(
      '扩展',
      panels.filter(panel => panel.source === 'extension'),
    ),
  ].join('');
}

export function renderPanelContent(
  panels: DetectedPanel[],
  settings: PanelResetSettings,
  options: PanelContentOptions = {},
): string {
  const selected_count = panels.filter(panel => settings.selected_panel_ids.includes(panel.id)).length;
  const close_button =
    options.show_close_button === false
      ? ''
      : '<button type="button" class="menu_button interactable stpr-close" data-stpr-action="close" aria-label="关闭">X</button>';

  return `
		<div class="stpr-title">
			<span>酒馆面板重置</span>
			<span class="stpr-title-actions">
				<button type="button" class="menu_button interactable" data-stpr-action="refresh">刷新列表</button>
        ${close_button}
			</span>
		</div>
		<div class="stpr-actions">
			<button type="button" class="menu_button interactable" data-stpr-action="reset">执行重置</button>
		</div>
		<div class="stpr-options">
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="reset_position" ${settings.reset_position ? 'checked' : ''}>复原位置</label>
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="reset_size" ${settings.reset_size ? 'checked' : ''}>复原大小</label>
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="reset_on_load" ${settings.reset_on_load ? 'checked' : ''}>刷新时自动重置</label>
		</div>
		<div class="stpr-list-scroll">
			${renderPanelList(panels, settings)}
		</div>
		<div class="stpr-status">发现 ${panels.length} 个可拖拽面板，当前选择 ${selected_count} 个。</div>
	`;
}

export function renderExtensionSettingsContainer(content = ''): string {
  return `
    <div id="${EXTENSION_ROOT_ID}" class="stpr-extension-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>酒馆面板重置</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="stpr-extension-panel">${content}</div>
        </div>
      </div>
    </div>
  `;
}

function renderPanel($panel: JQuery<HTMLElement>, options: PanelContentOptions = {}): void {
  $panel.html(renderPanelContent(scanPanels(), readSettings(), options));
}

function updateSetting(setting_name: keyof Omit<PanelResetSettings, 'selected_panel_ids'>, value: boolean): void {
  saveSettings({ ...readSettings(), [setting_name]: value });
}

function updateSelectedPanels($panel: JQuery<HTMLElement>): void {
  const selected_panel_ids = $panel
    .find<HTMLInputElement>('input[data-stpr-panel-id]:checked')
    .map((_, element) => $(element).attr('data-stpr-panel-id') ?? '')
    .get()
    .filter(Boolean);

  saveSettings({ ...readSettings(), selected_panel_ids });
  $panel.find('.stpr-status').text(`已选择 ${selected_panel_ids.length} 个面板。`);
}

function resetPanel(panel: HTMLElement, options: ResetOptions): void {
  const properties = [
    ...(options.reset_position ? RESET_POSITION_PROPERTIES : []),
    ...(options.reset_size ? SIZE_PROPERTIES : []),
  ];

  properties.forEach(property => panel.style.removeProperty(property));
}

function getSelectedDetectedPanels(settings = readSettings()): DetectedPanel[] {
  const selected_panel_ids = new Set(settings.selected_panel_ids);
  return scanPanels().filter(panel => selected_panel_ids.has(panel.id));
}

function resetSelectedPanels(settings = readSettings(), silent = false): number {
  const selected_panels = getSelectedDetectedPanels(settings);
  clearDetectedPanelPersistence(getSillyTavernContext(), selected_panels);
  selected_panels.forEach(panel => {
    resetPanel(panel.element, settings);
  });

  if (!silent) {
    toastr.info(`已处理 ${selected_panels.length} 个面板`, 'ST-PanelReset');
  }

  return selected_panels.length;
}

function getSillyTavernContext(): SillyTavernPanelPersistenceContext | null {
  const runtime = globalThis as Record<string, any>;
  return runtime.SillyTavern?.getContext?.() ?? runtime.TavernHelper?.getContext?.() ?? null;
}

export function clearSelectedPanelPersistence(
  context: SillyTavernPanelPersistenceContext | null | undefined,
  panel_ids: string[],
): number {
  const moving_ui_state = context?.powerUserSettings?.movingUIState;
  if (!moving_ui_state || typeof moving_ui_state !== 'object') {
    return 0;
  }

  let cleared_count = 0;
  const candidate_panel_ids = panel_ids.flatMap(panel_id => {
    const normalized_panel_id = panel_id.trim();
    if (!normalized_panel_id) {
      return [];
    }
    return [normalized_panel_id, `#${normalized_panel_id}`];
  });

  new Set(candidate_panel_ids).forEach(panel_id => {
    if (Object.prototype.hasOwnProperty.call(moving_ui_state, panel_id)) {
      delete moving_ui_state[panel_id];
      cleared_count += 1;
    }
  });

  if (cleared_count > 0) {
    context?.saveSettingsDebounced?.();
  }

  return cleared_count;
}

type PanelPersistenceIdentity = {
  id: string;
  element: {
    id: string;
  };
};

export function clearDetectedPanelPersistence(
  context: SillyTavernPanelPersistenceContext | null | undefined,
  panels: PanelPersistenceIdentity[],
): number {
  const panel_ids = panels.flatMap(panel => [panel.id, panel.element.id]).filter(Boolean);
  return clearSelectedPanelPersistence(context, panel_ids);
}

function bindPanelEvents(
  $event_host: JQuery<HTMLElement>,
  $panel: JQuery<HTMLElement>,
  options: PanelContentOptions = {},
): void {
  $event_host.off(EVENT_NAMESPACE);

  $event_host.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="refresh"]', () => renderPanel($panel, options));
  $event_host.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="reset"]', () => {
    updateSelectedPanels($panel);
    const count = resetSelectedPanels();
    $panel.find('.stpr-status').text(`已重置 ${count} 个面板，并清除持久化尺寸/位置。`);
  });
  $event_host.on(`change${EVENT_NAMESPACE}`, '[data-stpr-setting]', event => {
    const input = event.currentTarget as HTMLInputElement;
    updateSetting(input.dataset.stprSetting as keyof Omit<PanelResetSettings, 'selected_panel_ids'>, input.checked);
  });
  $event_host.on(`change${EVENT_NAMESPACE}`, '[data-stpr-panel-id]', () => {
    updateSelectedPanels($panel);
  });
}

function bindUi($root: JQuery<HTMLElement>, $overlay: JQuery<HTMLElement>, $panel: JQuery<HTMLElement>): void {
  const $launcher_button = $root
    .filter<HTMLElement>('[data-stpr-action="toggle"]')
    .add($root.find('[data-stpr-action="toggle"]'));
  let last_toggle_at = 0;

  $root.off(EVENT_NAMESPACE);

  const toggleOverlay = (event: Event | JQuery.TriggeredEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const now = Date.now();
    if (now - last_toggle_at < 200) {
      return;
    }
    last_toggle_at = now;
    $overlay.toggleClass('stpr-open');
    if ($overlay.hasClass('stpr-open')) {
      renderPanel($panel, { show_close_button: true });
    }
  };

  $launcher_button.on(`click${EVENT_NAMESPACE}`, toggleOverlay);
  $launcher_button[0]?.addEventListener('pointerup', toggleOverlay, { capture: true });
  $launcher_button[0]?.addEventListener('click', toggleOverlay, { capture: true });
  bindPanelEvents($overlay, $panel, { show_close_button: true });
  $overlay.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="close"]', () => $overlay.removeClass('stpr-open'));
}

export function shouldUseLauncherToolbarCandidate(candidate: LauncherToolbarCandidate): boolean {
  return (
    !candidate.contains_textbox &&
    (candidate.interactive_child_count >= 2 || candidate.interactive_descendant_count >= 2)
  );
}

function getDirectToolbarItemCount(element: HTMLElement): number {
  return Array.from(element.children).filter(
    child => child instanceof HTMLElement && child.matches(TOOLBAR_ITEM_SELECTOR),
  ).length;
}

function getDescendantToolbarItemCount(element: HTMLElement): number {
  return element.querySelectorAll(TOOLBAR_ITEM_SELECTOR).length;
}

function isVisibleLauncherMountTarget(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = (element.ownerDocument.defaultView ?? getTavernWindow()).getComputedStyle(element);

  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function getClosestToolbarItem(element: Element): HTMLElement | null {
  return (
    element.closest<HTMLElement>('button, .menu_button, .interactable, [role="button"]') ?? (element as HTMLElement)
  );
}

function getLauncherInputRoots(tavern_document: Document): HTMLElement[] {
  const roots = new Set<HTMLElement>();
  tavern_document.querySelectorAll<HTMLElement>(INPUT_AREA_SELECTOR).forEach(root => roots.add(root));

  const textarea = tavern_document.querySelector<HTMLElement>(SEND_TEXTAREA_SELECTOR);
  const textarea_root = textarea?.closest<HTMLElement>(INPUT_AREA_SELECTOR);
  if (textarea_root) {
    roots.add(textarea_root);
  }
  const fallback_textarea_root = textarea?.closest<HTMLElement>('#sheld, form, [id*="form"], [class*="form"]');
  if (fallback_textarea_root) {
    roots.add(fallback_textarea_root);
  }

  return [...roots];
}

function queryLauncherInputRoots(roots: HTMLElement[], selector: string): HTMLElement | null {
  for (const root of roots) {
    const targets = [
      ...(root.matches(selector) ? [root] : []),
      ...Array.from(root.querySelectorAll<HTMLElement>(selector)),
    ];
    const target = targets.find(isVisibleLauncherMountTarget);
    if (target) {
      return target;
    }
  }

  return null;
}

function isInInputButtonRow(element: HTMLElement): boolean {
  return element.matches(INPUT_BUTTON_ROW_SELECTOR) || element.closest(INPUT_BUTTON_ROW_SELECTOR) !== null;
}

function isElementInLauncherInputArea(element: HTMLElement): boolean {
  return getLauncherInputRoots(getTavernDocument()).some(root => root === element || root.contains(element));
}

function getLauncherMountTarget(): LauncherMountTarget | null {
  const tavern_document = getTavernDocument();
  const input_roots = getLauncherInputRoots(tavern_document);

  const explicit_toolbar_selectors = [
    '#input_helper_toolbar',
    '#qr--bar',
    '.qr--buttons',
    '.quickReplyBar',
    '#quickReplyBar',
    '[id*="quickReply"]',
    '[class*="quickReply"]',
  ];

  for (const selector of explicit_toolbar_selectors) {
    const target = queryLauncherInputRoots(input_roots, selector);
    if (target) {
      return { $target: $(target), placement: 'append' };
    }
  }

  if (input_roots.length === 0) {
    return null;
  }

  const candidates = input_roots.flatMap(root =>
    Array.from(root.querySelectorAll<HTMLElement>('div, span, nav, section')),
  );
  const toolbar = candidates.find(
    candidate =>
      isVisibleLauncherMountTarget(candidate) &&
      !isInInputButtonRow(candidate) &&
      shouldUseLauncherToolbarCandidate({
        interactive_child_count: getDirectToolbarItemCount(candidate),
        interactive_descendant_count: getDescendantToolbarItemCount(candidate),
        contains_textbox: candidate.querySelector('#send_textarea, textarea, input[type="text"]') !== null,
      }),
  );

  if (toolbar) {
    return { $target: $(toolbar), placement: 'append' };
  }

  const manager_anchor = queryLauncherInputRoots(input_roots, MESSAGE_BUTTON_MANAGER_SELECTOR);
  if (manager_anchor && !isInInputButtonRow(manager_anchor)) {
    const toolbar_item = getClosestToolbarItem(manager_anchor);
    if (toolbar_item) {
      return { $target: $(toolbar_item), placement: 'after' };
    }
  }

  const extensions_anchor = queryLauncherInputRoots(input_roots, EXTENSIONS_BUTTON_SELECTOR);
  if (extensions_anchor && !isInInputButtonRow(extensions_anchor)) {
    const toolbar_item = getClosestToolbarItem(extensions_anchor);
    if (toolbar_item) {
      return { $target: $(toolbar_item), placement: 'after' };
    }
  }

  const input_button_row = queryLauncherInputRoots(input_roots, INPUT_BUTTON_ROW_SELECTOR);
  if (input_button_row) {
    return { $target: $(input_button_row), placement: 'append' };
  }

  return null;
}

function mountLauncher(): boolean {
  const existing_launcher = getTavernDocument().getElementById(ROOT_ID);
  if (existing_launcher && isElementInLauncherInputArea(existing_launcher)) {
    return true;
  }

  const mount_target = getLauncherMountTarget();
  if (!mount_target) {
    console.warn('[ST-PanelReset] 未找到输入区按钮行, 无法挂载面板重置入口');
    return false;
  }

  removeTavernElementById(ROOT_ID);
  removeTavernElementById(OVERLAY_ID);
  const $root = $(createTavernElement<HTMLButtonElement>(renderLauncherButton())) as JQuery<HTMLElement>;
  if (mount_target.placement === 'after') {
    $root.insertAfter(mount_target.$target);
  } else {
    $root.appendTo(mount_target.$target);
  }
  const $overlay = $(
    createTavernElement<HTMLDivElement>(`<div id="${OVERLAY_ID}"><div class="stpr-panel"></div></div>`),
  )
    .appendTo(getTavernDocument().body)
    .filter<HTMLElement>(`#${OVERLAY_ID}`);
  const $content_panel = $overlay.find<HTMLElement>('.stpr-panel');

  bindUi($root, $overlay, $content_panel);
  return true;
}

function mountExtensionSettings(): boolean {
  const target = getTavernDocument().querySelector<HTMLElement>('#extensions_settings2');
  if (!target) {
    return false;
  }

  removeTavernElementById(EXTENSION_ROOT_ID);
  const $root = $(createTavernElement<HTMLDivElement>(renderExtensionSettingsContainer()))
    .appendTo(target)
    .filter<HTMLElement>(`#${EXTENSION_ROOT_ID}`);
  const $content_panel = $root.find<HTMLElement>('.stpr-extension-panel');

  renderPanel($content_panel, { show_close_button: false });
  bindPanelEvents($root, $content_panel, { show_close_button: false });
  return true;
}

let launcher_mount_observer: MutationObserver | null = null;

function bindLauncherMountObserver(): void {
  const tavern_document = getTavernDocument();
  const scheduleMount = _.debounce(() => {
    const existing_launcher = tavern_document.getElementById(ROOT_ID);
    if (!existing_launcher || !isElementInLauncherInputArea(existing_launcher)) {
      mountLauncher();
    }
    if (!tavern_document.getElementById(EXTENSION_ROOT_ID)) {
      mountExtensionSettings();
    }
  }, 100);

  launcher_mount_observer?.disconnect();
  launcher_mount_observer = new MutationObserver(scheduleMount);
  launcher_mount_observer.observe(tavern_document.body, { childList: true, subtree: true });
}

function init(): void {
  injectStyle();
  bindLauncherMountObserver();
  if (!mountLauncher()) {
    [250, 1000, 2500, 5000].forEach(delay => window.setTimeout(mountLauncher, delay));
  }
  if (!mountExtensionSettings()) {
    [250, 1000, 2500, 5000].forEach(delay => window.setTimeout(mountExtensionSettings, delay));
  }

  const settings = readSettings();
  if (settings.reset_on_load) {
    [100, 1000, 2500].forEach(delay => window.setTimeout(() => resetSelectedPanels(readSettings(), true), delay));
  }

  $(window).on(`pagehide${EVENT_NAMESPACE}`, () => {
    launcher_mount_observer?.disconnect();
    launcher_mount_observer = null;
    removeTavernElementById(ROOT_ID);
    removeTavernElementById(OVERLAY_ID);
    removeTavernElementById(EXTENSION_ROOT_ID);
    removeTavernElementById(STYLE_ID);
    $(getTavernDocument()).off(EVENT_NAMESPACE);
    $(getTavernWindow()).off(EVENT_NAMESPACE);
    $(window).off(EVENT_NAMESPACE);
  });
}

if (isBrowserScript()) {
  $(() => {
    const run = typeof errorCatched === 'function' ? errorCatched(init) : init;
    run();
  });
}
