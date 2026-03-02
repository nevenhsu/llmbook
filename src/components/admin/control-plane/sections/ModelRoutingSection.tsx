import type { Dispatch, SetStateAction } from "react";
import { Route, Save } from "lucide-react";
import type {
  AiModelConfig,
  AiModelRoute,
  AiProviderConfig,
} from "@/lib/ai/admin/control-plane-store";
import { ROUTE_SCOPE_ORDER, type RouteDraftState } from "@/lib/ai/admin/control-plane-types";
import { SectionCard } from "../SectionCard";
import { optionLabelForModel } from "../control-plane-utils";

export interface ModelRoutingSectionProps {
  routeDrafts: RouteDraftState;
  setRouteDrafts: Dispatch<SetStateAction<RouteDraftState>>;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  saveRoute: (scope: AiModelRoute["scope"]) => Promise<void>;
}

export function ModelRoutingSection({
  routeDrafts,
  setRouteDrafts: _setRouteDrafts,
  providers,
  models,
  saveRoute,
}: ModelRoutingSectionProps) {
  const scopeLabel = (scope: AiModelRoute["scope"]) =>
    scope === "image" ? "Image Capability" : "Text Capability";

  const modelForScope = (scope: AiModelRoute["scope"]) =>
    models.filter((model) =>
      scope === "image"
        ? model.capability === "image_generation"
        : model.capability === "text_generation",
    );

  return (
    <SectionCard title="Route Configuration" icon={<Route className="h-4 w-4" />}>
      <div className="space-y-6">
        <p className="max-w-2xl text-sm leading-relaxed opacity-60">
          Routes are capability-first and ordered. Runtime always tries models by order from #1
          downward until one succeeds.
        </p>

        <div className="space-y-6">
          {ROUTE_SCOPE_ORDER.map((scope) => {
            const draftRoute = routeDrafts[scope] ?? {
              orderedModelIds: [],
            };
            return (
              <div
                key={scope}
                className="bg-base-200/40 border-base-300 flex flex-col rounded-xl border p-5 transition-shadow hover:shadow-sm"
              >
                <div className="border-base-300/50 mb-4 flex items-center justify-between border-b pb-3">
                  <span className="badge badge-primary badge-outline font-mono text-[10px] font-bold tracking-wider uppercase">
                    {scopeLabel(scope)}
                  </span>
                  <div className="bg-primary/40 h-1.5 w-1.5 rounded-full"></div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    {draftRoute.orderedModelIds.length === 0 ? (
                      <div className="text-sm opacity-60">No active model in this capability.</div>
                    ) : (
                      draftRoute.orderedModelIds.map((modelId, index) => {
                        const model = modelForScope(scope).find((item) => item.id === modelId);
                        return (
                          <div key={modelId} className="badge badge-outline gap-2">
                            #{index + 1}
                            <span>{model ? optionLabelForModel(model, providers) : modelId}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="border-base-300/50 mt-6 flex justify-end border-t pt-4">
                  <button
                    className="btn btn-primary btn-sm gap-2 shadow-sm"
                    onClick={() => void saveRoute(scope)}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Sync From Active Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
