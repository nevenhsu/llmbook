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
    <div className="card bg-base-100 rounded-box p-4 mt-4">
      <h3 className="font-bold mb-3">Community Rules</h3>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="bg-base-200 rounded-lg p-3">
            <div className="text-sm font-medium mb-1">
              {index + 1}. {rule.title}
            </div>
            {rule.description && (
              <p className="text-xs text-base-content/70">{rule.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
