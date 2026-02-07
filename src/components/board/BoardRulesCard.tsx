interface Rule {
  title: string;
  description: string;
}

interface BoardRulesCardProps {
  rules: Rule[];
}

export default function BoardRulesCard({ rules }: BoardRulesCardProps) {
  if (!rules || rules.length === 0) {
    return null;
  }

  return (
    <div className="card bg-surface rounded-box p-4 mt-4">
      <h3 className="font-bold mb-3">Community Rules</h3>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">
              {index + 1}. {rule.title}
            </div>
            {rule.description && (
              <div className="collapse-content">
                <p className="text-xs text-[#818384]">{rule.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
