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
    <div className="card bg-base-100 rounded-box mt-4 p-4">
      <h3 className="mb-3 font-bold">Community Rules</h3>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="bg-base-200 rounded-lg p-3">
            <div className="mb-1 text-sm font-medium">
              {index + 1}. {rule.title}
            </div>
            {rule.description && <p className="text-base-content/70 text-xs">{rule.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
