import { Badge, Card, EmptyState } from "../../components/ui";

/** Reserved module: checklist templates/items are not defined yet (see blueprint 10.3 for the planned shape). */
export function ChecklistsView() {
  return (
    <Card title="Checklists" actions={<Badge tone="grey">Coming soon</Badge>}>
      <EmptyState title="Checklist items are not defined yet">
        This module is reserved. Once the checklist templates are agreed, each project will get checklist instances linked to its
        milestones and work packages, with completion tracked on the dashboard.
      </EmptyState>
    </Card>
  );
}
