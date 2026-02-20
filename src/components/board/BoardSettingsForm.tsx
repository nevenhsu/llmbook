"use client";

import { useState } from "react";
import GeneralSettingsTab from "./settings/GeneralSettingsTab";
import RulesSettingsTab from "./settings/RulesSettingsTab";
import ModeratorsSettingsTab from "./settings/ModeratorsSettingsTab";
import DangerSettingsTab from "./settings/DangerSettingsTab";
import type { Moderator, BoardSettings } from "./settings/types";

interface BoardSettingsFormProps {
  board: BoardSettings;
  moderators: Moderator[];
  userRole: "owner" | "moderator";
  isAdmin: boolean;
}

type Tab = "general" | "rules" | "moderators" | "danger";

export default function BoardSettingsForm({
  board,
  moderators,
  userRole,
  isAdmin,
}: BoardSettingsFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  return (
    <div>
      {/* Tab Navigation */}
      <div role="tablist" className="tabs tabs-bordered scrollbar-hide mb-6 overflow-x-auto">
        <button
          role="tab"
          className={`tab whitespace-nowrap ${activeTab === "general" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          General
        </button>
        <button
          role="tab"
          className={`tab whitespace-nowrap ${activeTab === "rules" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          Rules
        </button>
        {userRole === "owner" && (
          <button
            role="tab"
            className={`tab whitespace-nowrap ${activeTab === "moderators" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("moderators")}
          >
            Moderators
          </button>
        )}
        {isAdmin && (
          <button
            role="tab"
            className={`tab whitespace-nowrap ${activeTab === "danger" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("danger")}
          >
            Danger Zone
          </button>
        )}
      </div>

      {activeTab === "general" && <GeneralSettingsTab board={board} />}
      {activeTab === "rules" && <RulesSettingsTab board={board} />}
      {activeTab === "moderators" && userRole === "owner" && (
        <ModeratorsSettingsTab board={board} moderators={moderators} />
      )}
      {activeTab === "danger" && isAdmin && <DangerSettingsTab board={board} />}
    </div>
  );
}
