import { type CSSProperties, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  type DragEndEvent,
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, Check, GripVertical, Key, Server } from "lucide-react";
import type {
  AiModelConfig,
  AiModelRoute,
  AiProviderConfig,
} from "@/lib/ai/admin/control-plane-store";
import { SectionCard } from "../SectionCard";
import { SUPPORTED_MODELS, SUPPORTED_PROVIDERS } from "@/lib/ai/admin/control-plane-types";

type Capability = "text_generation" | "image_generation";

export interface ProvidersModelsSectionProps {
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  routes: AiModelRoute[];
  createSupportedProvider: (
    providerKey: (typeof SUPPORTED_PROVIDERS)[number]["id"],
    apiKey: string,
  ) => Promise<void>;
  reorderModels: (capability: Capability, orderedModelKeys: string[]) => Promise<void>;
  runModelTest: (modelId: string) => Promise<void>;
  setModelActive: (modelId: string, nextActive: boolean) => Promise<void>;
}

type ModelRow = {
  capability: Capability;
  modelKey: string;
  displayName: string;
  providerDisplayName: string;
  providerHasKey: boolean;
  orderIndex: number;
  model: AiModelConfig | null;
  modelTestStatus: "untested" | "success" | "failed";
  lifecycleStatus: "active" | "retired";
  lastErrorMessage: string | null;
  supportsImageInputPrompt: boolean;
};

function readModelTestStatus(model: AiModelConfig | null): "untested" | "success" | "failed" {
  if (!model) {
    return "untested";
  }
  return model.testStatus;
}

function findOrder(modelKey: string, keys: string[]): number | null {
  const index = keys.indexOf(modelKey);
  return index >= 0 ? index : null;
}

function SortableModelRow({
  row,
  rowIndex,
  onRunModelTest,
  onSetModelActive,
}: {
  row: ModelRow;
  rowIndex: number;
  onRunModelTest: (modelId: string) => void;
  onSetModelActive: (modelId: string, nextActive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.modelKey,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const canActivate =
    row.providerHasKey && row.modelTestStatus === "success" && row.lifecycleStatus !== "retired";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-base-200/40 ${isDragging ? "bg-base-200/70" : ""}`}
    >
      <td>
        <div className="flex items-center gap-1">
          <span className="badge badge-outline badge-xs">#{rowIndex + 1}</span>
          <button
            className="text-base-content/50 hover:text-base-content cursor-grab rounded p-0.5"
            title="Drag to reorder"
            {...(isHydrated ? attributes : {})}
            {...(isHydrated ? listeners : {})}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      <td className="font-medium">{row.displayName}</td>
      <td className="text-xs opacity-70">{row.providerDisplayName}</td>
      <td className="text-xs">
        <span className="badge badge-ghost badge-sm">
          {row.supportsImageInputPrompt ? "text+image" : "text"}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          {row.lifecycleStatus === "retired" ? (
            <span className="badge badge-error badge-xs">retired</span>
          ) : null}
          <span
            className={`badge badge-sm ${
              row.modelTestStatus === "success"
                ? "badge-success"
                : row.modelTestStatus === "failed"
                  ? "badge-error"
                  : "badge-ghost"
            }`}
          >
            {row.modelTestStatus}
          </span>
          <button
            className="btn btn-ghost btn-xs"
            disabled={!row.model}
            onClick={() => row.model && onRunModelTest(row.model.id)}
          >
            Test
          </button>
        </div>
      </td>
      <td className="text-xs">
        {row.lastErrorMessage ? (
          <span className="text-error">{row.lastErrorMessage}</span>
        ) : (
          <span className="opacity-50">-</span>
        )}
      </td>
      <td>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={row.model?.status === "active"}
            disabled={!row.model}
            onChange={(event) => {
              if (!row.model) {
                return;
              }
              if (event.target.checked && !canActivate) {
                toast.error("Need provider API key + model test success before active");
                return;
              }
              onSetModelActive(row.model.id, event.target.checked);
            }}
          />
          {row.model?.status === "active" ? <Check className="text-success h-3.5 w-3.5" /> : null}
        </label>
      </td>
    </tr>
  );
}

export function ProvidersModelsSection({
  providers,
  models,
  routes,
  createSupportedProvider,
  reorderModels,
  runModelTest,
  setModelActive,
}: ProvidersModelsSectionProps) {
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerModalKey, setProviderModalKey] =
    useState<(typeof SUPPORTED_PROVIDERS)[number]["id"]>("xai");
  const [providerModalApiKey, setProviderModalApiKey] = useState("");
  const [manualOrder, setManualOrder] = useState<Record<Capability, string[]>>({
    text_generation: [],
    image_generation: [],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const providerByKey = useMemo(() => {
    const map = new Map<string, AiProviderConfig>();
    for (const provider of providers) {
      map.set(provider.providerKey, provider);
    }
    return map;
  }, [providers]);

  const modelByKey = useMemo(() => {
    const map = new Map<string, AiModelConfig>();
    for (const model of models) {
      map.set(model.modelKey, model);
    }
    return map;
  }, [models]);

  const routeTextModelKeys = useMemo(() => {
    const route = routes.find((item) => item.scope === "global_default");
    return (route?.orderedModelIds ?? [])
      .map((id) => models.find((item) => item.id === id)?.modelKey ?? "")
      .filter((key): key is string => Boolean(key));
  }, [routes, models]);

  const routeImageModelKeys = useMemo(() => {
    const route = routes.find((item) => item.scope === "image");
    return (route?.orderedModelIds ?? [])
      .map((id) => models.find((item) => item.id === id)?.modelKey ?? "")
      .filter((key): key is string => Boolean(key));
  }, [routes, models]);

  const rowsByCapability = useMemo(() => {
    const rows: Record<Capability, ModelRow[]> = {
      text_generation: [],
      image_generation: [],
    };

    for (const supported of SUPPORTED_MODELS) {
      const provider = providerByKey.get(supported.providerId);
      const model = modelByKey.get(supported.modelKey) ?? null;

      const routeOrder =
        supported.capability === "text_generation"
          ? findOrder(supported.modelKey, routeTextModelKeys)
          : findOrder(supported.modelKey, routeImageModelKeys);

      const explicitOrder =
        model && typeof model.displayOrder === "number" && Number.isFinite(model.displayOrder)
          ? model.displayOrder
          : null;
      const metadataOrder =
        model && typeof model.metadata?.displayOrder === "number"
          ? model.metadata.displayOrder
          : null;
      const orderIndex = explicitOrder ?? metadataOrder ?? routeOrder ?? 99;

      rows[supported.capability].push({
        capability: supported.capability,
        modelKey: supported.modelKey,
        displayName: supported.displayName,
        providerDisplayName: provider?.displayName ?? supported.providerId,
        providerHasKey: Boolean(provider?.hasKey),
        orderIndex,
        model,
        modelTestStatus: readModelTestStatus(model),
        lifecycleStatus: model?.lifecycleStatus ?? "active",
        lastErrorMessage: model?.lastErrorMessage ?? null,
        supportsImageInputPrompt:
          model?.supportsImageInputPrompt ??
          (Array.isArray(supported.metadata.input) && supported.metadata.input.includes("image")),
      });
    }

    for (const capability of ["text_generation", "image_generation"] as const) {
      rows[capability].sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) {
          return a.orderIndex - b.orderIndex;
        }
        return a.displayName.localeCompare(b.displayName);
      });
    }

    return rows;
  }, [providerByKey, modelByKey, routeTextModelKeys, routeImageModelKeys]);

  useEffect(() => {
    setManualOrder({
      text_generation: rowsByCapability.text_generation.map((item) => item.modelKey),
      image_generation: rowsByCapability.image_generation.map((item) => item.modelKey),
    });
  }, [rowsByCapability]);

  const orderedRowsByCapability = useMemo(() => {
    const result: Record<Capability, ModelRow[]> = {
      text_generation: [],
      image_generation: [],
    };

    for (const capability of ["text_generation", "image_generation"] as const) {
      const map = new Map(rowsByCapability[capability].map((row) => [row.modelKey, row] as const));
      const order = manualOrder[capability].length
        ? manualOrder[capability]
        : rowsByCapability[capability].map((row) => row.modelKey);
      result[capability] = order
        .map((modelKey) => map.get(modelKey) ?? null)
        .filter((item): item is ModelRow => item !== null);
    }

    return result;
  }, [rowsByCapability, manualOrder]);

  const openProviderModal = (providerKey: (typeof SUPPORTED_PROVIDERS)[number]["id"]) => {
    setProviderModalKey(providerKey);
    setProviderModalApiKey("");
    setProviderModalOpen(true);
  };

  const handleDragEnd = (capability: Capability) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const current = orderedRowsByCapability[capability].map((row) => row.modelKey);
    const oldIndex = current.indexOf(String(active.id));
    const newIndex = current.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const next = arrayMove(current, oldIndex, newIndex);
    setManualOrder((prev) => ({
      ...prev,
      [capability]: next,
    }));
    void reorderModels(capability, next);
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Providers" icon={<Server className="h-4 w-4" />}>
        <div className="overflow-x-auto">
          <table className="table-sm table w-full">
            <thead>
              <tr>
                <th>Provider</th>
                <th>API Key</th>
                <th className="text-right">Setting</th>
              </tr>
            </thead>
            <tbody className="divide-base-200 divide-y">
              {SUPPORTED_PROVIDERS.map((supported) => {
                const provider = providerByKey.get(supported.id);
                const hasKey = Boolean(provider?.hasKey);
                return (
                  <tr key={supported.id} className="hover:bg-base-200/40">
                    <td className="font-medium">{supported.displayName}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${hasKey ? "badge-success" : "badge-ghost"}`}
                      >
                        {hasKey ? "configured" : "missing"}
                      </span>
                      {provider?.lastApiErrorMessage ? (
                        <div className="text-error mt-1 text-xs">
                          {provider.lastApiErrorMessage}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn btn-ghost btn-xs gap-1"
                        onClick={() => openProviderModal(supported.id)}
                      >
                        <Key className="h-3.5 w-3.5" />
                        API Key
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Model Selection & Order" icon={<Bot className="h-4 w-4" />}>
        <p className="mb-4 text-sm opacity-70">
          可隨時拖拉排序。LLM 會依 active model order 由上到下嘗試，排序與 active 啟用狀態解耦。
        </p>

        <div className="space-y-6">
          {["text_generation", "image_generation"].map((capability) => {
            const cap = capability as Capability;
            const rows = orderedRowsByCapability[cap];
            return (
              <div key={capability} className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {capability === "text_generation" ? "Text Models" : "Image Models"}
                </h3>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(cap)}
                >
                  <SortableContext
                    items={rows.map((row) => row.modelKey)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="overflow-x-auto">
                      <table className="table-sm table w-full">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Model</th>
                            <th>Provider</th>
                            <th>Prompt Input</th>
                            <th>Test</th>
                            <th>Error</th>
                            <th>Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-base-200 divide-y">
                          {rows.map((row, rowIndex) => (
                            <SortableModelRow
                              key={row.modelKey}
                              row={row}
                              rowIndex={rowIndex}
                              onRunModelTest={(modelId) => void runModelTest(modelId)}
                              onSetModelActive={(modelId, nextActive) =>
                                void setModelActive(modelId, nextActive)
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {providerModalOpen && (
        <dialog className="modal modal-open" open>
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">Provider API Key Setting</h3>

            <div className="border-base-300 bg-base-200/30 rounded-lg border p-3 text-sm">
              <div className="font-medium">{providerModalKey}</div>
              <div className="opacity-70">
                {SUPPORTED_PROVIDERS.find((item) => item.id === providerModalKey)?.sdkPackage ??
                  "-"}
              </div>
            </div>

            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">API Key</span>
              </label>
              <input
                type="password"
                className="input input-bordered input-sm w-full"
                value={providerModalApiKey}
                onChange={(event) => setProviderModalApiKey(event.target.value)}
                placeholder="sk-..."
              />
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setProviderModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  void createSupportedProvider(providerModalKey, providerModalApiKey);
                  setProviderModalOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setProviderModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
