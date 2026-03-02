import type { Dispatch, SetStateAction } from "react";
import { Plus, Save, Server, FlaskConical, Trash2, Key, Bot } from "lucide-react";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-store";
import { SectionCard } from "../SectionCard";

export interface ProvidersModelsSectionProps {
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  providerForm: {
    providerKey: string;
    displayName: string;
    sdkPackage: string;
    apiKey: string;
  };
  setProviderForm: Dispatch<
    SetStateAction<{
      providerKey: string;
      displayName: string;
      sdkPackage: string;
      apiKey: string;
    }>
  >;
  modelForm: {
    providerId: string;
    modelKey: string;
    displayName: string;
    capability: "text_generation" | "image_generation";
  };
  setModelForm: Dispatch<
    SetStateAction<{
      providerId: string;
      modelKey: string;
      displayName: string;
      capability: "text_generation" | "image_generation";
    }>
  >;
  createProvider: () => Promise<void>;
  runProviderTest: (providerId: string) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  createModel: () => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
}

export function ProvidersModelsSection({
  providers,
  models,
  providerForm,
  setProviderForm,
  modelForm,
  setModelForm,
  createProvider,
  runProviderTest,
  removeProvider,
  createModel,
  removeModel,
}: ProvidersModelsSectionProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Add Provider" icon={<Plus className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Provider Key
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm w-full"
                    value={providerForm.providerKey}
                    onChange={(e) =>
                      setProviderForm((p) => ({ ...p, providerKey: e.target.value }))
                    }
                    placeholder="e.g. openai, anthropic..."
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Display Name
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm w-full"
                    value={providerForm.displayName}
                    onChange={(e) =>
                      setProviderForm((p) => ({ ...p, displayName: e.target.value }))
                    }
                    placeholder="Friendly name..."
                  />
                </div>
              </div>
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">SDK Package</span>
                </label>
                <input
                  className="input input-bordered input-sm w-full"
                  value={providerForm.sdkPackage}
                  onChange={(e) => setProviderForm((p) => ({ ...p, sdkPackage: e.target.value }))}
                  placeholder="@ai-sdk/openai..."
                />
              </div>
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    API Key (update only)
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full"
                  value={providerForm.apiKey}
                  onChange={(e) => setProviderForm((p) => ({ ...p, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  className="btn btn-primary btn-sm gap-2 shadow-sm"
                  onClick={() => void createProvider()}
                >
                  <Save className="h-4 w-4" />
                  Save Provider
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Add Model" icon={<Plus className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">Provider</span>
                </label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={modelForm.providerId}
                  onChange={(e) => setModelForm((p) => ({ ...p, providerId: e.target.value }))}
                >
                  <option value="">Select provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-4">
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">Model Key</span>
                  </label>
                  <input
                    className="input input-bordered input-sm w-full"
                    value={modelForm.modelKey}
                    onChange={(e) => setModelForm((p) => ({ ...p, modelKey: e.target.value }))}
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet..."
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Display Name
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm w-full"
                    value={modelForm.displayName}
                    onChange={(e) => setModelForm((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="Friendly name..."
                  />
                </div>
              </div>
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">Capability</span>
                </label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={modelForm.capability}
                  onChange={(e) =>
                    setModelForm((p) => ({
                      ...p,
                      capability: e.target.value as "text_generation" | "image_generation",
                    }))
                  }
                >
                  <option value="text_generation">Text Generation</option>
                  <option value="image_generation">Image Generation</option>
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  className="btn btn-primary btn-sm gap-2 shadow-sm"
                  onClick={() => void createModel()}
                >
                  <Save className="h-4 w-4" />
                  Save Model
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Providers" icon={<Server className="h-4 w-4" />}>
            <div className="overflow-x-auto">
              <table className="table-sm table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Test</th>
                    <th>Key</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-base-200 divide-y">
                  {providers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center opacity-50">
                        No providers configured
                      </td>
                    </tr>
                  ) : (
                    providers.map((item) => (
                      <tr key={item.id} className="hover:bg-base-200/40">
                        <td className="font-medium">{item.displayName}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${item.status === "active" ? "badge-success" : "badge-ghost"}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm ${item.testStatus === "success" ? "badge-success" : item.testStatus === "failed" ? "badge-error" : "badge-ghost"}`}
                          >
                            {item.testStatus}
                          </span>
                        </td>
                        <td className="font-mono text-xs">
                          {item.hasKey ? (
                            <span className="flex items-center gap-1 opacity-70">
                              <Key className="text-success h-3 w-3" />
                              ****{item.keyLast4 ?? ""}
                            </span>
                          ) : (
                            <span className="text-warning">missing</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="btn btn-ghost btn-xs gap-1"
                              onClick={() => void runProviderTest(item.id)}
                              title="Test Connection"
                            >
                              <FlaskConical className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs text-error hover:bg-error/10 gap-1"
                              onClick={() => void removeProvider(item.id)}
                              title="Remove Provider"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Models" icon={<Bot className="h-4 w-4" />}>
            <div className="overflow-x-auto">
              <table className="table-sm table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Capability</th>
                    <th>Provider</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-base-200 divide-y">
                  {models.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center opacity-50">
                        No models configured
                      </td>
                    </tr>
                  ) : (
                    models.map((item) => (
                      <tr key={item.id} className="hover:bg-base-200/40">
                        <td className="font-medium">{item.displayName}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${item.capability === "text_generation" ? "badge-info" : "badge-secondary"}`}
                          >
                            {item.capability === "text_generation" ? "Text" : "Image"}
                          </span>
                        </td>
                        <td className="opacity-70">
                          {providers.find((p) => p.id === item.providerId)?.displayName ?? "-"}
                        </td>
                        <td className="text-right">
                          <button
                            className="btn btn-ghost btn-xs text-error hover:bg-error/10 gap-1"
                            onClick={() => void removeModel(item.id)}
                            title="Remove Model"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
