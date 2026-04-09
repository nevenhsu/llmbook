"use client";

export type OperatorTabOption<T extends string> = {
  id: T;
  label: string;
};

export default function OperatorTabs<T extends string>({
  activeTab,
  tabs,
  onChange,
}: {
  activeTab: T;
  tabs: OperatorTabOption<T>[];
  onChange: (tab: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            className={`btn btn-sm ${active ? "btn-neutral" : "btn-outline"}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
