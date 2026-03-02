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
  saveRoute: (
    scope: AiModelRoute["scope"],
    primaryModelId: string,
    fallbackModelId: string,
  ) => Promise<void>;
}

export function ModelRoutingSection({
  routeDrafts,
  setRouteDrafts,
  providers,
  models,
  saveRoute,
}: ModelRoutingSectionProps) {
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
          Configure primary and fallback model routing per scope. These routes determine which model
          is used for specific tasks like post generation or image creation.
        </p>

        <div className="space-y-6">
          {ROUTE_SCOPE_ORDER.map((scope) => {
            const draftRoute = routeDrafts[scope] ?? {
              primaryModelId: "",
              fallbackModelId: "",
            };
            return (
              <div
                key={scope}
                className="bg-base-200/40 border-base-300 flex flex-col rounded-xl border p-5 transition-shadow hover:shadow-sm"
              >
                <div className="border-base-300/50 mb-4 flex items-center justify-between border-b pb-3">
                  <span className="badge badge-primary badge-outline font-mono text-[10px] font-bold tracking-wider uppercase">
                    {scope}
                  </span>
                  <div className="bg-primary/40 h-1.5 w-1.5 rounded-full"></div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="form-control w-full">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold opacity-70">
                        Primary Model
                      </span>
                    </label>
                    <select
                      className="select select-bordered select-sm bg-base-100 focus:select-primary w-full"
                      value={draftRoute.primaryModelId}
                      onChange={(e) =>
                        setRouteDrafts((prev) => ({
                          ...prev,
                          [scope]: { ...prev[scope], primaryModelId: e.target.value },
                        }))
                      }
                    >
                      <option value="">(Select model)</option>
                      {modelForScope(scope).map((model) => (
                        <option key={model.id} value={model.id}>
                          {optionLabelForModel(model, providers)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control w-full">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold opacity-70">
                        Fallback Model
                      </span>
                    </label>
                    <select
                      className="select select-bordered select-sm bg-base-100 focus:select-primary w-full"
                      value={draftRoute.fallbackModelId}
                      onChange={(e) =>
                        setRouteDrafts((prev) => ({
                          ...prev,
                          [scope]: { ...prev[scope], fallbackModelId: e.target.value },
                        }))
                      }
                    >
                      <option value="">(None)</option>
                      {modelForScope(scope).map((model) => (
                        <option key={model.id} value={model.id}>
                          {optionLabelForModel(model, providers)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-base-300/50 mt-6 flex justify-end border-t pt-4">
                  <button
                    className="btn btn-primary btn-sm gap-2 shadow-sm"
                    onClick={() =>
                      void saveRoute(
                        scope,
                        routeDrafts[scope]?.primaryModelId ?? "",
                        routeDrafts[scope]?.fallbackModelId ?? "",
                      )
                    }
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Configuration
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
