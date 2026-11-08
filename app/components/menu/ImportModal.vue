<script setup lang="ts">
/**
 * Import du menu depuis un fichier CSV ou Excel (.xlsx) : une ligne par plat.
 * Étapes : choix du fichier → aperçu vérifié ligne par ligne → création des
 * catégories manquantes puis des plats, avec progression → bilan.
 */
import type { Category, MenuItem, Paginated } from '~/types/api';
import { downloadBlob } from '~/utils/download';
import {
  buildPlan,
  type Cell,
  COLUMNS,
  findCategory,
  type ImportLine,
  type ImportPlan,
  MAX_IMPORT_ROWS,
  parseCsv,
  parseSheet,
  type ParsedSheet,
  sameName,
  templateCsv,
} from '~/utils/menu-import';

const emit = defineEmits<{ close: [imported: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const { money } = useMoney();

type Step = 'file' | 'preview' | 'running' | 'done';
const step = ref<Step>('file');
const file = ref<File | null>(null);
const reading = ref(false);
const readError = ref<string | null>(null);
const sheet = ref<ParsedSheet | null>(null);
const plan = ref<ImportPlan | null>(null);
const updateExisting = ref(false);

// ─── Lecture du fichier ───
async function readRows(f: File): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(f.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return (await readSheet(f)) as Cell[][];
  }
  if (/\.(csv|txt)$/i.test(f.name)) return parseCsv(await f.text());
  throw new Error('Format non pris en charge : utilisez un fichier .csv ou .xlsx (Excel). Pour un ancien .xls, enregistrez-le d’abord en .xlsx.');
}

/** Plats déjà au menu, par catégorie (toutes les pages). */
async function existingItems() {
  const byCategory = new Map<string, { id: string; name: string }[]>();
  for (let page = 1; ; page++) {
    const res = await api<Paginated<MenuItem>>(`${restaurant.base}/menu/items`, { query: { page, limit: 100 } });
    for (const item of res.data) byCategory.set(item.categoryId, [...(byCategory.get(item.categoryId) ?? []), { id: item.id, name: item.name }]);
    if (page >= res.meta.totalPages) break;
  }
  return byCategory;
}

let categories: Category[] = [];
async function loadCategories() {
  categories = await api<Category[]>(`${restaurant.base}/menu/categories`);
}

watch(file, async (f) => {
  readError.value = null;
  if (!f) return;
  reading.value = true;
  try {
    const parsed = parseSheet(await readRows(f), restaurant.currency);
    if (parsed.missingColumns.length) {
      readError.value = `Colonne(s) obligatoire(s) introuvable(s) : ${parsed.missingColumns.join(', ')}. Partez du modèle pour avoir les bons intitulés.`;
      return;
    }
    if (!parsed.lines.length) {
      readError.value = 'Le fichier ne contient aucun plat (seulement l’en-tête ?).';
      return;
    }
    await loadCategories();
    sheet.value = parsed;
    plan.value = buildPlan(parsed.lines, categories, await existingItems());
    step.value = 'preview';
  } catch (err) {
    readError.value = err instanceof Error && !('statusCode' in err) ? err.message : apiErrorMessage(err);
  } finally {
    reading.value = false;
  }
});

function downloadTemplate() {
  downloadBlob(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'modele-menu-qr-order.csv');
}

function restart() {
  file.value = null;
  sheet.value = null;
  plan.value = null;
  step.value = 'file';
}

// ─── Aperçu ───
type RowStatus = 'new' | 'existing' | 'invalid';
const rows = computed(() => {
  if (!plan.value) return [];
  const status = new Map<number, RowStatus>();
  for (const l of plan.value.items) status.set(l.row, 'new');
  for (const l of plan.value.existing) status.set(l.row, 'existing');
  for (const l of plan.value.invalid) status.set(l.row, 'invalid');
  return (sheet.value?.lines ?? []).map((l) => ({ ...l, status: status.get(l.row)! }));
});
const filter = ref<'all' | 'issues'>('all');
const visibleRows = computed(() =>
  filter.value === 'all' ? rows.value : rows.value.filter((r) => r.status === 'invalid' || r.warnings.length),
);
const warningCount = computed(() => rows.value.filter((r) => r.status !== 'invalid' && r.warnings.length).length);
const toCreate = computed(() => (plan.value?.items.length ?? 0) + (updateExisting.value ? plan.value?.existing.length ?? 0 : 0));

const STATUS_UI: Record<RowStatus, { icon: string; class: string; label: string }> = {
  new: { icon: 'i-lucide-circle-plus', class: 'text-success', label: 'Nouveau' },
  existing: { icon: 'i-lucide-circle-dot', class: 'text-info', label: 'Déjà au menu' },
  invalid: { icon: 'i-lucide-circle-x', class: 'text-error', label: 'Erreur' },
};

// ─── Import ───
const progress = ref({ done: 0, total: 0, label: '' });
const paused = ref(false);
const failures = ref<{ row: number; name: string; message: string }[]>([]);
const result = ref({ categories: 0, created: 0, updated: 0 });
let cancelled = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Appel avec reprise automatique quand la limite de débit de l'API est atteinte (429). */
async function send<T>(path: string, options: Parameters<typeof api>[1]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api<T>(path, { ...options, silent: true });
    } catch (err) {
      const e = err as { statusCode?: number; response?: { headers?: Headers } };
      if (e.statusCode !== 429 || attempt >= 8) throw err;
      const wait = Number(e.response?.headers?.get('retry-after')) || 10;
      paused.value = true;
      await sleep(Math.min(wait, 60) * 1000);
      paused.value = false;
    }
  }
}

function itemBody(line: ImportLine, categoryId: string) {
  return {
    categoryId,
    name: line.name,
    ...(line.description && { description: line.description }),
    priceAmount: line.priceAmount,
    ...(line.costAmount !== undefined && { costAmount: line.costAmount }),
    ...(line.prepTimeMinutes !== undefined && { prepTimeMinutes: line.prepTimeMinutes }),
    ...(line.calories !== undefined && { calories: line.calories }),
    allergens: line.allergens,
    dietaryTags: line.dietaryTags,
    ...(line.images.length && { images: line.images }),
  };
}

async function run() {
  const p = plan.value!;
  const updates = updateExisting.value ? p.existing : [];
  step.value = 'running';
  cancelled = false;
  failures.value = [];
  result.value = { categories: 0, created: 0, updated: 0 };
  progress.value = { done: 0, total: p.categories.length + p.items.length + updates.length, label: '' };

  // 1. Catégories manquantes : parents d'abord (ordre du plan).
  for (const c of p.categories) {
    if (cancelled) break;
    progress.value.label = `Catégorie « ${c.name} »`;
    try {
      const parent = c.parent ? findCategory(categories, c.parent, null) : undefined;
      const created = await send<Category>(`${restaurant.base}/menu/categories`, {
        method: 'POST',
        body: { name: c.name, isActive: true, ...(parent && { parentId: parent.id }) },
      });
      if (parent) parent.children = [...(parent.children ?? []), created];
      else categories.push({ ...created, children: [] });
      result.value.categories++;
    } catch (err) {
      failures.value.push({ row: 0, name: `Catégorie « ${c.name} »`, message: apiErrorMessage(err) });
    }
    progress.value.done++;
  }

  const categoryOf = (l: ImportLine) =>
    findCategory(categories, l.subcategory || l.category, l.subcategory ? l.category : null);

  // 2. Nouveaux plats.
  for (const line of p.items) {
    if (cancelled) break;
    progress.value.label = line.name;
    try {
      const category = categoryOf(line);
      if (!category) throw new Error('Catégorie non créée');
      const item = await send<MenuItem>(`${restaurant.base}/menu/items`, {
        method: 'POST',
        body: { ...itemBody(line, category.id), isActive: true },
      });
      if (!line.isAvailable) {
        await send(`${restaurant.base}/menu/items/${item.id}/availability`, { method: 'PATCH', body: { isAvailable: false } });
      }
      result.value.created++;
    } catch (err) {
      failures.value.push({ row: line.row, name: line.name, message: err instanceof Error && !('statusCode' in err) ? err.message : apiErrorMessage(err) });
    }
    progress.value.done++;
  }

  // 3. Plats existants mis à jour (prix, description…), sur demande.
  for (const line of updates) {
    if (cancelled) break;
    progress.value.label = line.name;
    try {
      const category = categoryOf(line)!;
      await send(`${restaurant.base}/menu/items/${line.itemId}`, { method: 'PATCH', body: itemBody(line, category.id) });
      await send(`${restaurant.base}/menu/items/${line.itemId}/availability`, { method: 'PATCH', body: { isAvailable: line.isAvailable } });
      result.value.updated++;
    } catch (err) {
      failures.value.push({ row: line.row, name: line.name, message: apiErrorMessage(err) });
    }
    progress.value.done++;
  }

  step.value = 'done';
}

const percent = computed(() => (progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0));
const imported = computed(() => result.value.categories + result.value.created + result.value.updated > 0);

function close() {
  if (step.value === 'running') {
    cancelled = true;
    return;
  }
  emit('close', imported.value);
}

const columnsHelp = Object.values(COLUMNS).map((c) => ({ label: c.label, required: c.required }));
const sameCategoryName = (a: string, b: string) => sameName(a, b);
</script>

<template>
  <UModal
    title="Importer un menu"
    :description="step === 'file' ? 'Ajoutez tous vos plats d’un coup depuis un fichier Excel ou CSV.' : file?.name"
    :dismissible="step !== 'running'"
    :ui="{ content: 'sm:max-w-4xl' }"
    @update:open="(o) => !o && close()"
  >
    <template #body>
      <!-- 1. Fichier -->
      <div v-if="step === 'file'" class="space-y-5">
        <UFileUpload
          v-model="file"
          accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          icon="i-lucide-file-spreadsheet"
          label="Déposez votre fichier ici"
          description="Excel (.xlsx) ou CSV · 500 plats maximum par import"
          :disabled="reading"
          class="min-h-44 w-full"
        />
        <div v-if="reading" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" /> Lecture du fichier…
        </div>
        <UAlert v-if="readError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="readError" />

        <div class="rounded-lg bg-elevated/60 p-4 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-medium text-highlighted">Une ligne par plat, avec ces colonnes :</p>
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" label="Télécharger le modèle" @click="downloadTemplate" />
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <UBadge
              v-for="c in columnsHelp"
              :key="c.label"
              :label="c.label"
              :color="c.required ? 'primary' : 'neutral'"
              :variant="c.required ? 'subtle' : 'outline'"
              size="sm"
              class="font-mono"
            />
          </div>
          <ul class="mt-3 list-disc space-y-1 pl-5 text-muted">
            <li>En couleur : obligatoire. Les catégories et sous-catégories absentes sont créées automatiquement.</li>
            <li>Prix en {{ restaurant.currency }} : « 3500 », « 3 500 » ou « 12,50 ».</li>
            <li>disponible : oui / non (vide = oui). Allergènes et régimes séparés par des virgules (ex. « Lait, Gluten »).</li>
            <li>Les options (taille, sauce…) et les photos s’ajoutent ensuite depuis la fiche du plat ; une URL d’image est acceptée.</li>
          </ul>
        </div>
      </div>

      <!-- 2. Aperçu -->
      <div v-else-if="step === 'preview' && plan" class="space-y-4">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs text-muted">Nouveaux plats</p>
            <p class="font-display text-2xl font-semibold text-success">{{ plan.items.length }}</p>
          </div>
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs text-muted">Catégories à créer</p>
            <p class="font-display text-2xl font-semibold">{{ plan.categories.length }}</p>
          </div>
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs text-muted">Déjà au menu</p>
            <p class="font-display text-2xl font-semibold text-info">{{ plan.existing.length }}</p>
          </div>
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs text-muted">Lignes en erreur</p>
            <p class="font-display text-2xl font-semibold" :class="plan.invalid.length ? 'text-error' : ''">{{ plan.invalid.length }}</p>
          </div>
        </div>

        <UAlert
          v-if="sheet?.truncated"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Seules les ${MAX_IMPORT_ROWS} premières lignes seront importées. Importez la suite dans un second fichier.`"
        />
        <UAlert
          v-if="sheet?.ignoredColumns.length"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          :title="`Colonne(s) ignorée(s) : ${sheet.ignoredColumns.join(', ')}`"
        />
        <p v-if="plan.categories.length" class="text-sm text-muted">
          Nouvelles catégories :
          <span class="text-highlighted">{{ plan.categories.map((c) => (c.parent ? `${c.parent} › ${c.name}` : c.name)).join(', ') }}</span>
        </p>
        <USwitch
          v-if="plan.existing.length"
          v-model="updateExisting"
          :label="`Mettre à jour les ${plan.existing.length} plat(s) déjà au menu (prix, description, disponibilité…)`"
          description="Sinon, ils sont laissés tels quels."
        />

        <div class="flex items-center justify-between gap-2">
          <UTabs
            v-model="filter"
            :items="[
              { label: `Toutes (${rows.length})`, value: 'all' },
              { label: `À vérifier (${plan.invalid.length + warningCount})`, value: 'issues' },
            ]"
            :content="false"
            size="xs"
          />
        </div>

        <div class="max-h-[45vh] overflow-auto rounded-lg border border-default">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-elevated text-left text-xs text-muted">
              <tr>
                <th class="px-3 py-2 font-medium">Ligne</th>
                <th class="px-3 py-2 font-medium">Catégorie</th>
                <th class="px-3 py-2 font-medium">Plat</th>
                <th class="px-3 py-2 text-right font-medium">Prix</th>
                <th class="px-3 py-2 font-medium">État</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="r in visibleRows" :key="r.row" :class="r.status === 'invalid' && 'bg-error/5'">
                <td class="px-3 py-2 text-muted tabular">{{ r.row }}</td>
                <td class="px-3 py-2">
                  {{ r.category || '—' }}<span v-if="r.subcategory && !sameCategoryName(r.subcategory, r.category)" class="text-muted"> › {{ r.subcategory }}</span>
                </td>
                <td class="px-3 py-2">
                  <p class="font-medium text-highlighted">{{ r.name || '—' }}</p>
                  <p v-if="!r.isAvailable" class="text-xs text-warning">Épuisé</p>
                  <p v-for="e in r.errors" :key="e" class="text-xs text-error">{{ e }}</p>
                  <p v-for="w in r.warnings" :key="w" class="text-xs text-warning">{{ w }}</p>
                </td>
                <td class="px-3 py-2 text-right tabular">{{ r.status === 'invalid' && !r.priceAmount ? '—' : money(r.priceAmount) }}</td>
                <td class="px-3 py-2">
                  <span class="inline-flex items-center gap-1 text-xs whitespace-nowrap" :class="STATUS_UI[r.status].class">
                    <UIcon :name="STATUS_UI[r.status].icon" class="size-4" />{{ STATUS_UI[r.status].label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!visibleRows.length" class="p-6 text-center text-sm text-muted">Aucune ligne à vérifier.</p>
        </div>
      </div>

      <!-- 3. Import en cours -->
      <div v-else-if="step === 'running'" class="space-y-4 py-6">
        <div class="flex items-center justify-between text-sm">
          <span class="truncate text-muted">{{ paused ? 'Pause de quelques secondes (limite de l’API), reprise automatique…' : progress.label }}</span>
          <span class="tabular font-medium">{{ progress.done }} / {{ progress.total }}</span>
        </div>
        <UProgress :model-value="percent" :color="paused ? 'warning' : 'primary'" />
        <p class="text-center text-xs text-muted">Gardez cette fenêtre ouverte pendant l’import.</p>
      </div>

      <!-- 4. Bilan -->
      <div v-else-if="step === 'done'" class="space-y-4">
        <div class="flex flex-col items-center gap-2 py-4 text-center">
          <div class="flex size-14 items-center justify-center rounded-full" :class="failures.length ? 'bg-warning/10' : 'bg-success/10'">
            <UIcon :name="failures.length ? 'i-lucide-triangle-alert' : 'i-lucide-circle-check'" class="size-7" :class="failures.length ? 'text-warning' : 'text-success'" />
          </div>
          <p class="font-display text-xl font-semibold text-highlighted">
            {{ result.created }} plat(s) ajouté(s)<span v-if="result.updated">, {{ result.updated }} mis à jour</span>
          </p>
          <p class="text-sm text-muted">
            {{ result.categories }} catégorie(s) créée(s)<span v-if="plan?.invalid.length"> · {{ plan.invalid.length }} ligne(s) en erreur non importée(s)</span>
            <span v-if="cancelled"> · import interrompu</span>
          </p>
        </div>
        <div v-if="failures.length" class="max-h-60 overflow-auto rounded-lg border border-error/30 bg-error/5 p-3 text-sm">
          <p class="mb-2 font-medium text-error">Non importés ({{ failures.length }})</p>
          <ul class="space-y-1">
            <li v-for="(f, i) in failures" :key="i">
              <span v-if="f.row" class="text-muted">Ligne {{ f.row }} · </span><span class="font-medium">{{ f.name }}</span> — {{ f.message }}
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton v-if="step === 'preview'" color="neutral" variant="ghost" icon="i-lucide-arrow-left" label="Autre fichier" @click="restart" />
        <span v-else />
        <div class="flex gap-2">
          <UButton
            v-if="step !== 'done'"
            color="neutral"
            variant="ghost"
            :label="step === 'running' ? 'Interrompre' : 'Annuler'"
            @click="close"
          />
          <UButton
            v-if="step === 'preview'"
            icon="i-lucide-upload"
            :label="`Importer ${toCreate} plat(s)`"
            :disabled="!toCreate && !plan?.categories.length"
            @click="run"
          />
          <UButton v-if="step === 'done'" label="Terminer" @click="emit('close', imported)" />
        </div>
      </div>
    </template>
  </UModal>
</template>
